"""RAG over Discord messages using LanceDB with Ollama embeddings (default,
model pulls lazily from the web) and opt-in local models.

Implements incremental deduplication, cosine similarity scoring, and fleet GPU/CPU telemetry.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any

import httpx

from .sanitize import sanitize_text

logger = logging.getLogger("discord-mcp.rag")

_LANCEDB_PATH_ENV = "LANCEDB_DISCORD_PATH"
_DEFAULT_TABLE = "discord_messages"
_EMBED_DIM = 384  # fallback when the provider dimension is not yet known

_model = None
_model_name = "sentence-transformers/all-MiniLM-L6-v2"
_model_dim: int | None = None
_gpu_active = False
_db = None


def embed_provider() -> str:
    """Active embedding backend: 'ollama' (default) or 'local'."""
    return os.getenv("RAG_EMBEDDINGS", "ollama").strip().lower() or "ollama"


def _ollama_base() -> str:
    """Native Ollama base URL (sampling config may carry an /v1 suffix — strip it)."""
    for var in ("OLLAMA_BASE_URL", "DISCORD_SAMPLING_BASE_URL"):
        raw = os.getenv(var, "").strip().rstrip("/")
        if raw:
            if raw.endswith("/v1"):
                raw = raw[: -len("/v1")]
            return raw
    return "http://localhost:11434"


def _ollama_model() -> str:
    return os.getenv("RAG_EMBED_MODEL", "nomic-embed-text").strip() or "nomic-embed-text"


class _OllamaEmbeddings:
    """Embeddings via a local Ollama server. The model itself pulls lazily
    from the web on first use (`ollama pull <model>`) — nothing ML-related
    ships inside the installer for this path."""

    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model

    def embed(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), 50):
            out.extend(self._embed_batch(texts[i : i + 50]))
        return out

    def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        try:
            r = httpx.post(
                f"{self.base_url}/api/embed",
                json={"model": self.model, "input": batch},
                timeout=120.0,
            )
        except Exception as e:
            raise RuntimeError(
                f"Ollama not reachable at {self.base_url} ({e}). Start Ollama "
                f"or set RAG_EMBEDDINGS=local."
            ) from e
        if r.status_code == 404:
            return self._embed_legacy(batch)  # older Ollama without /api/embed
        if r.status_code != 200:
            raise RuntimeError(
                f"Ollama embed failed (HTTP {r.status_code}): {r.text[:300]}. "
                f"Hint: `ollama pull {self.model}`."
            )
        embs = r.json().get("embeddings") or []
        if len(embs) != len(batch):
            raise RuntimeError(f"Ollama returned {len(embs)} embeddings for {len(batch)} inputs.")
        return [[float(x) for x in v] for v in embs]

    def _embed_legacy(self, batch: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for text in batch:
            r = httpx.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
                timeout=120.0,
            )
            if r.status_code != 200:
                raise RuntimeError(f"Ollama embed failed (HTTP {r.status_code}): {r.text[:300]}.")
            out.append([float(x) for x in (r.json().get("embedding") or [])])
        return out


def embed_use_gpu() -> bool:
    """Check if GPU embedding is requested and available."""
    raw = os.getenv("RAG_GPU", "").strip().lower()
    return raw in ("1", "true", "yes")


def _get_embedding_model():
    """Bootstrap the embedding backend. Ollama by default; local models opt-in
    via RAG_EMBEDDINGS=local (requires sentence-transformers installed)."""
    global _model, _model_name, _model_dim, _gpu_active
    if _model is not None:
        return _model

    provider = embed_provider()
    if provider == "ollama":
        base, model = _ollama_base(), _ollama_model()
        try:
            probe = httpx.get(f"{base}/api/tags", timeout=10.0)
        except Exception as e:
            raise RuntimeError(
                f"Ollama not reachable at {base} ({e}). Start Ollama "
                f"(and `ollama pull {model}`) or set RAG_EMBEDDINGS=local."
            ) from e
        if probe.status_code != 200:
            raise RuntimeError(
                f"Ollama at {base} answered HTTP {probe.status_code} on /api/tags. "
                f"Start Ollama or set RAG_EMBEDDINGS=local."
            )
        _model = _OllamaEmbeddings(base, model)
        _model_name = f"ollama/{model}"
        _model_dim = None
        _gpu_active = False
        logger.info("RAG using Ollama embeddings (%s @ %s)", _model_name, base)
        return _model
    if provider != "local":
        raise RuntimeError(f"Unknown RAG_EMBEDDINGS={provider!r} (want 'ollama' or 'local').")

    use_gpu = embed_use_gpu()

    # Try FastEmbed first if available in environment
    try:
        from fastembed import TextEmbedding

        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if use_gpu else ["CPUExecutionProvider"]
        _model = TextEmbedding(
            model_name="BAAI/bge-small-en-v1.5",
            providers=providers,
        )
        _model_name = "BAAI/bge-small-en-v1.5"
        _model_dim = 384
        _gpu_active = use_gpu
        logger.info("RAG using FastEmbed (%s, GPU=%s)", _model_name, _gpu_active)
        return _model
    except Exception as fe_err:
        logger.debug("FastEmbed unavailable or failed to initialize, falling back to sentence-transformers: %s", fe_err)

    # Fall back to sentence-transformers (opt-in only: needs the torch stack)
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as e:
        raise RuntimeError(
            "RAG_EMBEDDINGS=local needs sentence-transformers (torch stack), "
            "which is no longer a dependency. Install it, or switch back to "
            "the default RAG_EMBEDDINGS=ollama."
        ) from e

    device = "cuda" if use_gpu else "cpu"
    try:
        _model = SentenceTransformer("all-MiniLM-L6-v2", device=device)
        _gpu_active = (device == "cuda")
    except Exception:
        _model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
        _gpu_active = False

    _model_name = "sentence-transformers/all-MiniLM-L6-v2"
    _model_dim = 384
    logger.info("RAG using SentenceTransformer (%s, GPU=%s)", _model_name, _gpu_active)
    return _model


def _provider_dim(model: Any = None) -> int:
    """Vector dimension of the active provider (probed once, then cached)."""
    global _model_dim
    if _model_dim is not None:
        return _model_dim
    m = model if model is not None else _get_embedding_model()
    if isinstance(m, _OllamaEmbeddings):
        vecs = m.embed(["dimension probe"])
        if not vecs or not vecs[0]:
            raise RuntimeError("Ollama returned an empty embedding for the dimension probe.")
        _model_dim = len(vecs[0])
    else:
        _model_dim = len(_encode_text(m, "dimension probe"))
    return _model_dim


def _table_vector_dim(tbl: Any) -> int | None:
    """Vector width stored in a LanceDB table (None when unreadable)."""
    try:
        for field in tbl.schema:
            if field.name == "vector":
                size = getattr(field.type, "list_size", None)
                return int(size) if size else None
        return None
    except Exception:
        return None


def _dim_mismatch_msg(table_name: str, table_dim: int, provider_dim: int) -> str:
    return (
        f"Embedding model changed (table '{table_name}' is {table_dim}d, "
        f"provider '{_model_name}' is {provider_dim}d). Vectors are incompatible — "
        f"re-ingest with overwrite=true to rebuild the table."
    )


def _require_dim_match(tbl: Any, table_name: str, provider_dim: int) -> str | None:
    table_dim = _table_vector_dim(tbl)
    if table_dim and table_dim != provider_dim:
        return _dim_mismatch_msg(table_name, table_dim, provider_dim)
    return None


def _encode_text(model: Any, text: str) -> list[float]:
    """Uniform encoding helper returning float32 list."""
    if isinstance(model, _OllamaEmbeddings):
        return model.embed([text])[0]
    if hasattr(model, "encode"):  # SentenceTransformer
        vec = model.encode(text, convert_to_numpy=True).astype("float32").tolist()
        return [float(x) for x in vec]
    if hasattr(model, "embed"):  # FastEmbed TextEmbedding
        embs = list(model.embed([text]))
        return [float(x) for x in embs[0]]
    raise ValueError(f"Unsupported embedding model type: {type(model)}")


def _encode_texts(model: Any, texts: list[str]) -> list[list[float]]:
    """Batch encoding (Ollama posts one request per 50-text chunk)."""
    if isinstance(model, _OllamaEmbeddings):
        return model.embed(texts)
    return [_encode_text(model, t) for t in texts]


def _get_db():
    global _db
    if _db is None:
        import lancedb

        path = os.environ.get(_LANCEDB_PATH_ENV, "").strip() or "data/discord_lancedb"
        Path(path).mkdir(parents=True, exist_ok=True)
        _db = lancedb.connect(path)
    return _db


def _table_exists(db: Any, table_name: str) -> bool:
    try:
        res = db.list_tables()
        tables = res.tables if hasattr(res, "tables") else list(res)
        return table_name in tables
    except Exception:
        return False


def _open_table(table_name: str = _DEFAULT_TABLE):
    db = _get_db()
    if _table_exists(db, table_name):
        return db.open_table(table_name)
    return None


def get_indexed_message_ids(table_name: str = _DEFAULT_TABLE, channel_id: str | None = None) -> set[str]:
    """Retrieve message IDs already present in LanceDB table to avoid re-embedding."""
    tbl = _open_table(table_name)
    if tbl is None:
        return set()
    try:
        req = tbl.search().select(["message_id", "channel_id"])
        if channel_id:
            req = req.where(f"channel_id = '{channel_id}'")
        df = req.to_arrow()
        return {str(x["message_id"]) for x in df.to_pylist() if x.get("message_id")}
    except Exception as e:
        logger.debug("Failed querying indexed message_ids: %s", e)
        return set()


def _text_for_embedding(msg: dict, guild_name: str = "", channel_name: str = "") -> str:
    author = sanitize_text(msg.get("author", ""))
    content = sanitize_text((msg.get("content") or "").strip())
    ts = msg.get("timestamp", "")
    parts = [content]
    if author:
        parts.append(f"Author: {author}")
    if ts:
        parts.append(f"Time: {ts}")
    if channel_name:
        parts.append(f"Channel: {channel_name}")
    if guild_name:
        parts.append(f"Server: {guild_name}")
    return " | ".join(p for p in parts if p)


def ingest_messages(
    messages: list[dict],
    *,
    guild_name: str = "",
    channel_name: str = "",
    channel_id: str = "",
    guild_id: str = "",
    table_name: str = _DEFAULT_TABLE,
    skip_existing: bool = True,
    overwrite: bool = False,
    progress_callback=None,
) -> dict[str, Any]:
    """Embed messages and insert into LanceDB with deduplication. Returns {success, ingested, error}."""
    if not messages:
        return {"success": True, "ingested": 0, "skipped": 0}
    try:
        model = _get_embedding_model()
        db = _get_db()
        provider_dim = _provider_dim(model)

        if not overwrite and _table_exists(db, table_name):
            dim_err = _require_dim_match(db.open_table(table_name), table_name, provider_dim)
            if dim_err:
                return {"success": False, "ingested": 0, "skipped": 0, "error": dim_err}

        existing_ids = set()
        if skip_existing and not overwrite:
            existing_ids = get_indexed_message_ids(table_name, channel_id=channel_id or None)

        pending: list[tuple[dict, str]] = []
        skipped = 0
        total = len(messages)

        for idx, m in enumerate(messages):
            mid = str(m.get("id") or m.get("message_id") or "")
            if mid and mid in existing_ids:
                skipped += 1
                continue

            text = _text_for_embedding(m, guild_name=guild_name, channel_name=channel_name)
            if not text.strip():
                continue
            pending.append((m, text))

            if progress_callback and (idx + 1) % 10 == 0:
                progress_callback(idx + 1, total, "embedding")

        if not pending:
            return {"success": True, "ingested": 0, "skipped": skipped, "message": "All messages already indexed."}

        vecs = _encode_texts(model, [text for _, text in pending])
        rows = []
        for (m, text), vec in zip(pending, vecs, strict=True):
            mid = str(m.get("id") or m.get("message_id") or "")
            rows.append(
                {
                    "vector": vec,
                    "text": text[:4000],
                    "message_id": mid,
                    "channel_id": channel_id,
                    "guild_id": guild_id,
                    "author": (m.get("author") or "")[:200],
                    "timestamp": (m.get("timestamp") or "")[:50],
                    "guild_name": guild_name[:200],
                    "channel_name": channel_name[:200],
                }
            )

        if not rows:
            return {"success": True, "ingested": 0, "skipped": skipped, "message": "All messages already indexed."}

        if overwrite or not _table_exists(db, table_name):
            db.create_table(table_name, data=rows, mode="overwrite")
        else:
            tbl = db.open_table(table_name)
            tbl.add(rows)

        logger.info("RAG ingest: %s rows into %s (skipped %s)", len(rows), table_name, skipped)
        return {"success": True, "ingested": len(rows), "skipped": skipped}
    except Exception as e:
        logger.exception("RAG ingest failed")
        return {"success": False, "ingested": 0, "error": str(e)}


def _query(
    query_text: str,
    *,
    top_k: int = 10,
    table_name: str = _DEFAULT_TABLE,
    channel_id: str | None = None,
    guild_id: str | None = None,
    min_score: float = 0.25,
) -> dict[str, Any]:
    """Semantic search over ingested Discord messages with similarity scoring."""
    if not query_text.strip():
        return {"success": True, "hits": []}
    try:
        model = _get_embedding_model()
        db = _get_db()
        if not _table_exists(db, table_name):
            return {"success": True, "hits": [], "message": "No table yet; ingest channels first."}

        tbl = db.open_table(table_name)
        provider_dim = _provider_dim(model)
        dim_err = _require_dim_match(tbl, table_name, provider_dim)
        if dim_err:
            return {"success": False, "hits": [], "error": dim_err}
        qvec = _encode_text(model, query_text.strip())

        search_req = tbl.search(qvec).limit(top_k * 2)

        where_clauses = []
        if channel_id:
            where_clauses.append(f"channel_id = '{channel_id}'")
        if guild_id:
            where_clauses.append(f"guild_id = '{guild_id}'")
        if where_clauses:
            search_req = search_req.where(" AND ".join(where_clauses))

        rs = search_req.to_list()
        hits = []
        for r in rs:
            dist = float(r.get("_distance", 0.0))
            score = round(max(0.0, 1.0 - (dist / 2.0)), 4)
            if score < min_score:
                continue

            hits.append(
                {
                    "text": r.get("text", ""),
                    "message_id": r.get("message_id"),
                    "channel_id": r.get("channel_id"),
                    "guild_id": r.get("guild_id"),
                    "author": r.get("author"),
                    "timestamp": r.get("timestamp"),
                    "guild_name": r.get("guild_name"),
                    "channel_name": r.get("channel_name"),
                    "distance": dist,
                    "score": score,
                }
            )

        hits.sort(key=lambda h: h.get("score", 0), reverse=True)
        return {"success": True, "hits": hits[:top_k]}
    except Exception as e:
        logger.exception("RAG query failed")
        return {"success": False, "hits": [], "error": str(e)}


async def rag_query_async(
    query_text: str,
    top_k: int = 10,
    table_name: str = _DEFAULT_TABLE,
    channel_id: str | None = None,
    guild_id: str | None = None,
    min_score: float = 0.25,
) -> dict[str, Any]:
    """Run RAG query in thread pool."""
    return await asyncio.to_thread(
        _query,
        query_text,
        top_k=top_k,
        table_name=table_name,
        channel_id=channel_id,
        guild_id=guild_id,
        min_score=min_score,
    )


def get_rag_telemetry(table_name: str = _DEFAULT_TABLE) -> dict[str, Any]:
    """Return vector store operational metrics for REST endpoints and webapp."""
    try:
        db = _get_db()
        res = db.list_tables()
        table_list = res.tables if hasattr(res, "tables") else list(res)

        table_stats = []
        total_vectors = 0

        for t in table_list:
            tbl = db.open_table(t)
            try:
                c = tbl.count_rows()
            except Exception:
                c = 0
            total_vectors += c
            table_stats.append({"table_name": t, "count": c})

        # Calculate storage footprint
        path = Path(os.environ.get(_LANCEDB_PATH_ENV, "").strip() or "data/discord_lancedb")
        storage_mb = 0.0
        if path.exists():
            total_bytes = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
            storage_mb = round(total_bytes / (1024 * 1024), 2)

        return {
            "success": True,
            "total_chunks": total_vectors,
            "storage_mb": storage_mb,
            "tables": table_stats,
            "embedding_model": _model_name,
            "embedding_provider": embed_provider(),
            "embedding_dim": _model_dim,
            "gpu_accelerated": _gpu_active or embed_use_gpu(),
            "status": "healthy",
        }
    except Exception as exc:
        return {"success": False, "error": str(exc), "status": "unavailable"}

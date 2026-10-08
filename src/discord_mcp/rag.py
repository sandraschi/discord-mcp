"""RAG over Discord messages using LanceDB with FastEmbed / sentence-transformers fallback.

Implements incremental deduplication, cosine similarity scoring, and fleet GPU/CPU telemetry.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any

from .sanitize import sanitize_text

logger = logging.getLogger("discord-mcp.rag")

_LANCEDB_PATH_ENV = "LANCEDB_DISCORD_PATH"
_DEFAULT_TABLE = "discord_messages"
_EMBED_DIM = 384

_model = None
_model_name = "sentence-transformers/all-MiniLM-L6-v2"
_gpu_active = False
_db = None


def embed_use_gpu() -> bool:
    """Check if GPU embedding is requested and available."""
    raw = os.getenv("RAG_GPU", "").strip().lower()
    return raw in ("1", "true", "yes")


def _get_embedding_model():
    """Bootstrap embedding model with FastEmbed or sentence-transformers fallback."""
    global _model, _model_name, _gpu_active
    if _model is not None:
        return _model

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
        _gpu_active = use_gpu
        logger.info("RAG using FastEmbed (%s, GPU=%s)", _model_name, _gpu_active)
        return _model
    except Exception as fe_err:
        logger.debug("FastEmbed unavailable or failed to initialize, falling back to sentence-transformers: %s", fe_err)

    # Fall back to sentence-transformers
    from sentence_transformers import SentenceTransformer

    device = "cuda" if use_gpu else "cpu"
    try:
        _model = SentenceTransformer("all-MiniLM-L6-v2", device=device)
        _gpu_active = (device == "cuda")
    except Exception:
        _model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
        _gpu_active = False

    _model_name = "sentence-transformers/all-MiniLM-L6-v2"
    logger.info("RAG using SentenceTransformer (%s, GPU=%s)", _model_name, _gpu_active)
    return _model


def _encode_text(model: Any, text: str) -> list[float]:
    """Uniform encoding helper returning float32 list."""
    if hasattr(model, "encode"):  # SentenceTransformer
        vec = model.encode(text, convert_to_numpy=True).astype("float32").tolist()
        return [float(x) for x in vec]
    if hasattr(model, "embed"):  # FastEmbed TextEmbedding
        embs = list(model.embed([text]))
        return [float(x) for x in embs[0]]
    raise ValueError(f"Unsupported embedding model type: {type(model)}")


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

        existing_ids = set()
        if skip_existing and not overwrite:
            existing_ids = get_indexed_message_ids(table_name, channel_id=channel_id or None)

        rows = []
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

            vec = _encode_text(model, text)
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

            if progress_callback and (idx + 1) % 10 == 0:
                progress_callback(idx + 1, total, "embedding")

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
            "gpu_accelerated": _gpu_active or embed_use_gpu(),
            "status": "healthy",
        }
    except Exception as exc:
        return {"success": False, "error": str(exc), "status": "unavailable"}

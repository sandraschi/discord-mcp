"""RAG over Discord messages using LanceDB (required)."""
import asyncio
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("discord-mcp.rag")

_LANCEDB_PATH_ENV = "LANCEDB_DISCORD_PATH"
_DEFAULT_TABLE = "discord_messages"
_EMBED_DIM = 384  # all-MiniLM-L6-v2

_model = None
_db = None


def _get_embedding_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _get_db():
    global _db
    if _db is None:
        import lancedb
        path = os.environ.get(_LANCEDB_PATH_ENV, "").strip() or "data/discord_lancedb"
        Path(path).mkdir(parents=True, exist_ok=True)
        _db = lancedb.connect(path)
    return _db


def _text_for_embedding(msg: dict, guild_name: str = "", channel_name: str = "") -> str:
    author = msg.get("author", "")
    content = (msg.get("content") or "").strip()
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
) -> dict[str, Any]:
    """Embed messages and insert into LanceDB. Returns {success, ingested, error}."""
    if not messages:
        return {"success": True, "ingested": 0}
    try:
        model = _get_embedding_model()
        db = _get_db()
        rows = []
        for m in messages:
            text = _text_for_embedding(m, guild_name=guild_name, channel_name=channel_name)
            if not text.strip():
                continue
            vec = model.encode(text, convert_to_numpy=True).astype("float32").tolist()
            rows.append({
                "vector": vec,
                "text": text[:4000],
                "message_id": m.get("id", ""),
                "channel_id": channel_id,
                "guild_id": guild_id,
                "author": (m.get("author") or "")[:200],
                "timestamp": (m.get("timestamp") or "")[:50],
                "guild_name": guild_name[:200],
                "channel_name": channel_name[:200],
            })
        if not rows:
            return {"success": True, "ingested": 0}
        if table_name in db.table_names():
            tbl = db.open_table(table_name)
            tbl.add(rows)
        else:
            db.create_table(table_name, rows)
        logger.info("RAG ingest: %s rows into %s", len(rows), table_name)
        return {"success": True, "ingested": len(rows)}
    except Exception as e:
        logger.exception("RAG ingest failed")
        return {"success": False, "ingested": 0, "error": str(e)}


def query(
    query_text: str,
    *,
    top_k: int = 10,
    table_name: str = _DEFAULT_TABLE,
) -> dict[str, Any]:
    """Semantic search over ingested Discord messages. Returns {success, hits, error}."""
    if not query_text.strip():
        return {"success": True, "hits": []}
    try:
        model = _get_embedding_model()
        db = _get_db()
        if table_name not in db.table_names():
            return {"success": True, "hits": [], "message": "No table yet; ingest channels first."}
        tbl = db.open_table(table_name)
        qvec = model.encode(query_text.strip(), convert_to_numpy=True).astype("float32")
        rs = tbl.search(qvec).limit(top_k).to_list()
        hits = []
        for r in rs:
            hits.append({
                "text": r.get("text", ""),
                "message_id": r.get("message_id"),
                "channel_id": r.get("channel_id"),
                "guild_id": r.get("guild_id"),
                "author": r.get("author"),
                "timestamp": r.get("timestamp"),
                "guild_name": r.get("guild_name"),
                "channel_name": r.get("channel_name"),
                "distance": float(r.get("_distance", 0)),
            })
        return {"success": True, "hits": hits}
    except Exception as e:
        logger.exception("RAG query failed")
        return {"success": False, "hits": [], "error": str(e)}


async def rag_query_async(query_text: str, top_k: int = 10, table_name: str = _DEFAULT_TABLE) -> dict[str, Any]:
    """Run RAG query in thread (embedding is CPU-bound)."""
    return await asyncio.to_thread(query, query_text, top_k=top_k, table_name=table_name)

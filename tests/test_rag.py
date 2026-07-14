"""Tests for RAG ingest/query (LanceDB + embeddings mocked)."""

from unittest.mock import MagicMock, patch

import pytest

from discord_mcp.rag import ingest_messages, rag_query_async


def test_ingest_messages_empty():
    out = ingest_messages([])
    assert out["success"] is True
    assert out["ingested"] == 0


@patch("discord_mcp.rag._get_db")
@patch("discord_mcp.rag._get_embedding_model")
def test_ingest_messages_writes_rows(mock_model, mock_db):
    mock_model.return_value.encode.return_value.astype.return_value.tolist.return_value = [0.1] * 384
    db = MagicMock()
    db.table_names.return_value = []
    db.create_table = MagicMock()
    mock_db.return_value = db

    messages = [{"id": "m1", "author": "alice", "content": "hello world", "timestamp": "2026-01-01"}]
    out = ingest_messages(messages, channel_id="c1", guild_id="g1")
    assert out["success"] is True
    assert out["ingested"] == 1
    db.create_table.assert_called_once()


@patch("discord_mcp.rag._query")
@pytest.mark.asyncio
async def test_rag_query_async_delegates(mock_query):
    mock_query.return_value = {"success": True, "hits": [{"text": "hello"}]}
    out = await rag_query_async("hello", top_k=5)
    assert out["success"] is True
    assert len(out["hits"]) == 1

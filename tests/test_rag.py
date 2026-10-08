"""Tests for RAG ingest/query, local depot archiving, and background sweep runner."""

from __future__ import annotations

import tempfile
from unittest.mock import MagicMock, patch

import pytest

from discord_mcp.depot import export_messages_to_depot, list_depot_inventory, load_messages_from_depot
from discord_mcp.rag import get_rag_telemetry, ingest_messages, rag_query_async


def test_ingest_messages_empty():
    out = ingest_messages([])
    assert out["success"] is True
    assert out["ingested"] == 0


@patch("discord_mcp.rag._get_db")
@patch("discord_mcp.rag._get_embedding_model")
def test_ingest_messages_writes_rows(mock_model, mock_db):
    mock_model.return_value.encode.return_value.astype.return_value.tolist.return_value = [0.1] * 384
    db = MagicMock()
    db.list_tables.return_value = []
    db.create_table = MagicMock()
    mock_db.return_value = db

    messages = [{"id": "m1", "author": "alice", "content": "hello world", "timestamp": "2026-01-01"}]
    out = ingest_messages(messages, channel_id="c1", guild_id="g1", skip_existing=False)
    assert out["success"] is True
    assert out["ingested"] == 1
    db.create_table.assert_called_once()


@patch("discord_mcp.rag._query")
@pytest.mark.asyncio
async def test_rag_query_async_delegates(mock_query):
    mock_query.return_value = {"success": True, "hits": [{"text": "hello", "score": 0.95}]}
    out = await rag_query_async("hello", top_k=5)
    assert out["success"] is True
    assert len(out["hits"]) == 1
    assert out["hits"][0]["score"] == 0.95


def test_depot_export_and_inventory():
    with tempfile.TemporaryDirectory() as tmpdir:
        with patch.dict("os.environ", {"DISCORD_DEPOT_PATH": tmpdir}):
            msgs = [
                {"id": "msg_1", "author": "bob", "content": "test message 1", "timestamp": "2026-02-01"},
                {"id": "msg_2", "author": "carol", "content": "test message 2", "timestamp": "2026-02-02"},
            ]
            res = export_messages_to_depot(
                messages=msgs,
                channel_id="chan_99",
                guild_id="guild_42",
                guild_name="Alpha Guild",
                channel_name="general",
            )
            assert res["success"] is True
            assert res["appended"] == 2
            assert res["total"] == 2

            # Repeat export should deduplicate
            res2 = export_messages_to_depot(
                messages=msgs,
                channel_id="chan_99",
                guild_id="guild_42",
            )
            assert res2["success"] is True
            assert res2["appended"] == 0
            assert res2["total"] == 2

            # Load from depot
            loaded = load_messages_from_depot("chan_99", "guild_42")
            assert len(loaded) == 2
            assert loaded[0]["id"] == "msg_1"

            # Check inventory
            inv = list_depot_inventory()
            assert len(inv) == 1
            assert inv[0]["channel_id"] == "chan_99"
            assert inv[0]["guild_id"] == "guild_42"
            assert inv[0]["message_count"] == 2


@patch("discord_mcp.rag._get_db")
def test_get_rag_telemetry(mock_db):
    db = MagicMock()
    db.list_tables.return_value = ["discord_messages"]
    tbl = MagicMock()
    tbl.count_rows.return_value = 142
    db.open_table.return_value = tbl
    mock_db.return_value = db

    stats = get_rag_telemetry()
    assert stats["success"] is True
    assert stats["total_chunks"] == 142
    assert "embedding_model" in stats
    assert "gpu_accelerated" in stats

"""Message scheduler — schedule messages to be sent at a future time."""

import asyncio
import json
import logging
import sqlite3
import threading
import time
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("discord-mcp.scheduler")

_DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "scheduler.sqlite3"
_worker_thread: threading.Thread | None = None
_stop_event = threading.Event()


def _init_db() -> None:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scheduled_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            content TEXT NOT NULL,
            scheduled_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            sent_at TEXT
        )
    """)
    conn.commit()
    conn.close()


def _get_conn() -> sqlite3.Connection:
    _init_db()
    return sqlite3.connect(str(_DB_PATH))


# --- CRUD ---

def create_scheduled_message(guild_id: str, channel_id: str, content: str, scheduled_at: str) -> dict:
    conn = _get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO scheduled_messages (guild_id, channel_id, content, scheduled_at) VALUES (?, ?, ?, ?)",
            (guild_id, channel_id, content, scheduled_at),
        )
        conn.commit()
        return {"success": True, "id": cur.lastrowid}
    except Exception as e:
        logger.error("Failed to create scheduled message: %s", e)
        return {"success": False, "error": str(e)}
    finally:
        conn.close()


def list_scheduled_messages(status: str | None = None, limit: int = 50) -> dict:
    conn = _get_conn()
    try:
        if status:
            rows = conn.execute(
                "SELECT * FROM scheduled_messages WHERE status = ? ORDER BY scheduled_at LIMIT ?",
                (status, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM scheduled_messages ORDER BY scheduled_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        col_names = [d[0] for d in conn.description]
        messages = [dict(zip(col_names, r)) for r in rows]
        return {"success": True, "messages": messages, "count": len(messages)}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        conn.close()


def cancel_scheduled_message(msg_id: int) -> dict:
    conn = _get_conn()
    try:
        cur = conn.execute(
            "UPDATE scheduled_messages SET status = 'cancelled' WHERE id = ? AND status = 'pending'",
            (msg_id,),
        )
        conn.commit()
        if cur.rowcount == 0:
            return {"success": False, "error": "Message not found or already sent/cancelled"}
        return {"success": True, "id": msg_id, "cancelled": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        conn.close()


# --- Worker ---

async def _send_scheduled(conn: sqlite3.Connection, row: sqlite3.Row) -> None:
    """Send one scheduled message via the discord portmanteau."""
    from .portmanteau import discord_tool

    msg_id, channel_id, content = row[0], row[2], row[3]
    out = await discord_tool(ctx=None, operation="send_message", channel_id=channel_id, content=content)
    if out.get("success"):
        conn.execute(
            "UPDATE scheduled_messages SET status = 'sent', sent_at = datetime('now') WHERE id = ?",
            (msg_id,),
        )
        logger.info("Scheduled message %d sent", msg_id)
    else:
        logger.warning("Scheduled message %d failed: %s", msg_id, out.get("error"))
        conn.execute(
            "UPDATE scheduled_messages SET status = 'failed' WHERE id = ?",
            (msg_id,),
        )


def _worker_loop() -> None:
    """Background thread loop — check every 15s for due messages."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    while not _stop_event.is_set():
        try:
            conn = _get_conn()
            due = conn.execute(
                "SELECT * FROM scheduled_messages WHERE status = 'pending' AND scheduled_at <= datetime('now')"
            ).fetchall()
            for row in due:
                loop.run_until_complete(_send_scheduled(conn, row))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error("Scheduler worker error: %s", e)
        _stop_event.wait(15)


def start_scheduler() -> None:
    global _worker_thread
    if _worker_thread and _worker_thread.is_alive():
        return
    _init_db()
    _stop_event.clear()
    _worker_thread = threading.Thread(target=_worker_loop, daemon=True, name="msg-scheduler")
    _worker_thread.start()
    logger.info("Message scheduler started")


def stop_scheduler() -> None:
    _stop_event.set()
    logger.info("Message scheduler stopped")

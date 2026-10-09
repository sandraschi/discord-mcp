"""Local Guild & Channel Depot for discord-mcp.

Allows selective mirroring and archiving of Discord channels/guilds to local JSONL
depot files (data/depot/guilds/{guild_id}/{channel_id}.jsonl).
Enables offline, rate-limit-free LanceDB re-indexing and long-term conversation preservation.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("discord-mcp.depot")

_DEFAULT_DEPOT_ROOT = "data/depot/guilds"


def get_depot_root() -> Path:
    root = os.environ.get("DISCORD_DEPOT_PATH", "").strip() or _DEFAULT_DEPOT_ROOT
    p = Path(root)
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_channel_depot_path(channel_id: str, guild_id: str = "dm") -> Path:
    safe_guild = (guild_id or "dm").strip().replace("/", "_").replace("\\", "_")
    guild_dir = get_depot_root() / safe_guild
    guild_dir.mkdir(parents=True, exist_ok=True)
    return guild_dir / f"{channel_id}.jsonl"


def export_messages_to_depot(
    messages: list[dict[str, Any]],
    channel_id: str,
    guild_id: str = "dm",
    guild_name: str = "",
    channel_name: str = "",
) -> dict[str, Any]:
    """Append or upsert messages into local channel JSONL depot file.

    Deduplicates by message 'id'.
    """
    if not messages:
        return {"success": True, "appended": 0, "total": 0}

    depot_file = get_channel_depot_path(channel_id, guild_id)
    existing_ids: set[str] = set()
    existing_lines: list[str] = []

    if depot_file.exists():
        try:
            with open(depot_file, encoding="utf-8") as f:
                for line in f:
                    line_str = line.strip()
                    if not line_str:
                        continue
                    existing_lines.append(line_str)
                    try:
                        obj = json.loads(line_str)
                        if "id" in obj:
                            existing_ids.add(str(obj["id"]))
                    except Exception as e:
                        logger.debug("Skipping unparsable depot line in %s: %s", depot_file, e)
        except Exception as e:
            logger.warning("Failed reading existing depot file %s: %s", depot_file, e)

    new_entries: list[dict[str, Any]] = []
    for m in messages:
        mid = str(m.get("id", ""))
        if not mid or mid in existing_ids:
            continue
        record = dict(m)
        record["channel_id"] = channel_id
        record["guild_id"] = guild_id
        if guild_name:
            record["guild_name"] = guild_name
        if channel_name:
            record["channel_name"] = channel_name
        new_entries.append(record)
        existing_ids.add(mid)

    if new_entries:
        try:
            with open(depot_file, "a", encoding="utf-8") as f:
                for item in new_entries:
                    f.write(json.dumps(item, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.exception("Failed appending to depot file %s", depot_file)
            return {"success": False, "appended": 0, "error": str(e)}

    return {
        "success": True,
        "channel_id": channel_id,
        "guild_id": guild_id,
        "appended": len(new_entries),
        "total": len(existing_ids),
        "depot_file": str(depot_file),
    }


def load_messages_from_depot(
    channel_id: str,
    guild_id: str = "dm",
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Load cached messages from channel depot file."""
    depot_file = get_channel_depot_path(channel_id, guild_id)
    if not depot_file.exists():
        return []

    messages = []
    try:
        with open(depot_file, encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    messages.append(json.loads(line_str))
                except Exception as e:
                    logger.debug("Skipping unparsable depot line for %s: %s", channel_id, e)
        if limit and len(messages) > limit:
            messages = messages[-limit:]
        return messages
    except Exception as e:
        logger.error("Failed loading depot messages for %s: %s", channel_id, e)
        return []


def list_depot_inventory() -> list[dict[str, Any]]:
    """Return inventory of all mirrored guilds, channels, and message counts."""
    root = get_depot_root()
    inventory: list[dict[str, Any]] = []

    if not root.exists():
        return inventory

    for guild_path in root.iterdir():
        if not guild_path.is_dir():
            continue
        guild_id = guild_path.name
        for channel_file in guild_path.glob("*.jsonl"):
            channel_id = channel_file.stem
            line_count = 0
            guild_name = ""
            channel_name = ""
            sample_time = ""
            try:
                with open(channel_file, encoding="utf-8") as f:
                    for line in f:
                        line_str = line.strip()
                        if not line_str:
                            continue
                        line_count += 1
                        if line_count == 1:
                            try:
                                first = json.loads(line_str)
                                guild_name = first.get("guild_name", "")
                                channel_name = first.get("channel_name", "")
                                sample_time = first.get("timestamp", "")
                            except Exception as e:
                                logger.debug("Unparsable first line in %s: %s", channel_file, e)
            except Exception as e:
                logger.warning("Failed inventory scan of %s: %s", channel_file, e)

            file_size_kb = round(channel_file.stat().st_size / 1024, 1)
            inventory.append(
                {
                    "guild_id": guild_id,
                    "channel_id": channel_id,
                    "guild_name": guild_name,
                    "channel_name": channel_name,
                    "message_count": line_count,
                    "size_kb": file_size_kb,
                    "file_path": str(channel_file),
                    "last_timestamp": sample_time,
                }
            )

    return sorted(inventory, key=lambda x: (x["guild_id"], x["channel_id"]))

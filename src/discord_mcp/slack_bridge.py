import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

BRIDGE_FILE = Path.cwd() / "slack_bridge.json"


def _load_mappings() -> list[dict[str, Any]]:
    if not BRIDGE_FILE.is_file():
        return []
    try:
        return json.loads(BRIDGE_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error("Failed to load Slack bridge mappings: %s", e)
        return []


def _save_mappings(mappings: list[dict[str, Any]]) -> bool:
    try:
        BRIDGE_FILE.write_text(json.dumps(mappings, indent=2, ensure_ascii=False), encoding="utf-8")
        return True
    except Exception as e:
        logger.error("Failed to save Slack bridge mappings: %s", e)
        return False


async def forward_to_slack(channel_id: str, message: dict[str, Any]) -> None:
    mappings = _load_mappings()
    webhook_url = None
    for m in mappings:
        if m.get("discord_channel_id") == channel_id and m.get("active", True):
            webhook_url = m.get("slack_webhook_url")
            break

    if not webhook_url:
        return

    import httpx

    # Format a beautiful Slack block message
    author = message.get("author", "Unknown User")
    content = message.get("content", "")
    message.get("guild_id", "")  # Or guild name

    payload = {
        "text": f"New Discord Message from @{author}",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Inbound Discord Message*\n*User:* `@{author}`\n*Channel:* <#{channel_id}>",
                },
            },
            {"type": "section", "text": {"type": "mrkdwn", "text": f"> {content}"}},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code >= 400:
                logger.warning("Slack webhook POST returned status %d", resp.status_code)
    except Exception as e:
        logger.error("Failed to forward message to Slack webhook: %s", e)

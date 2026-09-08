import json
import logging
from pathlib import Path
from typing import Any

from .agentic import _assign_role, _send_message

logger = logging.getLogger(__name__)

RULES_FILE = Path.cwd() / "rules.json"


def _load_rules() -> list[dict[str, Any]]:
    if not RULES_FILE.is_file():
        return []
    try:
        return json.loads(RULES_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error("Failed to load rules: %s", e)
        return []


def _save_rules(rules: list[dict[str, Any]]) -> bool:
    try:
        RULES_FILE.write_text(json.dumps(rules, indent=2, ensure_ascii=False), encoding="utf-8")
        return True
    except Exception as e:
        logger.error("Failed to save rules: %s", e)
        return False


async def evaluate_rules(message: dict[str, Any]) -> None:
    rules = _load_rules()
    for rule in rules:
        if not rule.get("active", True):
            continue

        # 1. Trigger
        trigger = rule.get("trigger", "on_message")
        if trigger != "on_message":
            continue

        # 2. Condition
        condition_type = rule.get("condition_type", "contains")  # contains, author, channel
        condition_value = rule.get("condition_value", "")
        content = message.get("content", "")
        author = message.get("author", "")
        channel_id = message.get("channel_id", "")

        matched = False
        if condition_type == "contains":
            matched = condition_value.lower() in content.lower()
        elif condition_type == "author":
            matched = condition_value.lower() == author.lower()
        elif condition_type == "channel":
            matched = condition_value == channel_id

        if not matched:
            continue

        # 3. Action
        action_type = rule.get("action_type", "reply")  # reply, assign_role, webhook
        action_value = rule.get("action_value", "")

        logger.info("Executing automation rule '%s' (type=%s)", rule.get("name"), action_type)

        try:
            if action_type == "reply":
                await _send_message(channel_id=channel_id, content=action_value)
            elif action_type == "assign_role" and "," in action_value:
                # Expect action_value to be "guild_id,role_id" or similar
                guild_id = message.get("guild_id", "")
                user_id = message.get("author_id", "")  # Need author_id from raw msg
                if guild_id and user_id:
                    await _assign_role(guild_id=guild_id, user_id=user_id, role_id=action_value)
            elif action_type == "webhook":
                import httpx

                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(action_value, json={"rule_triggered": rule.get("name"), "message": message})
        except Exception as e:
            logger.error("Rule execution failed: %s", e)

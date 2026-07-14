"""Global state for Discord MCP — typed rate-limit tracking and token status."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field


@dataclass
class DiscordState:
    token_set: bool = False
    rate_limit_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    message_timestamps: list[float] = field(default_factory=list)
    channel_message_timestamps: dict[str, list[float]] = field(default_factory=dict)
    create_channel_timestamps: list[float] = field(default_factory=list)
    create_invite_timestamps: list[float] = field(default_factory=list)
    last_message_at: float = 0.0

    def clear_rate_limit_data(self) -> None:
        """Reset all rate-limit tracking data (for testing)."""
        self.rate_limit_lock = asyncio.Lock()
        self.message_timestamps.clear()
        self.channel_message_timestamps.clear()
        self.create_channel_timestamps.clear()
        self.create_invite_timestamps.clear()
        self.last_message_at = 0.0


_state = DiscordState()

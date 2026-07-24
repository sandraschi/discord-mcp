"""Prefab UI card tools for in-chat rich displays."""

from fastmcp import FastMCP
from fastmcp.tools import ToolResult
from prefab_ui import PrefabApp
from prefab_ui.components import Card, CardContent, CardHeader, CardTitle, Heading, Row, Text

from ..portmanteau import discord_tool


def register_prefab_tools(mcp: FastMCP) -> None:
    @mcp.tool(app=True)
    async def show_guilds_card() -> ToolResult:
        """Show Discord guilds as a rich card.

        Returns a Prefab card listing all guilds the bot can access with counts.
        Falls back to plain text for hosts that don't render Apps.
        """
        out = await discord_tool(ctx=None, operation="list_guilds")
        if not out.get("success"):
            return ToolResult(
                content=out.get("error", "Failed to fetch guilds"),
                is_error=True,
            )
        guilds = out.get("guilds", [])
        count = out.get("count", 0)
        if not guilds:
            return ToolResult(
                content="No guilds found. The bot has not been invited to any server.",
                is_error=False,
            )
        lines = [f"- **{g['name']}** (`{g['id']}`)" + (" *(owner)*" if g.get("owner") else "") for g in guilds]
        plain = f"**{count} guild(s):**\n" + "\n".join(lines)
        with PrefabApp(title=f"Guilds ({count})") as app:
            Heading(f"{count} guild(s)")
            for g in guilds:
                Row(label=g["name"], value=f"ID: {g['id']}")
        return ToolResult(content=plain, structured=app)

    @mcp.tool(app=True)
    async def show_guild_channels_card(guild_id: str) -> ToolResult:
        """Show channels in a guild as a rich card.

        Args:
            guild_id: Discord guild/snowflake ID.
        """
        out = await discord_tool(ctx=None, operation="list_channels", guild_id=guild_id)
        if not out.get("success"):
            return ToolResult(
                content=out.get("error", "Failed to fetch channels"),
                is_error=True,
            )
        channels = out.get("channels", [])
        type_names = {0: "Text", 2: "Voice", 4: "Category", 5: "Announcement"}
        if not channels:
            return ToolResult(
                content=f"No channels found or no permission for guild {guild_id}.",
                is_error=False,
            )
        lines = [f"- **{c['name']}** ({type_names.get(c['type'], str(c['type']))})" for c in channels]
        plain = f"**{len(channels)} channel(s):**\n" + "\n".join(lines)
        with PrefabApp(title=f"Channels ({len(channels)})") as app:
            Heading(f"{len(channels)} channel(s)")
            for c in channels:
                Row(label=c["name"], value=type_names.get(c["type"], str(c["type"])))
        return ToolResult(content=plain, structured=app)

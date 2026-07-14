# Discord MCP

FastMCP 3.2 Discord bridge with 36 portmanteau operations, LanceDB RAG, and sampling-based agentic workflows.

## Tools

- `discord(operation=...)` — consolidated portmanteau for all Discord operations (list_guilds, list_channels, send_message, get_messages, etc.)
- `discord_agentic_workflow(goal, ctx)` — multi-step agentic tasks via sampling
- `discord_help(topic)` — contextual help

## Environment

Set `DISCORD_TOKEN` in `.env` from Discord Developer Portal. Backend port 10756, webapp port 10757.

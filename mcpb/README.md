# discord-mcp (MCPB Bundle)

FastMCP 3.2 Discord MCP server with sampling, agentic workflow, and SOTA webapp

## Usage

Add to \claude_desktop_config.json\:
\\\json
{
  "mcpServers": {
    "discord-mcp": {
      "command": "uv",
      "args": ["run", "--directory", "\D:\Dev\repos", "python", "-m", "discord_mcp"],
      "env": { "PYTHONPATH": "\D:\Dev\repos/src" }
    }
  }
}
\\\

## Tools

- **discord_tool**: discord_tool

## Requirements

- Python 3.12+
- uv

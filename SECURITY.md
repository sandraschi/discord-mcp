# Security Policy

## Reporting a Vulnerability

The discord-mcp server handles Discord bot tokens which grant access to all guilds the bot is in. If you discover a security vulnerability, please report it privately.

**Do not open a public GitHub issue.**

Send details to the repository owner via the [Discord Developer Portal](https://discord.com/developers/applications) contact method, or open a private security advisory at:

https://github.com/sandraschi/discord-mcp/security/advisories/new

## What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact (token exposure, privilege escalation, data access)
- Suggested fix (if known)

## Response

You can expect acknowledgement within 48 hours and a fix timeline depending on severity.

## Best Practices

- Never commit `.env` files or bot tokens to git
- The `.env` file is loaded from the repo root at startup — ensure it's in `.gitignore`
- Use the `DISCORD_DEEPFANG_PREFLIGHT=1` environment variable to gate destructive operations in high-security environments
- Run the server bound to `127.0.0.1` only (default) unless you need remote access

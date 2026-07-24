# Discord vs Other Platforms

## Overview

Discord, Slack, Reddit, Telegram, and Microsoft Teams all serve different communication
needs. This doc covers where each fits and why Discord is the fleet's primary comms lane.

---

## Quick Comparison

| Dimension | Discord | Slack | Reddit | Telegram | Teams |
|-----------|---------|-------|--------|----------|-------|
| **Primary use** | Community chat | Workplace chat | Forum / link aggregation | Broadcast + groups | Enterprise meetings |
| **Guilds / servers** | ✅ Free, unlimited members | Paid per seat | Subreddits (public) | Groups + channels | Organisation tree |
| **Bot API** | ✅ Excellent, rich intents | ⚠️ Limited, user-scoped | ⚠️ Read-only (Pushshift nerfed) | ✅ Good, chat-focused | ❌ Graph API, restricted |
| **MCP suitability** | ✅ Full CRUD via bot token | ⚠️ No bot token for chat | ⚠️ No bot write access | ✅ Messages + groups | ❌ Enterprise lock |
| **Rate limits** | Generous (per-route 429) | Strict per-workspace | Very strict | Moderate | Graph throttling |
| **Message history** | Unlimited (fetchable) | Paid retention limits | Public, API-limited | Cloud-synced | Exchange-backed |
| **Voice / video** | Built-in | Huddles (paid) | None | Optional | Core feature |
| **Audit logging** | Built-in API | Workspace logs | Public moderation log | Admin logs | Compliance center |
| **Community culture** | Gaming → general communities | Professional, corporate | Anonymous, topic-focused | Broadcast, channels | Corporate hierarchy |

---

## Discord

**Strengths:**
- Best-in-class bot API with rich intents (messages, members, guilds, voice, audit)
- Free for unlimited servers and members
- Low latency gateway for real-time events
- Robust permission system (roles, channel-overrides, category inheritance)
- Built-in audit log accessible via API
- Community-first: servers can be public or private, discovery optional

**Weaknesses:**
- Bots limited to 10 servers unless verified
- No native thread persistence (active threads only)
- Voice/video quality degrades at scale
- Search is basic (no semantic/RAG built in — this is what discord-mcp adds)

**Best for:** Community management, gaming servers, fleet/devops alerting, moderation-heavy workflows, real-time chat + MCP orchestration.

---

## Slack

**Strengths:**
- Thread-first conversations (better for long-form discussion)
- Enterprise-grade compliance (audit, retention, eDiscovery)
- Integrations marketplace (Slack App Directory)

**Weaknesses:**
- **Extremely expensive** per seat for full history and features
- Bot API limited — no real "bot account" model like Discord; bots run as user apps
- No guild/server concept — workspaces are flat
- Free tier: 90-day message history, 10-app limit, 1:1 calls only
- MCP integration is possible via webhooks but no streamable HTTP bot model

**Best for:** Enterprise internal communication, paid workplace chat, compliance-heavy orgs.

---

## Reddit

**Strengths:**
- Public, searchable, topic-indexed (subreddits)
- Voting / ranking system for quality curation
- Huge public archive of discussion (though API access was restricted in 2023)

**Weaknesses:**
- **No bot write access** to threads or comments via the public API (locked behind developer review)
- Pushshift (historical data) API was effectively killed in 2023
- No real-time chat (Reddit Chat is separate and limited)
- Moderation is manual and tool-poor compared to Discord
- Not suitable for MCP — no bot token model, no webhook inbound/outbound

**Best for:** Public Q&A, link aggregation, long-form async discussion, community knowledge bases.

---

## Telegram

**Strengths:**
- Excellent bot API with rich message types (buttons, media, inline queries)
- Cloud-synced across devices, no history limits
- Channels (broadcast) + Groups (chat) + Supergroups (scalable)
- Free, no server limits
- Good for broadcast/notification use cases

**Weaknesses:**
- No guild/server hierarchy — flat group/channel model
- No role-based permissions system (admin vs member only)
- No audit log API
- Smaller developer ecosystem for MCP-style tool use
- Less suitable for complex community management

**Best for:** Broadcast channels, notification pipelines, lightweight group chat, regions where Telegram dominates (Eastern Europe, Asia).

---

## Microsoft Teams

**Strengths:**
- Deep Office 365 integration (SharePoint, OneDrive, Calendar)
- Enterprise compliance (eDiscovery, legal hold, DLP)
- Video meetings with recording and transcription

**Weaknesses:**
- **Extremely locked down** — Graph API is complex, rate-limited, and permission-scoped
- No bot token model — bots are Azure-registered apps with delegated permissions
- Channel history is Exchange-backed with retention policies
- Not suitable for MCP — no streamable HTTP, no gateway, no webhook events
- Terrible developer experience compared to Discord/Slack/Telegram

**Best for:** Large enterprises already in the Microsoft ecosystem, compliance-driven internal communication.

---

## Why Discord for the Fleet

The fleet chose Discord as its primary comms lane because:

1. **Bot API maturity** — discord-mcp exposes 36+ operations via a single portmanteau tool
2. **Real-time gateway** — the comms watcher can react to messages as they happen (not poll-only)
3. **Free and unlimited** — no per-seat cost, no message history paywall
4. **Rich permission model** — roles, channels, categories, per-channel overrides
5. **Audit log** — every moderation action is trackable via API
6. **MCP-friendly** — streamable HTTP at `/mcp`, stdio for local clients, full CRUD via REST

Other platforms fill specific niches (Reddit for public knowledge, Slack for corporate,
Telegram for broadcast), but Discord is the fleet's operational backbone for chat-based
automation and community management.

---

*See [TECHNICAL.md](TECHNICAL.md) for architecture, [TOOLS.md](TOOLS.md) for the full
operation reference, and [README.md](../README.md) for quick start.*

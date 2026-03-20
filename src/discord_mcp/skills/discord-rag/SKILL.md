---
name: discord-rag
description: Ingest channel messages into LanceDB and run semantic search (discord rag_ingest / rag_query).
---

# Discord MCP — RAG over messages

## When to use

You need semantic search over past messages in a channel (themes, decisions, support history).

## Steps

1. Resolve `channel_id` via `discord(operation='list_channels', guild_id='...')`.
2. Ingest: `discord(operation='rag_ingest', channel_id='...', limit=50, guild_name='...', channel_name='...', table_name='discord_messages')`.
3. Query: `discord(operation='rag_query', query_text='...', top_k=10, table_name='discord_messages')`.

## Notes

- Ingest pulls text via the same path as `get_messages`; large limits increase API load.
- Embeddings use local sentence-transformers + LanceDB paths under the server process.
- Prefer narrow queries; cite channel and message context when summarizing hits.

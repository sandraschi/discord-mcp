---
name: discord-rag
description: Ingest channel messages into LanceDB and run semantic search (discord rag_ingest / rag_query).
---

# Discord MCP — RAG over messages

**Description:** Turn Discord message history into a searchable knowledge base. Covers message indexing, semantic search across channels, user activity pattern extraction, topic clustering, and cross-channel knowledge retrieval.

## Trigger Phrases

- "Search past Discord messages about [topic]"
- "What was decided about [feature] in [channel]?"
- "Find all messages from [user] about [subject]"
- "Summarize the discussion in [channel] from last week"
- "What support questions were asked about [product]?"
- "Index channel [name] for semantic search"

## Tools

- `discord(operation='list_channels', guild_id='...')` — List available channels in a guild. Get channel_id for targeting.
- `discord(operation='get_messages', channel_id='...', limit=50)` — Raw message fetch without RAG.
- `discord(operation='rag_ingest', channel_id='...', limit=100, guild_name='...', channel_name='...', table_name='discord_messages')` — Ingest messages into LanceDB vector index. Embeds message content, author, and timestamp.
- `discord(operation='rag_query', query_text='...', top_k=10, table_name='discord_messages')` — Semantic search over ingested messages. Returns content + author + timestamp + channel context.

## Workflow

1. **Channel discovery**: Call `discord(operation='list_channels', guild_id='...')` to find the target channel. Note the channel_id.
2. **Ingest**: Call `discord(operation='rag_ingest', channel_id='...', limit=50)` to index recent messages. For full history, repeat with paginated limit calls.
3. **Query**: Use `discord(operation='rag_query', query_text='...', top_k=10)` for semantic search. Prefer narrow, specific queries for best results.
4. **Synthesis**: When returning results, cite channel, author, and timestamp. Summarize repeated themes across results.

## Notes

- Ingest pulls text via the same path as `get_messages`; large limits increase API load (rate limits apply).
- Embeddings use local sentence-transformers + LanceDB paths under the server process. No external API calls.
- Ingestion is incremental — re-ingesting the same channel with a higher limit adds new messages without duplicating.
- Prefer narrow queries; cite channel and message context when summarizing hits.
- `table_name` parameter allows multiple named indexes (e.g., per guild or per topic).

## Examples

- "Find discussion about the new authentication flow." → `rag_query(query_text="new authentication flow", top_k=10)`
- "Index the #support channel for RAG." → `rag_ingest(channel_id="123456", limit=200, guild_name="My Guild", channel_name="support")`
- "What did Alice say about deployment last month?" → `rag_query(query_text="Alice deployment", top_k=5)`

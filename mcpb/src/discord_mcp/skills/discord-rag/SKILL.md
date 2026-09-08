# Discord RAG Skill

## Overview

Retrieval-Augmented Generation over Discord message history. Ingest channel messages into a local LanceDB vector database, then search semantically — find messages about a topic even when the exact words don't match.

## How It Works

1. `rag_ingest(channel_id, limit=50)` fetches recent messages, generates embeddings via sentence-transformers (all-MiniLM-L6-v2), and stores them in LanceDB at `data/discord_lancedb`.
2. `rag_query(query_text, top_k=10)` finds the top_k most semantically similar messages and returns them with channel name, author, and timestamp.

Data persists across restarts. You can use different table_name values to organize data from different channels or servers.

## Workflow

### 1. Ingest Messages
```
discord(operation="rag_ingest", channel_id="...", limit=100)
```
Start with a reasonable limit (50-100 messages). Larger ingests take longer due to embedding generation.

### 2. Search
```
discord(operation="rag_query", query_text="discussion about deployment", top_k=10)
```
Prefer narrow, specific queries for best results.

### 3. Act on Results
The returned messages include channel_id, author, timestamp, and the message content. From here you can:
- Use `get_messages` to fetch the full thread context
- Use `send_message` to respond in the same channel
- Use `export_messages` to archive the discussion

## Tips

- Ingest separate channels into separate tables by setting `table_name="..."` — this keeps contexts clean.
- The first ingest call loads the embedding model (takes ~5-10s). Subsequent queries are fast.
- RAG requires `sentence-transformers` and its dependencies (installed via `uv sync --extra rag`).
- Data is local-only. No external API calls are made during ingest or query.

## Env Dependencies

- `LANCEDB_DISCORD_PATH` — Override LanceDB storage path (default: `data/discord_lancedb`).

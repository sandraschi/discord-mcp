import uvicorn
from discord_mcp import app
# ... [Assume lines 1-402 of existing content]

if __name__ == "__main__":
    uvicorn.run("discord_mcp.server:app", host="127.0.0.1", port=8000, reload=True)
# ... [Assume lines 404+ of existing content]
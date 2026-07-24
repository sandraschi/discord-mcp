"""Live integration tests for guild operations."""

import pytest


@pytest.mark.live
def test_list_guilds(live_client):
    r = live_client.get("/api/v1/guilds")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert isinstance(body.get("guilds"), list)
    assert body["count"] > 0
    guild = body["guilds"][0]
    assert "id" in guild
    assert "name" in guild


@pytest.mark.live
def test_guild_stats(live_client, guild_id):
    r = live_client.get(f"/api/v1/guilds/{guild_id}/stats")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True

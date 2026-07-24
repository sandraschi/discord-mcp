"""Live integration tests for channel CRUD."""

import pytest


@pytest.mark.live
def test_list_channels(live_client, guild_id):
    r = live_client.get(f"/api/v1/guilds/{guild_id}/channels")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert isinstance(body.get("channels"), list)


@pytest.mark.live
def test_create_and_delete_channel(live_client, guild_id):
    # Create
    r = live_client.post(f"/api/v1/guilds/{guild_id}/channels", json={"name": "test-live-crud", "type": 0})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    channel_id = body["channel_id"]
    assert channel_id is not None

    # Verify it appears in list
    r2 = live_client.get(f"/api/v1/guilds/{guild_id}/channels")
    ids = [c["id"] for c in r2.json().get("channels", [])]
    assert channel_id in ids

    # Delete
    r3 = live_client.delete(f"/api/v1/channels/{channel_id}")
    assert r3.status_code == 200
    assert r3.json()["deleted"] is True

    # Verify gone from list
    r4 = live_client.get(f"/api/v1/guilds/{guild_id}/channels")
    ids_after = [c["id"] for c in r4.json().get("channels", [])]
    assert channel_id not in ids_after


@pytest.mark.live
def test_create_channel_missing_name(live_client, guild_id):
    r = live_client.post(f"/api/v1/guilds/{guild_id}/channels", json={"type": 0})
    assert r.status_code == 422

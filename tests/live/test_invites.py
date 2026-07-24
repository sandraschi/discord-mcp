"""Live integration tests for invite create/revoke."""

import pytest


@pytest.mark.live
def test_create_and_revoke_invite(live_client, test_channel, guild_id):
    # Create invite
    r = live_client.post(
        f"/api/v1/channels/{test_channel}/invites",
        json={"max_age": 3600, "max_uses": 1},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    invite_code = body.get("code")
    assert invite_code is not None

    # List invites to confirm our code is in the list
    r2 = live_client.get(f"/api/v1/guilds/{guild_id}/invites")
    assert r2.status_code == 200
    codes = [i["code"] for i in r2.json().get("invites", [])]
    assert invite_code in codes

    # Revoke
    r3 = live_client.delete(f"/api/v1/invites/{invite_code}")
    assert r3.status_code == 200
    assert r3.json()["success"] is True

"""Live integration tests for message send/list/delete."""

import pytest


@pytest.mark.live
def test_send_and_list_messages(live_client, test_channel):
    channel_id = test_channel

    # Send a message
    r = live_client.post(f"/api/v1/channels/{channel_id}/messages", json={"content": "hello from live test"})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    msg_id = body.get("message_id")
    assert msg_id is not None

    # List messages and verify our message is there
    r2 = live_client.get(f"/api/v1/channels/{channel_id}/messages?limit=10")
    assert r2.status_code == 200
    messages = r2.json().get("messages", [])
    assert any(m["id"] == msg_id for m in messages)

    # Delete the message
    r3 = live_client.delete(f"/api/v1/channels/{channel_id}/messages/{msg_id}")
    assert r3.status_code == 200

    # Verify deletion
    r4 = live_client.get(f"/api/v1/channels/{channel_id}/messages?limit=10")
    assert all(m["id"] != msg_id for m in r4.json().get("messages", []))


@pytest.mark.live
def test_send_message_empty_body(live_client, test_channel):
    r = live_client.post(f"/api/v1/channels/{test_channel}/messages", json={"content": ""})
    assert r.status_code == 422

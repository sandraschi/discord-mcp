"""Fixtures for live integration tests — require a running backend on 10756."""

import os
from datetime import datetime

import httpx
import pytest

BACKEND = os.environ.get("DISCORD_LIVE_TEST_URL", "http://127.0.0.1:10756")
GUILD_ID = os.environ.get("DISCORD_TEST_GUILD_ID")


@pytest.fixture(scope="session")
def live_client():
    """httpx client pointed at the running backend."""
    with httpx.Client(base_url=BACKEND, timeout=15) as c:
        yield c


def pytest_configure(config):
    config.addinivalue_line("markers", "live: integration test that hits a running backend")


def pytest_collection_modifyitems(config, items):
    if config.getoption("-m") == "live" or os.environ.get("DISCORD_LIVE_TEST"):
        return
    for item in list(items):
        if item.get_closest_marker("live"):
            item.add_marker(pytest.mark.skip(reason="use -m live or set DISCORD_LIVE_TEST=1"))


@pytest.fixture
def guild_id(live_client):
    if GUILD_ID:
        return GUILD_ID
    r = live_client.get("/api/v1/guilds")
    r.raise_for_status()
    guilds = r.json().get("guilds", [])
    if not guilds:
        pytest.skip("No guilds available — invite the bot to a server first")
    return guilds[0]["id"]


@pytest.fixture
def test_channel(live_client, guild_id):
    """Create a temporary channel, yield its id, delete on teardown."""
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    r = live_client.post(f"/api/v1/guilds/{guild_id}/channels", json={"name": f"test-live-{ts}", "type": 0})
    r.raise_for_status()
    channel_id = r.json()["channel_id"]
    yield channel_id
    try:
        live_client.delete(f"/api/v1/channels/{channel_id}")
    except Exception:
        pass

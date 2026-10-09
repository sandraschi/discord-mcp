"""Regression test for POST /api/shutdown (NSSM orderly-exit contract)."""

from fastapi.testclient import TestClient

from discord_mcp import server as srv


def test_shutdown_responds_and_schedules_exit():
    with TestClient(srv.app) as client:
        try:
            r = client.post("/api/shutdown")
            assert r.status_code == 200
            assert r.json() == {"status": "shutting_down"}
            assert srv._SHUTTING_DOWN is True
        finally:
            # Never let the delayed os._exit(0) fire inside the test runner.
            task = srv._exit_task
            if task is not None and not task.done():
                task.cancel()
            srv._SHUTTING_DOWN = False
            srv._exit_task = None

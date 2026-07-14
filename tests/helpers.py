"""Shared httpx mock helpers for portmanteau tests."""

from __future__ import annotations

import httpx


def discord_response(
    status_code: int,
    *,
    json_body: dict | list | None = None,
    method: str = "GET",
    url: str = "https://discord.com/api/v10/test",
) -> httpx.Response:
    request = httpx.Request(method, url)
    if json_body is not None:
        return httpx.Response(status_code, json=json_body, request=request)
    return httpx.Response(status_code, request=request)

"""Unit tests for the message watcher active-window schedule."""

from datetime import datetime

from discord_mcp.message_watcher import _in_active_window


def _dt(day: int, hour: int, minute: int = 0) -> datetime:
    # 2026-08-17 is a Monday (weekday 0)
    base = datetime(2026, 8, 17, 0, 0)
    return base.replace(day=base.day + day, hour=hour, minute=minute)


def test_no_schedule_always_active():
    assert _in_active_window({}) is True
    assert _in_active_window({"mode": "gateway"}) is True


def test_weekday_window():
    cfg = {"schedule": {"tz": "UTC", "windows": [{"days": "wd", "start": "09:00", "end": "17:00"}]}}
    assert _in_active_window(cfg, _dt(0, 10, 0)) is True  # Monday 10:00
    assert _in_active_window(cfg, _dt(0, 8, 59)) is False  # Monday 08:59
    assert _in_active_window(cfg, _dt(4, 16, 59)) is True  # Friday 16:59
    assert _in_active_window(cfg, _dt(5, 10, 0)) is False  # Saturday 10:00
    assert _in_active_window(cfg, _dt(6, 10, 0)) is False  # Sunday 10:00


def test_weekend_window():
    cfg = {"schedule": {"windows": [{"days": "we", "start": "00:00", "end": "23:59"}]}}
    assert _in_active_window(cfg, _dt(5, 12, 0)) is True  # Saturday
    assert _in_active_window(cfg, _dt(0, 12, 0)) is False  # Monday


def test_overnight_window_wraps():
    cfg = {"schedule": {"windows": [{"days": "all", "start": "22:00", "end": "06:00"}]}}
    assert _in_active_window(cfg, _dt(0, 23, 30)) is True  # 23:30
    assert _in_active_window(cfg, _dt(1, 3, 0)) is True  # 03:00 next day
    assert _in_active_window(cfg, _dt(0, 12, 0)) is False  # 12:00 outside


def test_explicit_day_list():
    cfg = {"schedule": {"windows": [{"days": "0,2,4", "start": "00:00", "end": "23:59"}]}}
    assert _in_active_window(cfg, _dt(0, 9, 0)) is True  # Monday
    assert _in_active_window(cfg, _dt(2, 9, 0)) is True  # Wednesday
    assert _in_active_window(cfg, _dt(1, 9, 0)) is False  # Tuesday


def test_end_boundary_is_exclusive():
    cfg = {"schedule": {"windows": [{"days": "all", "start": "09:00", "end": "10:00"}]}}
    assert _in_active_window(cfg, _dt(0, 10, 0)) is False
    assert _in_active_window(cfg, _dt(0, 9, 59)) is True

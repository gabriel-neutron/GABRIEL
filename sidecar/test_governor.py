"""
Governor tests (Slice 3, docs/timelines/TELEGRAM_TIMELINE.md) — real temp-SQLite-file
tests (`tgdb_path` fixture, same pattern as `sidecar/test_collector.py`), fake clock
(`monkeypatch`s `governor._now`/`governor.asyncio.sleep`, same no-real-sleep pattern as
`sidecar/test_choke.py`), never a live Telegram call.
"""

import inspect
from datetime import datetime, timedelta, timezone
from pathlib import Path

import aiosqlite
import pytest
import pytest_asyncio
from telethon.errors import FloodWaitError, PeerFloodError

from sidecar import db, governor
from sidecar.rate_limiter import AccountHardStopped


class _FakeRequest:
    pass


def _flood_wait(seconds: int) -> FloodWaitError:
    return FloodWaitError(_FakeRequest(), capture=seconds)


@pytest_asyncio.fixture
async def tgdb_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.tgdb"
    await db.init_db(path)
    return path


@pytest.fixture(autouse=True)
def _no_real_sleep(monkeypatch):
    async def _no_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(governor.asyncio, "sleep", _no_sleep)
    yield
    governor.reset_run_for_tests()


def _freeze(monkeypatch, when: datetime) -> None:
    monkeypatch.setattr(governor, "_now", lambda: when)


NOW = datetime(2026, 7, 22, 12, 0, 0, tzinfo=timezone.utc)


async def _make_call(path, call_type: str, rpc=None):
    @governor.governed_rpc(call_type)
    async def _rpc():
        if rpc is not None:
            return await rpc()
        return "ok"

    governor.set_ledger_path_for_tests(path)
    try:
        return await _rpc()
    finally:
        governor.reset_ledger_path_for_tests()


@pytest.mark.asyncio
async def test_governed_call_succeeds_and_delays(monkeypatch, tgdb_path):
    _freeze(monkeypatch, NOW)
    assert await _make_call(tgdb_path, "metadata") == "ok"


@pytest.mark.asyncio
async def test_per_type_hourly_ceiling_enforced(monkeypatch, tgdb_path):
    """warmup fraction at first-ever call is WARMUP_START_FRACTION (0.2), so the
    effective ceiling for "resolve" (coded ceiling 15) is floor(15*0.2) == 3."""
    _freeze(monkeypatch, NOW)

    for _ in range(3):
        await _make_call(tgdb_path, "resolve")

    with pytest.raises(governor.BudgetCeilingExceeded):
        await _make_call(tgdb_path, "resolve")


@pytest.mark.asyncio
async def test_global_hourly_ceiling_enforced_across_types(monkeypatch, tgdb_path):
    """Global ceiling (45) scaled by warmup fraction (0.2) = floor(45*0.2) == 9, well
    below the sum of the individual per-type warmup-scaled ceilings (3+4+6=13), proving
    the global cap catches a spike that no single per-type cap would."""
    _freeze(monkeypatch, NOW)

    calls = 0
    with pytest.raises(governor.BudgetCeilingExceeded):
        for call_type in ["metadata", "history", "resolve"] * 5:
            await _make_call(tgdb_path, call_type)
            calls += 1

    assert calls == 9


@pytest.mark.asyncio
async def test_ceiling_resets_after_hour_window_rolls_over(monkeypatch, tgdb_path):
    _freeze(monkeypatch, NOW)
    for _ in range(3):
        await _make_call(tgdb_path, "resolve")
    with pytest.raises(governor.BudgetCeilingExceeded):
        await _make_call(tgdb_path, "resolve")

    _freeze(monkeypatch, NOW + timedelta(hours=1, seconds=1))
    assert await _make_call(tgdb_path, "resolve") == "ok"


@pytest.mark.asyncio
async def test_daily_ceiling_enforced_independent_of_hour_rollover(monkeypatch, tgdb_path):
    """Even once the hourly window rolls over, the rolling daily cap still blocks
    further calls within the same 24h day window. Fixes warm-up at 100% first (fraction
    would otherwise keep growing hour over hour and this test would need to race a
    moving ceiling) by seeding `first_call_at` far enough in the past, then burns
    exactly the per-type hourly ceiling (30, well under the global ceiling of 45) each
    hour until the fixed daily ceiling (250) is hit."""
    _freeze(monkeypatch, NOW)
    await _make_call(tgdb_path, "metadata")  # seeds first_call_at

    warm_base = NOW + timedelta(days=governor.WARMUP_DAYS + 1)
    calls = 0
    hour = 0
    with pytest.raises(governor.BudgetCeilingExceeded):
        while True:
            _freeze(monkeypatch, warm_base + timedelta(hours=hour, seconds=1))
            for _ in range(governor.CALL_TYPE_HOURLY_CEILINGS["metadata"]):
                await _make_call(tgdb_path, "metadata")
                calls += 1
            hour += 1

    assert calls == governor.DAILY_CEILING


@pytest.mark.asyncio
async def test_warmup_ramp_scales_ceiling_up_over_days(monkeypatch, tgdb_path):
    _freeze(monkeypatch, NOW)
    await _make_call(tgdb_path, "resolve")  # sets first_call_at

    # 7 days later, warmup is complete -> full coded ceiling (15) applies.
    _freeze(monkeypatch, NOW + timedelta(days=governor.WARMUP_DAYS, hours=1))
    for _ in range(15):
        await _make_call(tgdb_path, "resolve")
    with pytest.raises(governor.BudgetCeilingExceeded):
        await _make_call(tgdb_path, "resolve")


@pytest.mark.asyncio
async def test_ledger_persists_across_simulated_restart(monkeypatch, tgdb_path):
    """Writes via one 'governor instance', then reads the row back with a brand-new raw
    `aiosqlite` connection — as a freshly booted process would, with nothing left in
    memory — proving the counters live in the file, not a process-lifetime global (the
    anti-pattern `choke.py`'s `_cold_start_call_count` module global is)."""
    _freeze(monkeypatch, NOW)
    for _ in range(3):
        await _make_call(tgdb_path, "resolve")

    # No governor module state is read here at all — a fresh connection opened as if
    # this were a brand-new process after a restart.
    async with aiosqlite.connect(tgdb_path) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute("SELECT resolve_count, first_call_at FROM governor_ledger WHERE id = 1")
        row = await cursor.fetchone()
    assert row["resolve_count"] == 3
    assert row["first_call_at"] is not None

    # And the "restarted" governor still enforces the ceiling using that surviving count.
    with pytest.raises(governor.BudgetCeilingExceeded):
        await _make_call(tgdb_path, "resolve")


@pytest.mark.asyncio
async def test_no_kwarg_can_raise_or_bypass_a_ceiling():
    """No parameter on `governed_rpc` accepts a ceiling override — mirrors
    `test_choke.py::test_cold_start_ceiling_is_not_configurable_per_call`."""
    sig = inspect.signature(governor.governed_rpc)
    assert set(sig.parameters) == {"call_type"}

    with pytest.raises(TypeError):
        governor.governed_rpc("metadata", ceiling=999999)  # type: ignore[call-arg]


@pytest.mark.asyncio
async def test_unknown_call_type_rejected():
    with pytest.raises(ValueError):
        governor.governed_rpc("participants")


@pytest.mark.asyncio
async def test_peer_flood_error_trips_kill_switch_and_blocks_subsequent_calls(monkeypatch, tgdb_path):
    _freeze(monkeypatch, NOW)

    async def _raise_peer_flood():
        raise PeerFloodError(_FakeRequest())

    with pytest.raises(AccountHardStopped):
        await _make_call(tgdb_path, "metadata", rpc=_raise_peer_flood)

    assert await governor.is_kill_switch_tripped(tgdb_path) is True

    with pytest.raises(governor.GovernorKillSwitchTripped):
        await _make_call(tgdb_path, "history")


@pytest.mark.asyncio
async def test_kill_switch_only_clears_manually(monkeypatch, tgdb_path):
    _freeze(monkeypatch, NOW)
    await governor.trip_kill_switch("manual test trip", tgdb_path)

    with pytest.raises(governor.GovernorKillSwitchTripped):
        await _make_call(tgdb_path, "metadata")

    await governor.clear_kill_switch(tgdb_path)
    assert await _make_call(tgdb_path, "metadata") == "ok"


@pytest.mark.asyncio
async def test_flood_wait_error_triggers_cooldown_and_shrinks_effective_ceiling(monkeypatch, tgdb_path):
    _freeze(monkeypatch, NOW)

    attempts = {"n": 0}

    async def _flaky():
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise _flood_wait(seconds=1)  # with_flood_wait_retry sleeps this for real
            # (rate_limiter.py, unpatched here — same as test_choke.py's equivalent
            # retry test), so kept short.
        return "ok"

    # with_flood_wait_retry retries once and succeeds; a cooldown is now active.
    assert await _make_call(tgdb_path, "metadata", rpc=_flaky) == "ok"

    async with aiosqlite.connect(tgdb_path) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute("SELECT cooldown_multiplier, cooldown_until FROM governor_ledger WHERE id = 1")
        row = await cursor.fetchone()

    assert row["cooldown_multiplier"] < 1.0
    assert row["cooldown_until"] is not None


@pytest.mark.asyncio
async def test_repeated_flood_waits_within_an_hour_auto_tighten(monkeypatch, tgdb_path):
    _freeze(monkeypatch, NOW)
    await governor._record_flood_wait(tgdb_path, NOW)
    await governor._record_flood_wait(tgdb_path, NOW + timedelta(minutes=10))

    async with aiosqlite.connect(tgdb_path) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute(
            "SELECT cooldown_tighten_level, cooldown_multiplier FROM governor_ledger WHERE id = 1"
        )
        row = await cursor.fetchone()

    assert row["cooldown_tighten_level"] >= 1
    assert row["cooldown_multiplier"] < governor.COOLDOWN_BASE_MULTIPLIER


@pytest.mark.asyncio
async def test_per_run_ceiling_auto_pause_primitive(monkeypatch, tgdb_path):
    _freeze(monkeypatch, NOW)
    governor.start_run(ceiling=2)
    assert governor.is_run_ceiling_hit() is False

    await _make_call(tgdb_path, "metadata")
    assert governor.is_run_ceiling_hit() is False

    await _make_call(tgdb_path, "metadata")
    assert governor.is_run_ceiling_hit() is True


@pytest.mark.asyncio
async def test_run_not_started_never_reports_ceiling_hit(monkeypatch, tgdb_path):
    _freeze(monkeypatch, NOW)
    assert governor.is_run_ceiling_hit() is False
    await _make_call(tgdb_path, "metadata")
    assert governor.is_run_ceiling_hit() is False

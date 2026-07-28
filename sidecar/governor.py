"""
The hardened rate governor (Slice 3, docs/timelines/TELEGRAM_TIMELINE.md) —
promotes Slice 1's minimal choke (`sidecar/choke.py`) into the full, non-bypassable
governor. Still the single choke-point inside `TelethonChannelSource` — there is no
other path to Telegram than through `governed_rpc`.

Composition per call (same shape as `choke.choked_rpc`, so `with_flood_wait_retry`'s
retry-then-`PeerFloodError`-conversion behavior is unchanged — this module composes
around it, it does not duplicate it):

    with_flood_wait_retry()(
        kill-switch check -> budget/ceiling check -> warm-up/cooldown-scaled jittered
        delay -> call the wrapped rpc -> on PeerFloodError: trip kill switch, re-raise
        -> on FloodWaitError: record the event (feeds cooldown/auto-tighten), re-raise
    )

`governed()`/`choked_rpc` remain in `sidecar/choke.py` unchanged and still pass their
own tests as tests of the underlying delay primitive — this module reuses
`choke.BASE_DELAY_SECONDS`/`choke.JITTER_SECONDS` as its floor delay rather than
duplicating them, but does NOT reuse `choke`'s in-memory `_cold_start_call_count`
global; that counter is the anti-pattern this promotion replaces with a persistent
SQLite ledger (`governor_ledger`, `sidecar/db.py`) reloaded fresh on every governed
call, so a crash or `uvicorn --reload` cannot reset the hourly/daily counts, the
warm-up clock, the cooldown state, or the kill-switch latch.

All ceiling numbers below are still placeholder-conservative. Slice 0's measurement
(`sidecar/validation/RESULTS.md`) only established ">40 calls" of tight-loop
`get_messages` on one channel with zero FloodWait in one short burst — nowhere near
enough data to derive a real steady-state hourly ceiling, just enough to know 15
(choke's old cold-start cap) was over-conservative and pick something a little less so.
Revisit once the canary (Slice 6) produces more live data.

Config may only *tighten* these; nothing here is read from any env var or config file,
so nothing can loosen them from a call site — see
`test_governor.py::test_no_kwarg_can_raise_or_bypass_a_ceiling`. The only way to loosen
a ceiling is to edit this source file.
"""

import asyncio
import functools
import json
import math
import random
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable, ParamSpec, TypeVar

import aiosqlite
from telethon.errors import FloodWaitError, PeerFloodError

from sidecar import choke
from sidecar.db import DEFAULT_TGDB_PATH
from sidecar.logging_config import logger
from sidecar.rate_limiter import with_flood_wait_retry

P = ParamSpec("P")
T = TypeVar("T")

# --- Coded ceilings (hard floors — see module docstring) -------------------------------
CALL_TYPE_HOURLY_CEILINGS = {
    "metadata": 30,
    "history": 20,
    "resolve": 15,
}
# Deliberately below the sum of the per-type ceilings (65) so per-type caps can't sum
# into a spike — see acceptance criteria in the Slice 3 issue.
GLOBAL_HOURLY_CEILING = 45
DAILY_CEILING = 250

BASE_DELAY_SECONDS = choke.BASE_DELAY_SECONDS
JITTER_SECONDS = choke.JITTER_SECONDS

# Warm-up ramp: effective ceiling starts at WARMUP_START_FRACTION of the coded ceiling
# and scales linearly to 100% over WARMUP_DAYS, measured from the ledger's
# `first_call_at` (persisted, so a restart doesn't reset the ramp clock).
WARMUP_START_FRACTION = 0.2
WARMUP_DAYS = 7

# Post-FloodWait cooldown: halves the effective budget and lengthens delays for a
# window; recurring FloodWaits (>1/hr) auto-tighten further (window doubles, multiplier
# halves again each additional recurrence within the window).
COOLDOWN_BASE_MULTIPLIER = 0.5
COOLDOWN_BASE_WINDOW_SECONDS = 3600
COOLDOWN_DELAY_MULTIPLIER = 2.0
MIN_COOLDOWN_MULTIPLIER = 0.05
FLOOD_WAIT_TIGHTEN_WINDOW_SECONDS = 3600

# Per-run ceiling primitive (Slice 5's crawler wiring auto-pauses on this — not built
# here). In-memory only; a fresh run is a fresh human decision to continue, so it does
# not need to survive a restart the way the hourly/daily ledger does.
PER_RUN_CALL_CEILING = 50


class BudgetCeilingExceeded(Exception):
    """Raised when a governed call would exceed the per-type, global hourly, or daily
    ceiling (each already scaled by warm-up ramp and any active cooldown). Not
    recoverable by retrying immediately — the caller must wait for the relevant window
    to roll over."""


class GovernorKillSwitchTripped(Exception):
    """Raised by every governed call once the kill switch is tripped (manually, or
    automatically on `PeerFloodError`). Only `clear_kill_switch()` — a deliberate human
    action — lifts this."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


# --- Ledger reads/writes -----------------------------------------------------------
# Every function below reloads (or writes straight through to) the SQLite ledger row —
# nothing is cached in a module-level variable — so "restart the process" and "call it
# again in the same process" are indistinguishable to the governor. That is what makes
# the cross-restart persistence acceptance criterion true almost for free.


async def _ensure_row(conn: aiosqlite.Connection) -> None:
    await conn.execute("INSERT OR IGNORE INTO governor_ledger (id) VALUES (1)")


async def _load_row(conn: aiosqlite.Connection) -> aiosqlite.Row:
    conn.row_factory = aiosqlite.Row
    await _ensure_row(conn)
    cursor = await conn.execute("SELECT * FROM governor_ledger WHERE id = 1")
    row = await cursor.fetchone()
    assert row is not None
    return row


def _warmup_fraction(first_call_at: str | None, now: datetime) -> float:
    if not first_call_at:
        return WARMUP_START_FRACTION
    elapsed_days = max(0.0, (now - _parse(first_call_at)).total_seconds() / 86400)
    if elapsed_days >= WARMUP_DAYS:
        return 1.0
    progress = elapsed_days / WARMUP_DAYS
    return WARMUP_START_FRACTION + (1 - WARMUP_START_FRACTION) * progress


def _active_cooldown_multiplier(row: aiosqlite.Row, now: datetime) -> float:
    cooldown_until = _parse(row["cooldown_until"])
    if cooldown_until is not None and now < cooldown_until:
        return row["cooldown_multiplier"]
    return 1.0


def _effective_ceiling(base: int, warmup_fraction: float, cooldown_multiplier: float) -> int:
    return max(1, math.floor(base * warmup_fraction * cooldown_multiplier))


async def _reserve_call_slot(path, call_type: str, now: datetime) -> tuple[bool, int]:
    """Kill-switch check -> window rollover -> ceiling check -> increment, all in one
    transaction against the ledger row. Returns `(in_cooldown, cooldown_tighten_level)`
    for the delay calculation. Raises `GovernorKillSwitchTripped` or
    `BudgetCeilingExceeded` without incrementing anything."""
    async with aiosqlite.connect(path) as conn:
        row = await _load_row(conn)

        if row["kill_switch_tripped"]:
            raise GovernorKillSwitchTripped(
                row["kill_switch_reason"] or "governor kill switch is tripped; call "
                "governor.clear_kill_switch() to resume — deliberate human action only."
            )

        first_call_at = row["first_call_at"] or now.isoformat()
        hour_window_start = row["hour_window_start"]
        day_window_start = row["day_window_start"]
        counts = {
            "metadata": row["metadata_count"],
            "history": row["history_count"],
            "resolve": row["resolve_count"],
        }
        daily_count = row["daily_count"]

        if not hour_window_start or now - _parse(hour_window_start) >= timedelta(hours=1):
            hour_window_start = now.isoformat()
            counts = {k: 0 for k in counts}
        if not day_window_start or now - _parse(day_window_start) >= timedelta(hours=24):
            day_window_start = now.isoformat()
            daily_count = 0

        warmup_fraction = _warmup_fraction(row["first_call_at"], now)
        cooldown_multiplier = _active_cooldown_multiplier(row, now)

        type_ceiling = _effective_ceiling(
            CALL_TYPE_HOURLY_CEILINGS[call_type], warmup_fraction, cooldown_multiplier
        )
        global_ceiling = _effective_ceiling(GLOBAL_HOURLY_CEILING, warmup_fraction, cooldown_multiplier)
        daily_ceiling = _effective_ceiling(DAILY_CEILING, warmup_fraction, cooldown_multiplier)

        if counts[call_type] + 1 > type_ceiling:
            raise BudgetCeilingExceeded(
                f"{call_type} hourly ceiling ({type_ceiling}, warmup={warmup_fraction:.2f}, "
                f"cooldown={cooldown_multiplier:.2f}) reached"
            )
        if sum(counts.values()) + 1 > global_ceiling:
            raise BudgetCeilingExceeded(f"global hourly ceiling ({global_ceiling}) reached")
        if daily_count + 1 > daily_ceiling:
            raise BudgetCeilingExceeded(f"daily ceiling ({daily_ceiling}) reached")

        counts[call_type] += 1
        daily_count += 1

        await conn.execute(
            """
            UPDATE governor_ledger
            SET first_call_at = ?, hour_window_start = ?, day_window_start = ?,
                metadata_count = ?, history_count = ?, resolve_count = ?, daily_count = ?
            WHERE id = 1
            """,
            (
                first_call_at,
                hour_window_start,
                day_window_start,
                counts["metadata"],
                counts["history"],
                counts["resolve"],
                daily_count,
            ),
        )
        await conn.commit()

        return cooldown_multiplier < 1.0, row["cooldown_tighten_level"]


async def _delay(in_cooldown: bool, tighten_level: int) -> None:
    delay = BASE_DELAY_SECONDS + random.uniform(0, JITTER_SECONDS)
    if in_cooldown:
        delay *= COOLDOWN_DELAY_MULTIPLIER * (tighten_level + 1)
    logger.info("governor: delaying %.2fs (cooldown=%s, tighten_level=%d)", delay, in_cooldown, tighten_level)
    await asyncio.sleep(delay)


async def _record_flood_wait(path, now: datetime) -> None:
    """Halves the effective budget (via `cooldown_multiplier`) and opens a cooldown
    window; a FloodWait recurring more than once within `FLOOD_WAIT_TIGHTEN_WINDOW_SECONDS`
    bumps `cooldown_tighten_level`, which both lengthens the window and lowers the
    multiplier further on the next recurrence."""
    async with aiosqlite.connect(path) as conn:
        row = await _load_row(conn)

        events = json.loads(row["flood_wait_events_json"] or "[]")
        events.append(now.isoformat())
        cutoff = now - timedelta(seconds=FLOOD_WAIT_TIGHTEN_WINDOW_SECONDS)
        events = [e for e in events if _parse(e) >= cutoff]

        tighten_level = row["cooldown_tighten_level"]
        if len(events) > 1:
            # More than one FloodWait inside the tighten window (including this one) —
            # recurring, so auto-tighten further.
            tighten_level += 1

        multiplier = max(MIN_COOLDOWN_MULTIPLIER, COOLDOWN_BASE_MULTIPLIER * (0.5**tighten_level))
        window_seconds = COOLDOWN_BASE_WINDOW_SECONDS * (2**tighten_level)
        cooldown_until = (now + timedelta(seconds=window_seconds)).isoformat()

        await conn.execute(
            """
            UPDATE governor_ledger
            SET flood_wait_events_json = ?, cooldown_tighten_level = ?,
                cooldown_multiplier = ?, cooldown_until = ?
            WHERE id = 1
            """,
            (json.dumps(events), tighten_level, multiplier, cooldown_until),
        )
        await conn.commit()
    logger.warning(
        "governor: FloodWaitError recorded — cooldown multiplier=%.3f until %s (tighten_level=%d)",
        multiplier,
        cooldown_until,
        tighten_level,
    )


# --- Kill switch --------------------------------------------------------------------


async def trip_kill_switch(reason: str, path=DEFAULT_TGDB_PATH) -> None:
    async with aiosqlite.connect(path) as conn:
        await _ensure_row(conn)
        await conn.execute(
            "UPDATE governor_ledger SET kill_switch_tripped = 1, kill_switch_reason = ? WHERE id = 1",
            (reason,),
        )
        await conn.commit()
    logger.error("governor: kill switch tripped — %s", reason)


async def clear_kill_switch(path=DEFAULT_TGDB_PATH) -> None:
    """Deliberate human action — no code path in this module calls this automatically."""
    async with aiosqlite.connect(path) as conn:
        await _ensure_row(conn)
        await conn.execute(
            "UPDATE governor_ledger SET kill_switch_tripped = 0, kill_switch_reason = NULL WHERE id = 1"
        )
        await conn.commit()
    logger.warning("governor: kill switch manually cleared")


async def is_kill_switch_tripped(path=DEFAULT_TGDB_PATH) -> bool:
    async with aiosqlite.connect(path) as conn:
        row = await _load_row(conn)
        return bool(row["kill_switch_tripped"])


# --- Per-run ceiling ------------------------------------------------------------------
# In-memory only — see module docstring. `start_run` is called once per crawl run
# (Slice 5), `record_run_call` fires automatically from every `governed_rpc` call while
# a run is active, `is_run_ceiling_hit` is polled by the crawler to decide whether to
# auto-pause for human confirmation.


class RunBudget:
    def __init__(self, ceiling: int) -> None:
        self.ceiling = ceiling
        self.count = 0

    def record_call(self) -> None:
        self.count += 1

    def is_ceiling_hit(self) -> bool:
        return self.count >= self.ceiling


_current_run: RunBudget | None = None


def start_run(ceiling: int = PER_RUN_CALL_CEILING) -> RunBudget:
    """Starts (or restarts) the current run's call-count tracking. Returns the new
    `RunBudget` so a caller can also poll `.count` directly if useful."""
    global _current_run
    _current_run = RunBudget(ceiling)
    return _current_run


def record_run_call() -> None:
    if _current_run is not None:
        _current_run.record_call()


def is_run_ceiling_hit() -> bool:
    return _current_run is not None and _current_run.is_ceiling_hit()


def reset_run_for_tests() -> None:
    """Test-only helper — production code starts a run via `start_run`, never resets it
    to `None` mid-process."""
    global _current_run
    _current_run = None


# --- Ledger path (test seam) --------------------------------------------------------
# `governed_rpc` is applied as a decorator at *import* time (e.g.
# `@governed_rpc("metadata")` in `telegram_channel_source.py`), so a `path=...`
# parameter on `governed_rpc` itself would bind once at decoration time and could never
# be pointed at a test's temp SQLite file per-test. Instead the path is resolved lazily,
# on every call, from this module-level default — tests swap it with
# `set_ledger_path_for_tests` the same way `choke.py`'s tests reset its module global.
# Production code never calls the setter.
_ledger_path = DEFAULT_TGDB_PATH


def set_ledger_path_for_tests(path) -> None:
    global _ledger_path
    _ledger_path = path


def reset_ledger_path_for_tests() -> None:
    global _ledger_path
    _ledger_path = DEFAULT_TGDB_PATH


# --- The decorator factory ------------------------------------------------------------


def governed_rpc(call_type: str) -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
    """`@governor.governed_rpc("metadata")` — the promoted, single choke-point every
    Telegram RPC in `TelethonChannelSource` must be wrapped with (replacing
    `choke.choked_rpc` for these call sites; see module docstring). `call_type` must be
    one of `CALL_TYPE_HOURLY_CEILINGS`'s keys — there is deliberately no ceiling
    override parameter here or anywhere else in this module; see
    `test_governor.py::test_no_kwarg_can_raise_or_bypass_a_ceiling`."""
    if call_type not in CALL_TYPE_HOURLY_CEILINGS:
        raise ValueError(f"unknown call_type {call_type!r}; must be one of {sorted(CALL_TYPE_HOURLY_CEILINGS)}")

    def decorator(func: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
        @functools.wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            async def _attempt() -> T:
                path = _ledger_path
                now = _now()
                in_cooldown, tighten_level = await _reserve_call_slot(path, call_type, now)
                await _delay(in_cooldown, tighten_level)
                try:
                    result = await func(*args, **kwargs)
                except PeerFloodError as e:
                    # Trip the latch ourselves; with_flood_wait_retry (outer layer)
                    # still does the retry-suppression + AccountHardStopped conversion —
                    # we don't duplicate that, just hook in before it re-raises.
                    await trip_kill_switch(f"PeerFloodError on {call_type!r} call: {e}", path)
                    raise
                except FloodWaitError:
                    await _record_flood_wait(path, _now())
                    raise
                record_run_call()
                return result

            return await with_flood_wait_retry()(_attempt)()

        return wrapper

    return decorator

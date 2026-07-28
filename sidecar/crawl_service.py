"""
Crawl orchestration (Slice 5, docs/timelines/TELEGRAM_TIMELINE.md) — the real,
Telegram-reaching composition of `crawler.py`'s generic BFS engine with Slice 2's
`expander.expand_channel`, plus the background-task bookkeeping `/crawl/*`
(`sidecar/main.py`) needs so a request that starts/resumes a crawl returns immediately
instead of blocking on a run that can take many governed, multi-second-delayed calls.

Hard invariant (structural, not a comment): nothing in this module, nor anything it
imports (`crawler`, `expander`, `collector`, `channel_source`, `username_resolver`,
`telegram_channel_source`), can reach `GetParticipants`/`fetch_participants` — see
`test_crawl_service.py::test_crawl_service_issues_no_member_enumeration_call`, which
follows the exact source-inspection technique `test_expander.py` already uses. BFS
discovery relies only on linked-channel and keyword-mention signals (FR-2); member
enumeration is out of scope for this entire crawl path.

In-memory orchestration state (`_pause_requested`, `_active_tasks`) is deliberately not
persisted — same rationale as `governor.py`'s per-run ceiling: this is live-process
"is a background task currently running" bookkeeping, not something that needs to
survive a restart. The crawl's actual progress (frontier/visited/status) IS durable via
the `crawl_sessions` table (`crawler.persist_state`), so a restart loses only "was a
background task active," never the crawl's progress — `get_status` reads the durable
row fresh from SQLite and works with or without an active in-process task.
"""

import asyncio
import functools

from sidecar import collector, crawler, expander, governor
from sidecar.channel_source import ChannelSource
from sidecar.crawler import CrawlState
from sidecar.db import DEFAULT_TGDB_PATH
from sidecar.logging_config import logger
from sidecar.telegram_channel_source import TelethonChannelSource, TelethonUsernameResolver
from sidecar.username_resolver import UsernameResolver

# --- In-memory orchestration state (see module docstring for why this is fine) --------
_pause_requested: dict[int, bool] = {}
_active_tasks: dict[int, asyncio.Task] = {}


class CrawlAlreadyRunning(Exception):
    """Raised by `resume_crawl` when a background task for this `session_id` is still
    live in this process. Without this guard, `resume_crawl` could spawn a second
    concurrent task racing the first against the same `crawl_sessions` row — both
    independently calling `expand_channel` (doubled, ungoverned-relative-to-each-other
    Telegram call volume) and each overwriting the other's persisted state, with the
    last `persist_state` call silently winning."""


class CrawlNotActive(Exception):
    """Raised by `request_pause` when there's no live background task for this
    `session_id` in this process (already paused/completed, or the sidecar restarted).
    A silent no-op here would give the caller false confidence that a pause is actually
    in flight."""


def _task_is_active(session_id: int) -> bool:
    task = _active_tasks.get(session_id)
    return task is not None and not task.done()


def reset_for_tests() -> None:
    """Test-only helper — mirrors `governor.py`'s `reset_run_for_tests()`/
    `reset_ledger_path_for_tests()` seams. Production code never calls this; `_run_in_background`'s
    own `finally` clause is what clears a session's entries once its task actually
    finishes. This exists as a belt-and-suspenders reset for tests that fail before that
    `finally` runs, or that inject a task directly into `_active_tasks` without going
    through `start_crawl`/`resume_crawl`."""
    _pause_requested.clear()
    _active_tasks.clear()


async def real_expand_channel(
    channel_id: int,
    source: ChannelSource,
    resolver: UsernameResolver,
    path=DEFAULT_TGDB_PATH,
) -> list[int]:
    """The real `crawler.ExpandChannel` composition: `expander.expand_channel` only reads
    a channel's ALREADY-COLLECTED text, so re-collecting it first (idempotent — safe to
    call on every expansion, `UNIQUE(channel_id, message_id)`) keeps the text fresh
    without requiring a separate "did we already collect this neighbor" check here."""
    await collector.collect_channel(str(channel_id), source, path=path)
    return await expander.expand_channel(channel_id, resolver, path=path)


def _should_pause(session_id: int):
    return lambda: _pause_requested.get(session_id, False)


async def _run_in_background(state: CrawlState, source: ChannelSource, resolver: UsernameResolver, path) -> None:
    expand_channel = functools.partial(real_expand_channel, source=source, resolver=resolver, path=path)
    try:
        await crawler.run_crawl(state, expand_channel, path=path, should_pause=_should_pause(state.session_id))
    except Exception:
        # A background task's exception has nowhere else to go — crawler.run_crawl
        # already converts every expected pausing condition (FloodWaitError,
        # AccountHardStopped, BudgetCeilingExceeded, GovernorKillSwitchTripped) into a
        # persisted "paused" state without raising, and NotAChannelError into a skipped
        # node, so anything reaching here is genuinely unexpected. Log it rather than
        # let asyncio silently swallow it (an un-awaited task's exception otherwise
        # only surfaces via a destructor warning). Persist `status="failed"` — Slice 8's
        # live crawl hit exactly this gap: leaving the last-persisted status (typically
        # "running") untouched made a silently-dead background task indistinguishable
        # from a healthy long-running one via `/crawl/status`. Frontier/visited are left
        # exactly as last persisted, so a future `resume_crawl` (once the underlying bug
        # is fixed) still continues from the right place.
        logger.exception("crawl_service: background crawl for session_id=%s failed unexpectedly", state.session_id)
        state.status = "failed"
        await crawler.persist_state(state, path)
    finally:
        _pause_requested.pop(state.session_id, None)
        _active_tasks.pop(state.session_id, None)


async def start_crawl(
    seed_ids: list[int],
    depth_limit: int,
    path=DEFAULT_TGDB_PATH,
    source: ChannelSource | None = None,
    resolver: UsernameResolver | None = None,
) -> CrawlState:
    """Starts a new session and spawns its BFS loop as a background task, returning the
    initial (still `status="running"`) state immediately — the caller (an HTTP request)
    must not block on a crawl that can run many governed, rate-limited calls. `source`/
    `resolver` default to the real Telethon adapters (matching `main.py`'s existing
    `/collect` endpoint) but are injectable so tests can pass fakes and run a full
    start-to-completion cycle with no Telegram and no real delay."""
    resolved_source = source if source is not None else TelethonChannelSource()
    resolved_resolver = resolver if resolver is not None else TelethonUsernameResolver()

    state = await crawler.start_session(seed_ids, depth_limit, path=path)
    governor.start_run()
    _pause_requested[state.session_id] = False
    task = asyncio.create_task(_run_in_background(state, resolved_source, resolved_resolver, path))
    _active_tasks[state.session_id] = task
    return state


async def request_pause(session_id: int) -> None:
    """Sets the pause flag; the running background task's `should_pause()` picks it up
    at the top of its next loop iteration (see `crawler.run_crawl`) and pauses
    cooperatively, without losing the frontier item it's currently on. Raises if there's
    no active task for this session in this process (e.g. already paused, already
    completed, or the sidecar restarted) — a silent no-op here would give the caller
    false confidence that a pause is actually in flight."""
    if not _task_is_active(session_id):
        raise CrawlNotActive(f"no active crawl task for session_id={session_id!r} in this process")
    _pause_requested[session_id] = True


async def resume_crawl(
    session_id: int,
    path=DEFAULT_TGDB_PATH,
    source: ChannelSource | None = None,
    resolver: UsernameResolver | None = None,
) -> CrawlState:
    """Loads the persisted session and spawns a new background task continuing from its
    saved frontier. `governor.start_run()` is called again — a resume is a fresh human
    decision to continue, exactly like `governor.py`'s own reasoning for why the
    per-run ceiling resets rather than persisting across restarts.

    Raises `CrawlAlreadyRunning` if a background task for this session is still live —
    without this guard, a second concurrent task would race the first against the same
    `crawl_sessions` row (see `CrawlAlreadyRunning`'s docstring)."""
    if _task_is_active(session_id):
        raise CrawlAlreadyRunning(f"session_id={session_id!r} already has an active crawl task")

    resolved_source = source if source is not None else TelethonChannelSource()
    resolved_resolver = resolver if resolver is not None else TelethonUsernameResolver()

    state = await crawler.load_session(session_id, path=path)
    if state is None:
        raise ValueError(f"no crawl session {session_id!r}")
    if state.status == "completed":
        raise ValueError(f"session_id={session_id!r} has already completed — nothing to resume")

    governor.start_run()
    _pause_requested[session_id] = False
    state.status = "running"
    task = asyncio.create_task(_run_in_background(state, resolved_source, resolved_resolver, path))
    _active_tasks[session_id] = task
    return state


async def get_status(session_id: int, path=DEFAULT_TGDB_PATH) -> dict:
    """Reads the persisted `crawl_sessions` row fresh from SQLite — works even with no
    active in-process background task (e.g. after a restart), matching the
    durable-vs-in-memory split explained in the module docstring."""
    state = await crawler.load_session(session_id, path=path)
    if state is None:
        raise ValueError(f"no crawl session {session_id!r}")
    return {
        "session_id": state.session_id,
        "status": state.status,
        "depth_limit": state.depth_limit,
        "frontier_size": len(state.frontier),
        "visited_count": len(state.visited),
    }


async def _wait_for_active_task(session_id: int) -> None:
    """Test-only: awaits the background task spawned by `start_crawl`/`resume_crawl` for
    `session_id`, if one is currently tracked, so a test can assert on the state
    *after* the crawl loop has actually finished running rather than racing it. Route
    code (`main.py`) has no reason to ever call this — every real endpoint here returns
    before the background task completes by design; this function exists solely so
    `test_crawl_service.py` doesn't need real sleeps or polling to observe completion."""
    task = _active_tasks.get(session_id)
    if task is not None:
        await task

"""
`run_crawl` tests (Slice 5, docs/issues/TELEGRAM_PHASE3_ISSUES.md) — FAKE
`expand_channel` callbacks only (plain async functions, no Telegram, no real sleep).
Proves the pause/resume contract: any of `PAUSING_EXCEPTIONS` (FloodWaitError,
AccountHardStopped, BudgetCeilingExceeded, GovernorKillSwitchTripped) raised mid-crawl
must pause without losing the frontier item that failed, and resuming from the
persisted state must reach an IDENTICAL final `visited` set to an uninterrupted run.
"""

import asyncio
from pathlib import Path

import pytest
import pytest_asyncio
from telethon.errors import FloodWaitError

from sidecar import crawler, db, governor
from sidecar.governor import BudgetCeilingExceeded, GovernorKillSwitchTripped
from sidecar.rate_limiter import AccountHardStopped

# A small fixed graph: 1 -> [2, 3], 2 -> [4], 3 -> [], 4 -> []
GRAPH = {1: [2, 3], 2: [4], 3: [], 4: []}


@pytest.fixture(autouse=True)
def _reset_governor_run_state():
    # `governor._current_run` is a module global (see governor.py's own
    # `reset_run_for_tests()`/its test file's autouse fixture) — reset it here too since
    # `test_run_crawl_pauses_when_per_run_ceiling_is_hit` below calls `start_run`
    # directly, and a leaked `RunBudget` would make `is_run_ceiling_hit()` return
    # unexpected results for every other test in this file (run_crawl checks it
    # unconditionally every iteration).
    yield
    governor.reset_run_for_tests()


@pytest_asyncio.fixture
async def tgdb_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.tgdb"
    await db.init_db(path)
    return path


def _clean_expand_channel():
    async def expand_channel(channel_id: int) -> list[int]:
        return list(GRAPH.get(channel_id, []))

    return expand_channel


@pytest.mark.asyncio
async def test_uninterrupted_run_completes_with_empty_frontier(tgdb_path):
    state = await crawler.start_session([1], depth_limit=3, path=tgdb_path)
    state = await crawler.run_crawl(state, _clean_expand_channel(), path=tgdb_path)

    assert state.status == "completed"
    assert state.frontier == []
    assert state.visited == {1, 2, 3, 4}


@pytest.mark.asyncio
async def test_run_crawl_persists_frontier_state_after_every_step_not_just_at_end(tgdb_path):
    """Regression: Slice 7's WS stream (`sidecar/crawl_ws.py`) reads this same durable
    `crawl_sessions` row for `frontier_size`/`visited_count` on every tick. Before this
    fix, `persist_state` only ran inside `_pause()` or once after the whole while-loop
    exited, so a caller watching a long, unpaused, uninterrupted run saw frontier/visited
    frozen at the start value for the entire run — never "real time" at all."""
    step_started = asyncio.Event()
    proceed = asyncio.Event()

    async def slow_expand_channel(channel_id: int) -> list[int]:
        step_started.set()
        await proceed.wait()
        proceed.clear()
        return list(GRAPH.get(channel_id, []))

    state = await crawler.start_session([1], depth_limit=3, path=tgdb_path)
    task = asyncio.create_task(crawler.run_crawl(state, slow_expand_channel, path=tgdb_path))

    await step_started.wait()  # run_crawl is now inside expand_channel(1)
    step_started.clear()
    proceed.set()  # let channel 1 finish expanding

    await step_started.wait()  # run_crawl is now inside expand_channel for 1's neighbor —
    # channel 1's _mark_visited + persist_state must already have happened for the loop
    # to have reached this point.

    mid_run = await crawler.load_session(state.session_id, path=tgdb_path)
    assert 1 in mid_run.visited
    assert 1 not in [channel_id for channel_id, _ in mid_run.frontier]

    while not task.done():
        proceed.set()
        await asyncio.sleep(0)
    await task


@pytest.mark.asyncio
async def test_depth_limit_stops_expansion_without_calling_expand_channel(tgdb_path):
    calls: list[int] = []

    async def expand_channel(channel_id: int) -> list[int]:
        calls.append(channel_id)
        return list(GRAPH.get(channel_id, []))

    state = await crawler.start_session([1], depth_limit=1, path=tgdb_path)
    state = await crawler.run_crawl(state, expand_channel, path=tgdb_path)

    assert state.status == "completed"
    # depth 0 (channel 1) expands; its depth-1 neighbors (2, 3) are visited but never
    # expanded (depth >= depth_limit) — so expand_channel is only called for 1.
    assert calls == [1]
    assert state.visited == {1, 2, 3}


@pytest.mark.asyncio
async def test_cycle_is_safe_via_visited_set(tgdb_path):
    # 1 -> [2], 2 -> [1] (back-edge / cycle)
    graph = {1: [2], 2: [1]}

    async def expand_channel(channel_id: int) -> list[int]:
        return list(graph.get(channel_id, []))

    state = await crawler.start_session([1], depth_limit=5, path=tgdb_path)
    state = await crawler.run_crawl(state, expand_channel, path=tgdb_path)

    assert state.status == "completed"
    assert state.visited == {1, 2}


@pytest.mark.asyncio
async def test_max_steps_stops_mid_crawl_and_stays_running(tgdb_path):
    state = await crawler.start_session([1], depth_limit=3, path=tgdb_path)
    state = await crawler.run_crawl(state, _clean_expand_channel(), path=tgdb_path, max_steps=1)

    assert state.status == "running"
    assert state.visited == {1}
    assert state.frontier  # 2, 3 still queued


async def _run_to_completion_reference() -> set[int]:
    """The reference "never interrupted" run — used to assert an interrupted-then-resumed
    run reaches the identical visited set."""
    state = crawler.CrawlState(session_id=-1, depth_limit=3, status="running", frontier=[(1, 0)])
    state = await crawler.run_crawl(state, _clean_expand_channel())
    return state.visited


@pytest.mark.asyncio
async def test_flood_wait_error_pauses_and_resume_reaches_identical_visited_set(tgdb_path):
    calls = {"n": 0}

    async def flaky_expand_channel(channel_id: int) -> list[int]:
        if channel_id == 2 and calls["n"] == 0:
            calls["n"] += 1
            raise FloodWaitError(request=None, capture=1)
        return list(GRAPH.get(channel_id, []))

    state = await crawler.start_session([1], depth_limit=3, path=tgdb_path)
    state = await crawler.run_crawl(state, flaky_expand_channel, path=tgdb_path)

    assert state.status == "paused"
    # channel 2 is still at the front of the frontier — not lost, not visited yet.
    assert state.frontier[0][0] == 2
    assert 2 not in state.visited

    resumed = await crawler.load_session(state.session_id, path=tgdb_path)
    resumed = await crawler.run_crawl(resumed, flaky_expand_channel, path=tgdb_path)

    assert resumed.status == "completed"
    assert resumed.frontier == []
    assert resumed.visited == await _run_to_completion_reference()


@pytest.mark.asyncio
async def test_account_hard_stopped_pauses_without_losing_state(tgdb_path):
    calls = {"n": 0}

    async def flaky_expand_channel(channel_id: int) -> list[int]:
        if channel_id == 2 and calls["n"] == 0:
            calls["n"] += 1
            raise AccountHardStopped("PeerFloodError")
        return list(GRAPH.get(channel_id, []))

    state = await crawler.start_session([1], depth_limit=3, path=tgdb_path)
    state = await crawler.run_crawl(state, flaky_expand_channel, path=tgdb_path)

    assert state.status == "paused"
    assert state.frontier[0][0] == 2
    assert 2 not in state.visited

    resumed = await crawler.load_session(state.session_id, path=tgdb_path)
    resumed = await crawler.run_crawl(resumed, flaky_expand_channel, path=tgdb_path)

    assert resumed.status == "completed"
    assert resumed.visited == await _run_to_completion_reference()


@pytest.mark.asyncio
async def test_budget_ceiling_exceeded_pauses_without_losing_state(tgdb_path):
    calls = {"n": 0}

    async def flaky_expand_channel(channel_id: int) -> list[int]:
        if channel_id == 2 and calls["n"] == 0:
            calls["n"] += 1
            raise BudgetCeilingExceeded("hourly ceiling reached")
        return list(GRAPH.get(channel_id, []))

    state = await crawler.start_session([1], depth_limit=3, path=tgdb_path)
    state = await crawler.run_crawl(state, flaky_expand_channel, path=tgdb_path)

    assert state.status == "paused"
    assert state.frontier[0][0] == 2
    assert 2 not in state.visited

    resumed = await crawler.load_session(state.session_id, path=tgdb_path)
    resumed = await crawler.run_crawl(resumed, flaky_expand_channel, path=tgdb_path)

    assert resumed.status == "completed"
    assert resumed.visited == await _run_to_completion_reference()


@pytest.mark.asyncio
async def test_governor_kill_switch_tripped_pauses_without_losing_state(tgdb_path):
    calls = {"n": 0}

    async def flaky_expand_channel(channel_id: int) -> list[int]:
        if channel_id == 2 and calls["n"] == 0:
            calls["n"] += 1
            raise GovernorKillSwitchTripped("kill switch tripped")
        return list(GRAPH.get(channel_id, []))

    state = await crawler.start_session([1], depth_limit=3, path=tgdb_path)
    state = await crawler.run_crawl(state, flaky_expand_channel, path=tgdb_path)

    assert state.status == "paused"
    assert state.frontier[0][0] == 2
    assert 2 not in state.visited

    resumed = await crawler.load_session(state.session_id, path=tgdb_path)
    resumed = await crawler.run_crawl(resumed, flaky_expand_channel, path=tgdb_path)

    assert resumed.status == "completed"
    assert resumed.visited == await _run_to_completion_reference()


@pytest.mark.asyncio
async def test_run_crawl_pauses_when_per_run_ceiling_is_hit(tgdb_path):
    """Regression test for Slice 3's per-run ceiling (`governor.start_run`/
    `is_run_ceiling_hit`), built specifically for `run_crawl` to consume (Slice 3's
    module docstring: "Slice 5's crawler wiring auto-pauses on this"). Without a caller
    ever polling `is_run_ceiling_hit()`, `start_run()` is inert — this proves the wiring
    actually pauses a run, not just that the governor primitive works in isolation
    (that's already covered by test_governor.py)."""
    governor.start_run(ceiling=1)
    governor.record_run_call()  # ceiling of 1, already hit before run_crawl starts

    state = await crawler.start_session([1], depth_limit=3, path=tgdb_path)
    state = await crawler.run_crawl(state, _clean_expand_channel(), path=tgdb_path)

    assert state.status == "paused"
    assert state.frontier == [(1, 0)]  # nothing lost — never even attempted
    assert state.visited == set()


@pytest.mark.asyncio
async def test_run_crawl_is_unaffected_by_the_ceiling_when_no_run_was_started(tgdb_path):
    """`is_run_ceiling_hit()` must be a no-op for tests (and any future caller) that
    never call `governor.start_run()` — e.g. every other test in this file, which use
    `run_crawl` directly against a fake `expand_channel` with no governor involvement."""
    assert governor.is_run_ceiling_hit() is False  # no active run — the default state

    state = await crawler.start_session([1], depth_limit=3, path=tgdb_path)
    state = await crawler.run_crawl(state, _clean_expand_channel(), path=tgdb_path)

    assert state.status == "completed"
    assert state.visited == {1, 2, 3, 4}


@pytest.mark.asyncio
async def test_should_pause_pauses_immediately_without_losing_frontier_item(tgdb_path):
    state = await crawler.start_session([1], depth_limit=3, path=tgdb_path)

    state = await crawler.run_crawl(state, _clean_expand_channel(), path=tgdb_path, should_pause=lambda: True)

    assert state.status == "paused"
    assert state.frontier == [(1, 0)]
    assert state.visited == set()

    # Resuming without should_pause completes normally, reaching the same result as an
    # uninterrupted run.
    resumed = await crawler.load_session(state.session_id, path=tgdb_path)
    resumed = await crawler.run_crawl(resumed, _clean_expand_channel(), path=tgdb_path)

    assert resumed.status == "completed"
    assert resumed.visited == await _run_to_completion_reference()

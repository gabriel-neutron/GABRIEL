"""
`crawl_service` tests (Slice 5, docs/issues/TELEGRAM_PHASE3_ISSUES.md) — full
start-to-completion cycles against `FakeChannelSource`/`FakeUsernameResolver` (never
Telegram, zero delay, same fakes `test_expander.py`/`test_collector.py` already use).
`_wait_for_active_task` lets these tests observe the spawned background task's actual
completion instead of racing it — see that function's docstring in `crawl_service.py`
for why it's test-only.
"""

import asyncio
import inspect
from pathlib import Path

import pytest
import pytest_asyncio

from sidecar import channel_source, collector, crawl_service, crawler, db, expander, governor, username_resolver
from sidecar.channel_source import ChannelMeta, FakeChannelSource
from sidecar.username_resolver import FakeUsernameResolver

CHANA = ChannelMeta(
    id=1001, username="chana", title="Chan A", description="https://t.me/chanb",
    member_count=10, type="channel", is_private=False, raw_json="{}",
)
CHANB = ChannelMeta(
    id=2002, username="chanb", title="Chan B", description=None,
    member_count=5, type="channel", is_private=False, raw_json="{}",
)


@pytest.fixture(autouse=True)
def _reset_crawl_service_state():
    # `_active_tasks`/`_pause_requested` are module-global dicts (crawl_service.py) —
    # same latent cross-test-leak risk `governor.py`'s own module globals guard against
    # with `reset_run_for_tests()`. `_run_in_background`'s `finally` clears a session's
    # entries once its task finishes, but a test that fails before that point (or that
    # injects a task directly, like the re-entrancy regression test below) shouldn't
    # leave state for the next test to trip over.
    yield
    crawl_service.reset_for_tests()
    governor.reset_run_for_tests()


@pytest_asyncio.fixture
async def tgdb_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.tgdb"
    await db.init_db(path)
    return path


def _fakes():
    source = FakeChannelSource(metadata={"1001": CHANA, "2002": CHANB})
    resolver = FakeUsernameResolver({"chanb": 2002})
    return source, resolver


@pytest.mark.asyncio
async def test_start_crawl_runs_in_background_and_completes(tgdb_path):
    source, resolver = _fakes()

    state = await crawl_service.start_crawl([1001], depth_limit=2, path=tgdb_path, source=source, resolver=resolver)
    assert state.status == "running"

    await crawl_service._wait_for_active_task(state.session_id)

    final = await crawler.load_session(state.session_id, path=tgdb_path)
    assert final.status == "completed"
    assert final.visited == {1001, 2002}


@pytest.mark.asyncio
async def test_pause_then_resume_reaches_same_final_state_as_uninterrupted_run(tgdb_path):
    source, resolver = _fakes()

    state = await crawl_service.start_crawl([1001], depth_limit=2, path=tgdb_path, source=source, resolver=resolver)
    await crawl_service.request_pause(state.session_id)
    await crawl_service._wait_for_active_task(state.session_id)

    paused = await crawler.load_session(state.session_id, path=tgdb_path)
    # Pausing immediately (before the loop advances) means nothing has been visited yet.
    assert paused.status == "paused"
    assert paused.visited == set()

    resumed = await crawl_service.resume_crawl(state.session_id, path=tgdb_path, source=source, resolver=resolver)
    await crawl_service._wait_for_active_task(resumed.session_id)

    final = await crawler.load_session(state.session_id, path=tgdb_path)
    assert final.status == "completed"
    assert final.visited == {1001, 2002}


@pytest.mark.asyncio
async def test_unexpected_exception_persists_failed_status(tgdb_path):
    """Regression: `_run_in_background`'s catch-all used to log an unexpected
    exception but leave the persisted status at whatever it last was (typically
    "running") forever — indistinguishable from a healthy long-running crawl via
    `/crawl/status`. This bit for real during Slice 8's live 18-seed crawl
    (docs/issues/TELEGRAM_PHASE3_ISSUES.md). A seed id with no corresponding fake
    metadata raises a bare `KeyError` deep in `collector.collect_channel` — not one of
    `crawler.PAUSING_EXCEPTIONS`, not `NotAChannelError` — so it reaches the catch-all,
    which must now persist `status="failed"`."""
    source, resolver = _fakes()

    state = await crawl_service.start_crawl([9999], depth_limit=2, path=tgdb_path, source=source, resolver=resolver)
    await crawl_service._wait_for_active_task(state.session_id)

    final = await crawler.load_session(state.session_id, path=tgdb_path)
    assert final.status == "failed"


@pytest.mark.asyncio
async def test_get_status_reflects_reality_after_completion(tgdb_path):
    source, resolver = _fakes()

    state = await crawl_service.start_crawl([1001], depth_limit=2, path=tgdb_path, source=source, resolver=resolver)
    await crawl_service._wait_for_active_task(state.session_id)

    status = await crawl_service.get_status(state.session_id, path=tgdb_path)
    assert status["status"] == "completed"
    assert status["frontier_size"] == 0
    assert status["visited_count"] == 2


@pytest.mark.asyncio
async def test_get_status_works_without_an_active_in_process_task(tgdb_path):
    """Simulates a restart: nothing in `_active_tasks` for this session, `get_status`
    still reads the durable row correctly."""
    source, resolver = _fakes()

    state = await crawl_service.start_crawl([1001], depth_limit=2, path=tgdb_path, source=source, resolver=resolver)
    await crawl_service._wait_for_active_task(state.session_id)
    crawl_service._active_tasks.pop(state.session_id, None)

    status = await crawl_service.get_status(state.session_id, path=tgdb_path)
    assert status["status"] == "completed"


@pytest.mark.asyncio
async def test_resume_raises_if_a_task_is_already_active(tgdb_path):
    """Regression test: `resume_crawl` must never spawn a second concurrent task
    against a session that already has one running — two tasks racing the same
    `crawl_sessions` row would double Telegram/governor call volume and let the
    last `persist_state` silently clobber the other's result. Simulates "still
    active" directly (an `asyncio.Event`-gated task) rather than depending on timing,
    since the fakes complete near-instantly."""
    source, resolver = _fakes()
    state = await crawl_service.start_crawl([1001], depth_limit=2, path=tgdb_path, source=source, resolver=resolver)
    await crawl_service._wait_for_active_task(state.session_id)  # let the real (instant) crawl finish first

    still_running = asyncio.Event()
    fake_task = asyncio.create_task(still_running.wait())
    crawl_service._active_tasks[state.session_id] = fake_task
    try:
        with pytest.raises(crawl_service.CrawlAlreadyRunning):
            await crawl_service.resume_crawl(state.session_id, path=tgdb_path, source=source, resolver=resolver)
        # A still-active task can, correctly, still be asked to pause — the guard is
        # only against a second concurrent *task*, not against pausing the first one.
        await crawl_service.request_pause(state.session_id)
    finally:
        still_running.set()
        await fake_task
        crawl_service._active_tasks.pop(state.session_id, None)


@pytest.mark.asyncio
async def test_resume_raises_if_session_already_completed(tgdb_path):
    source, resolver = _fakes()
    state = await crawl_service.start_crawl([1001], depth_limit=2, path=tgdb_path, source=source, resolver=resolver)
    await crawl_service._wait_for_active_task(state.session_id)

    with pytest.raises(ValueError):
        await crawl_service.resume_crawl(state.session_id, path=tgdb_path, source=source, resolver=resolver)


@pytest.mark.asyncio
async def test_request_pause_raises_if_no_active_task_for_session(tgdb_path):
    """Regression test: a pause request against a session with no live task in this
    process (already completed, already paused, or the sidecar restarted) must not
    silently no-op — that would give the caller false confidence a pause is in flight."""
    with pytest.raises(crawl_service.CrawlNotActive):
        await crawl_service.request_pause(999999)

    source, resolver = _fakes()
    state = await crawl_service.start_crawl([1001], depth_limit=2, path=tgdb_path, source=source, resolver=resolver)
    await crawl_service._wait_for_active_task(state.session_id)  # completes; no longer active

    with pytest.raises(crawl_service.CrawlNotActive):
        await crawl_service.request_pause(state.session_id)


def test_crawl_service_issues_no_member_enumeration_call():
    """Structural, not a comment: nothing this module imports can reach
    `GetParticipants`/`fetch_participants` — same source-inspection technique as
    `test_expander.py::test_expand_channel_issues_no_member_enumeration_call`."""
    for module in (crawl_service, crawler, expander, channel_source, username_resolver, collector):
        for _, obj in inspect.getmembers(module):
            # Only objects actually *defined* in this module — imported stdlib/third
            # -party names (e.g. `datetime.datetime`) have no retrievable Python source
            # and aren't part of this module's own call surface anyway.
            if (inspect.isfunction(obj) or inspect.isclass(obj)) and getattr(obj, "__module__", None) == module.__name__:
                code = inspect.getsource(obj)
                assert "GetParticipants" not in code
                assert "fetch_participants" not in code

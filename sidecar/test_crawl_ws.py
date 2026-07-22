"""
`crawl_ws` tests (Slice 7, docs/issues/TELEGRAM_PHASE3_ISSUES.md) — pure unit tests
against a real (but temp) `.tgdb` and fake crawl-session/channel/edge rows, no Telegram
and no live WS client needed for this layer (see that module's docstring for why it's
just a read-only poll of durable state, same source `get_status`/`get_graph` already read).
"""

from pathlib import Path

import pytest
import pytest_asyncio

from sidecar import crawl_ws, crawler, db


@pytest_asyncio.fixture
async def tgdb_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.tgdb"
    await db.init_db(path)
    return path


@pytest.mark.asyncio
async def test_build_progress_message_returns_none_for_unknown_session(tgdb_path):
    assert await crawl_ws.build_progress_message(999999, path=tgdb_path) is None


@pytest.mark.asyncio
async def test_build_progress_message_reflects_session_and_graph_state(tgdb_path):
    state = await crawler.start_session([1001, 2002], depth_limit=2, path=tgdb_path)

    import aiosqlite

    async with aiosqlite.connect(tgdb_path) as conn:
        await conn.execute(
            "INSERT INTO channels (id, username, title) VALUES (?, ?, ?)", (1001, "chana", "Chan A")
        )
        await conn.execute(
            "INSERT INTO channels (id, username, title) VALUES (?, ?, ?)", (2002, "chanb", "Chan B")
        )
        await conn.execute(
            "INSERT INTO edges (from_id, to_id, edge_type) VALUES (?, ?, ?)", (1001, 2002, "link")
        )
        await conn.commit()

    message = await crawl_ws.build_progress_message(state.session_id, path=tgdb_path)

    assert message == {
        "session_id": state.session_id,
        "status": "running",
        "frontier_size": 2,
        "visited_count": 0,
        "node_count": 2,
        "edge_count": 1,
    }


@pytest.mark.asyncio
async def test_progress_stream_yields_nothing_for_unknown_session(tgdb_path):
    messages = [m async for m in crawl_ws.progress_stream(999999, path=tgdb_path, interval=0)]
    assert messages == []


@pytest.mark.asyncio
async def test_progress_stream_stops_after_completed_status(tgdb_path):
    """Regression test: a completed session's counts can't change again, so the stream
    must yield exactly one message and stop — not loop forever against a dead session."""
    state = await crawler.start_session([1001], depth_limit=0, path=tgdb_path)
    # depth_limit=0 marks every frontier item visited without expanding — completes
    # the session without needing a real/fake ChannelSource at all.
    await crawler.run_crawl(state, expand_channel=None, path=tgdb_path)

    messages = [m async for m in crawl_ws.progress_stream(state.session_id, path=tgdb_path, interval=0)]

    assert len(messages) == 1
    assert messages[0]["status"] == "completed"


@pytest.mark.asyncio
async def test_progress_stream_keeps_streaming_a_paused_session(tgdb_path):
    """A paused session may be resumed by a human later — the stream shouldn't treat
    'paused' as terminal the way it treats 'completed'."""
    state = await crawler.start_session([1001], depth_limit=2, path=tgdb_path)
    state.status = "paused"
    await crawler.persist_state(state, path=tgdb_path)

    seen = 0
    async for message in crawl_ws.progress_stream(state.session_id, path=tgdb_path, interval=0):
        assert message["status"] == "paused"
        seen += 1
        if seen == 3:
            break

    assert seen == 3

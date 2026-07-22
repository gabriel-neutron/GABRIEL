"""
WS crawl-progress streaming (Slice 7, docs/issues/TELEGRAM_PHASE3_ISSUES.md).

Reads exactly the same durable state `GET /crawl/status/{id}` already reads
(`crawler.load_session`) plus graph counts (`graph.get_graph_counts`) — this is a
read-only poll of the existing `crawl_sessions` row and `channels`/`edges` tables, not a
second progress-tracking mechanism. `crawl_service`'s in-memory orchestration state
(`_active_tasks`, `_pause_requested`) is never imported or touched here, and the
background crawl task (`crawl_service._run_in_background`) has no reference to this
module and no way to know whether a WS client is connected — so a WS disconnect/reconnect
structurally cannot affect a running crawl, and a crawl finishing/pausing/erroring can't
crash a WS client either (it just reads whatever's last persisted).
"""

import asyncio

from sidecar import crawler, graph
from sidecar.db import DEFAULT_TGDB_PATH

POLL_INTERVAL_SECONDS = 1.0


async def build_progress_message(session_id: int, path=DEFAULT_TGDB_PATH) -> dict | None:
    """Returns `None` if `session_id` doesn't exist (never started, or a typo'd id) —
    the caller (`main.py`'s WS route) turns that into a single error message and closes,
    rather than streaming forever against nothing."""
    state = await crawler.load_session(session_id, path=path)
    if state is None:
        return None
    counts = await graph.get_graph_counts(path=path)
    return {
        "session_id": state.session_id,
        "status": state.status,
        "frontier_size": len(state.frontier),
        "visited_count": len(state.visited),
        "node_count": counts["node_count"],
        "edge_count": counts["edge_count"],
    }


async def progress_stream(session_id: int, path=DEFAULT_TGDB_PATH, interval: float = POLL_INTERVAL_SECONDS):
    """Yields a progress message every `interval` seconds until the session reaches
    `status="completed"` or no longer exists (in which case it yields nothing at all —
    the caller distinguishes "never yielded" from "yielded then stopped" to report
    session-not-found separately). Stops on `status="completed"` rather than looping
    forever, since a completed session's counts can no longer change; a "paused" session
    keeps streaming (unchanged counts each tick) since a human may resume it."""
    while True:
        message = await build_progress_message(session_id, path=path)
        if message is None:
            return
        yield message
        if message["status"] == "completed":
            return
        await asyncio.sleep(interval)

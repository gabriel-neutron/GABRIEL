"""
BFS discovery crawler — session state, frontier persistence, pause/resume (Phase 5).

Deliberately NOT wired to any FastAPI endpoint. The traversal algorithm itself (frontier
management, depth limiting, visited-set loop prevention, pause/resume) is generic graph
BFS with no Telegram dependency — parameterized by an injected `expand_channel`
callback, so it's fully testable with a fake graph, no live connection needed. But
`expand_channel`'s real implementation (follow t.me/ links, shared admins, keyword
mentions — FR-2) needs Phase 3's collector.py, itself gated on Phase 1. Exposing a
`POST /crawl/start` that runs this against a fake or missing expander would misrepresent
the feature as working when it can't actually reach Telegram — wire the real endpoints
only once a real `expand_channel` exists.
"""

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Awaitable, Callable

import aiosqlite

from sidecar.db import DEFAULT_TGDB_PATH

ExpandChannel = Callable[[int], Awaitable[list[int]]]


@dataclass
class CrawlState:
    session_id: int
    depth_limit: int
    status: str  # "running" | "paused" | "completed"
    frontier: list[tuple[int, int]] = field(default_factory=list)  # (channel_id, depth)
    visited: set[int] = field(default_factory=set)


async def start_session(seed_ids: list[int], depth_limit: int, path=DEFAULT_TGDB_PATH) -> CrawlState:
    if not seed_ids:
        raise ValueError("seed_ids must not be empty")

    frontier = [(sid, 0) for sid in seed_ids]
    now = datetime.now(timezone.utc).isoformat()

    async with aiosqlite.connect(path) as conn:
        cursor = await conn.execute(
            """
            INSERT INTO crawl_sessions
                (started_at, status, depth_limit, current_depth, seed_ids, frontier_json, visited_json)
            VALUES (?, 'running', ?, 0, ?, ?, ?)
            """,
            (now, depth_limit, json.dumps(seed_ids), json.dumps(frontier), json.dumps([])),
        )
        await conn.commit()
        session_id = cursor.lastrowid

    return CrawlState(session_id=session_id, depth_limit=depth_limit, status="running", frontier=frontier)


async def load_session(session_id: int, path=DEFAULT_TGDB_PATH) -> CrawlState | None:
    """Resumes a paused/running session from its last-persisted frontier/visited set."""
    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        rows = await conn.execute_fetchall(
            "SELECT status, depth_limit, frontier_json, visited_json FROM crawl_sessions WHERE id = ?",
            (session_id,),
        )
    if not rows:
        return None
    row = rows[0]
    return CrawlState(
        session_id=session_id,
        depth_limit=row["depth_limit"],
        status=row["status"],
        frontier=[tuple(pair) for pair in json.loads(row["frontier_json"] or "[]")],
        visited=set(json.loads(row["visited_json"] or "[]")),
    )


async def persist_state(state: CrawlState, path=DEFAULT_TGDB_PATH) -> None:
    async with aiosqlite.connect(path) as conn:
        await conn.execute(
            """
            UPDATE crawl_sessions
            SET status = ?, frontier_json = ?, visited_json = ?
            WHERE id = ?
            """,
            (state.status, json.dumps(state.frontier), json.dumps(sorted(state.visited)), state.session_id),
        )
        await conn.commit()


async def run_crawl(
    state: CrawlState, expand_channel: ExpandChannel, path=DEFAULT_TGDB_PATH, max_steps: int | None = None
) -> CrawlState:
    """Pops the frontier breadth-first, expands each channel via the injected callback,
    and enqueues unvisited neighbors at depth+1 up to `state.depth_limit`. The `visited`
    set is what makes this cycle-safe — a neighbor already seen (including a seed
    re-discovered via a back-edge) is never re-expanded, so a crawl can't loop forever
    even if the underlying channel graph has cycles (Telegram channels linking to each
    other in both directions is the common case, not an edge case).

    Stops and returns (status stays "running", ready to call again) when either the
    frontier empties (status flips to "completed") or `max_steps` expansions have run
    this call, whichever comes first — the caller decides pause timing by choosing when
    to stop calling this and instead call `persist_state` + set status to "paused"."""
    steps = 0
    while state.frontier and (max_steps is None or steps < max_steps):
        channel_id, depth = state.frontier.pop(0)
        if channel_id in state.visited:
            continue
        state.visited.add(channel_id)
        steps += 1

        if depth >= state.depth_limit:
            continue

        neighbor_ids = await expand_channel(channel_id)
        for neighbor_id in neighbor_ids:
            if neighbor_id not in state.visited:
                state.frontier.append((neighbor_id, depth + 1))

    if not state.frontier:
        state.status = "completed"
    await persist_state(state, path)
    return state

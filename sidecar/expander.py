"""
`expand_channel` (Slice 2, docs/timelines/TELEGRAM_TIMELINE.md) — turns one collected
channel into the real peer ids of its resolvable neighbors, for the BFS crawler (wired in
Slice 5) to enqueue. Thin composition, no Telegram call of its own beyond username
resolution:

    DB (the channel's already-collected description + message text, written by Slice 1's
    collector.py — this module never re-fetches from Telegram to get it)
      -> edges.py's extract_linked_channels / extract_keyword_mentions
      -> resolve each candidate username via the injected UsernameResolver seam
      -> upsert unresolved-but-linked neighbors as username-keyed placeholder rows via
         seed.import_seeds — Slice 1's identity contract (id stays NULL until a real
         collect resolves it), reused rather than reimplemented with different dedup
         logic
      -> persist each resolved neighbor as an `edges` row
      -> return the resolved real peer ids

The `edges` write is what makes this a graph rather than a channel list. Before it, the
discovered relationship existed only as the return value — consumed by the crawler to
enqueue the frontier and then dropped — so `graph.py`, `export.py` and Slice 7's WS
`edge_count` all read a table nothing ever wrote, and two full crawls (sessions 1 and 2)
produced 37 collected channels with zero edges between them.

Provably issues zero member-enumeration calls: this module has no Telethon import at
all, and its only Telegram-reaching seam (`UsernameResolver`) does not expose a
participants method either — there is no path from here to `GetParticipants` /
`fetch_participants`.
"""

from datetime import datetime, timezone

import aiosqlite

from sidecar import edges, seed
from sidecar.db import DEFAULT_TGDB_PATH
from sidecar.logging_config import logger
from sidecar.username_resolver import UsernameResolver

# The two discovery signals, recorded as `edges.edge_type` so a reader can tell a hard
# t.me/ link from a bare in-text name mention — they carry different evidential weight
# and only the extraction knows which one fired.
EDGE_TYPE_LINK = "link"
EDGE_TYPE_MENTION = "mention"


async def expand_channel(
    channel_id: int,
    resolver: UsernameResolver,
    path=DEFAULT_TGDB_PATH,
) -> list[int]:
    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        own_username, text = await _collected_text(conn, channel_id)
        known_usernames = await _known_usernames(conn, exclude_username=own_username)

    candidates = _candidate_usernames(text, known_usernames, exclude_username=own_username)

    resolved_ids: list[int] = []
    resolved_usernames: list[str] = []
    discovered: list[tuple[int, str]] = []  # (neighbor_id, edge_type)
    for username, edge_type in candidates:
        peer_id = await resolver.resolve_username(username)
        if peer_id is None:
            logger.info("expand_channel: %r unresolvable, dropped", username)
            continue
        resolved_usernames.append(username)
        resolved_ids.append(peer_id)
        discovered.append((peer_id, edge_type))

    if resolved_usernames:
        # One batched call — `seed.import_seeds` already dedups the whole list itself,
        # matching every other write path in this codebase (collector.py, seed.py,
        # crawler.py) doing all its writes through a single connection/commit rather
        # than one per row.
        await seed.import_seeds(resolved_usernames, path=path)
        await _persist_edges(channel_id, discovered, path=path)

    return resolved_ids


async def _persist_edges(from_id: int, discovered: list[tuple[int, str]], path) -> None:
    """`INSERT OR IGNORE` against `idx_edges_unique` — expansion is re-run on every
    revisit (a resumed session retries its paused node, a deeper re-run re-walks the
    whole known graph), so this has to be idempotent rather than accumulate a duplicate
    row per pass.

    `to_id` can name a channel whose own row still has `id IS NULL` — Slice 1's identity
    contract keeps a discovered neighbor username-keyed until a real collect resolves it,
    while the resolver has already handed us its true peer id. The edge is recorded
    against that true id regardless: the relationship is real evidence now, and the node
    row catches up when the crawler reaches it. `graph.py` is what reconciles the gap for
    rendering."""
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(path) as conn:
        await conn.executemany(
            """
            INSERT OR IGNORE INTO edges (from_id, to_id, edge_type, weight, collected_at)
            VALUES (?, ?, ?, NULL, ?)
            """,
            [(from_id, to_id, edge_type, now) for to_id, edge_type in discovered],
        )
        await conn.commit()


async def _collected_text(conn: aiosqlite.Connection, channel_id: int) -> tuple[str | None, str]:
    channel_rows = await conn.execute_fetchall(
        "SELECT username, description FROM channels WHERE id = ?", (channel_id,)
    )
    own_username = channel_rows[0]["username"] if channel_rows else None
    description = channel_rows[0]["description"] if channel_rows else None

    message_rows = await conn.execute_fetchall(
        "SELECT text FROM messages WHERE channel_id = ?", (channel_id,)
    )
    parts = [description] + [row["text"] for row in message_rows]
    return own_username, "\n".join(part for part in parts if part)


async def _known_usernames(conn: aiosqlite.Connection, exclude_username: str | None) -> list[str]:
    """Already-known channel usernames (seeded or collected) — fed to
    `extract_keyword_mentions` so a bare in-text mention of a known channel (no t.me/
    link) is also treated as a candidate neighbor."""
    rows = await conn.execute_fetchall("SELECT username FROM channels WHERE username IS NOT NULL")
    return [row["username"] for row in rows if row["username"] != exclude_username]


def _candidate_usernames(
    text: str, known_usernames: list[str], exclude_username: str | None
) -> list[tuple[str, str]]:
    """Returns (username, edge_type) pairs. `setdefault` ordering is load-bearing: links
    are collected first, so a neighbor that is both linked and name-dropped keeps
    `EDGE_TYPE_LINK` — the stronger of the two signals."""
    seen: dict[str, str] = {}
    for username in edges.extract_linked_channels(text):
        seen.setdefault(username, EDGE_TYPE_LINK)
    for username in edges.extract_keyword_mentions(text, known_usernames):
        seen.setdefault(username.lower(), EDGE_TYPE_MENTION)
    if exclude_username:
        seen.pop(exclude_username.lower(), None)
    return list(seen.items())

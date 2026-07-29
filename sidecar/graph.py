"""
Graph query backend (FR-7). Pure SQL reads against the `.tgdb` — no Telethon dependency,
safe to build and use ahead of Phase 1's live-Telegram validation gate: seed-imported
channels (sidecar/seed.py) already populate `channels`, so this is queryable and
UI-testable with zero real collected data.
"""

import aiosqlite

from sidecar.db import DEFAULT_TGDB_PATH


async def get_graph(path=DEFAULT_TGDB_PATH) -> dict:
    """Sigma.js/graphology-compatible {nodes, edges} — matches the shape
    `mockGraph.ts`'s synthetic data used for the Phase 1 performance validation
    (sidecar/validation/RESULTS.md), so the same React rendering code handles both."""
    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        channel_rows = await conn.execute_fetchall(
            "SELECT rowid, id, username, title, relevance_score, type FROM channels"
        )
        edge_rows = await conn.execute_fetchall(
            "SELECT id, from_id, to_id, edge_type, weight FROM edges"
        )

    nodes = [
        {
            # Not-yet-collected seed rows have `id IS NULL` (see identity contract,
            # docs/timelines/TELEGRAM_TIMELINE.md Slice 1) — falling back to
            # `str(row["id"])` for all of them would collapse every uncollected seed
            # onto the same "None" node key, so key by the real peer id once known and
            # by the row's own SQLite rowid (unique per seed) until then.
            "key": str(row["id"]) if row["id"] is not None else f"seed-{row['rowid']}",
            "attributes": {
                "label": row["title"] or row["username"] or f"channel-{row['id']}",
                "size": 3 + 5 * (row["relevance_score"] or 0),
                "color": "#ef4444" if (row["relevance_score"] or 0) > 0.5 else "#3b82f6",
            },
        }
        for row in channel_rows
    ]
    # An edge is written the moment a neighbor resolves (expander.py), which is before
    # the crawler has collected that neighbor — until then its `channels` row has
    # `id IS NULL` and is therefore keyed `seed-<rowid>`, not by the peer id the edge
    # points at. Emitting that edge would hand graphology a target node it has never
    # seen, which throws rather than degrades. Drop the dangling ones here; each starts
    # rendering on its own once its endpoint is collected and gains a real id.
    node_keys = {node["key"] for node in nodes}
    edges = [
        {
            "key": f"edge-{row['id']}",
            "source": str(row["from_id"]),
            "target": str(row["to_id"]),
            "attributes": {"edgeType": row["edge_type"], "weight": row["weight"]},
        }
        for row in edge_rows
        if str(row["from_id"]) in node_keys and str(row["to_id"]) in node_keys
    ]
    return {"nodes": nodes, "edges": edges}


async def get_graph_counts(path=DEFAULT_TGDB_PATH) -> dict:
    """Cheaper than `get_graph()` for a caller (Slice 7's WS stream) that only needs
    counts every tick, not the full node/edge attribute payload."""
    async with aiosqlite.connect(path) as conn:
        node_count = (await (await conn.execute("SELECT COUNT(*) FROM channels")).fetchone())[0]
        edge_count = (await (await conn.execute("SELECT COUNT(*) FROM edges")).fetchone())[0]
    return {"node_count": node_count, "edge_count": edge_count}


async def search(query: str, path=DEFAULT_TGDB_PATH, limit: int = 50) -> list[dict]:
    """Cross-graph search across channel title/username and extracted entity values."""
    like_pattern = f"%{query}%"
    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row

        channel_matches = await conn.execute_fetchall(
            """
            SELECT id, username, title, relevance_score FROM channels
            WHERE title LIKE ? OR username LIKE ?
            LIMIT ?
            """,
            (like_pattern, like_pattern, limit),
        )
        entity_matches = await conn.execute_fetchall(
            """
            SELECT id, source_id, source_type, entity_type, value, confidence
            FROM entities_extracted
            WHERE value LIKE ?
            LIMIT ?
            """,
            (like_pattern, limit),
        )

    return [
        {"kind": "channel", "id": row["id"], "label": row["title"] or row["username"]}
        for row in channel_matches
    ] + [
        {
            "kind": "entity",
            "id": row["id"],
            "label": row["value"],
            "entityType": row["entity_type"],
            "sourceId": row["source_id"],
        }
        for row in entity_matches
    ]

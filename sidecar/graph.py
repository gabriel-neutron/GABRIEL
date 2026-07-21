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
            "SELECT id, username, title, relevance_score, type FROM channels"
        )
        edge_rows = await conn.execute_fetchall(
            "SELECT id, from_id, to_id, edge_type, weight FROM edges"
        )

    nodes = [
        {
            "key": str(row["id"]),
            "attributes": {
                "label": row["title"] or row["username"] or f"channel-{row['id']}",
                "size": 3 + 5 * (row["relevance_score"] or 0),
                "color": "#ef4444" if (row["relevance_score"] or 0) > 0.5 else "#3b82f6",
            },
        }
        for row in channel_rows
    ]
    edges = [
        {
            "key": f"edge-{row['id']}",
            "source": str(row["from_id"]),
            "target": str(row["to_id"]),
            "attributes": {"edgeType": row["edge_type"], "weight": row["weight"]},
        }
        for row in edge_rows
    ]
    return {"nodes": nodes, "edges": edges}


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

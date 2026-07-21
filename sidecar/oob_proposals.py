"""
OOB proposal persistence (Phase 7's CRUD layer). Separate from `oob_matcher.py`'s pure
matching function — this owns the `oob_proposals` table only. `oob_entity_id` is stored
as an opaque string throughout: this layer never reads or validates it against a real
`.gpkg` (that's `gpkg_reader.py`, deliberately not built — see `oob_matcher.py`'s
docstring), so it has no Telegram or `.gpkg` dependency and is safe to build ahead of
Phase 1's validation gate.
"""

from datetime import datetime, timezone

import aiosqlite

from sidecar.db import DEFAULT_TGDB_PATH
from sidecar.oob_matcher import find_match_candidates


async def create_proposals_for_channel(
    channel_id: int, channel_name: str, oob_entity_names: dict[str, str], path=DEFAULT_TGDB_PATH
) -> list[int]:
    """Runs the matcher and persists any candidates at/above threshold. Returns the new
    `oob_proposals` row ids. Does not dedupe against previously-decided proposals for the
    same (channel_id, oob_entity_id) pair — callers doing repeated matching should filter
    already-decided pairs first; left to the caller since Phase 7's real flow (Phase 5
    crawl output feeding this repeatedly) doesn't exist yet to shape that decision."""
    candidates = find_match_candidates(channel_name, oob_entity_names)
    if not candidates:
        return []

    inserted_ids = []
    async with aiosqlite.connect(path) as conn:
        for candidate in candidates:
            cursor = await conn.execute(
                """
                INSERT INTO oob_proposals (channel_id, oob_entity_id, confidence, evidence_text, status)
                VALUES (?, ?, ?, ?, 'pending')
                """,
                (channel_id, candidate["oob_entity_id"], candidate["confidence"], candidate["evidence_text"]),
            )
            inserted_ids.append(cursor.lastrowid)
        await conn.commit()

    return inserted_ids


async def list_pending(path=DEFAULT_TGDB_PATH) -> list[dict]:
    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        rows = await conn.execute_fetchall(
            """
            SELECT p.id, p.channel_id, p.oob_entity_id, p.confidence, p.evidence_text,
                   c.username, c.title
            FROM oob_proposals p
            JOIN channels c ON c.id = p.channel_id
            WHERE p.status = 'pending'
            ORDER BY p.confidence DESC
            """
        )
    return [dict(row) for row in rows]


async def decide(proposal_id: int, status: str, path=DEFAULT_TGDB_PATH) -> dict | None:
    """`status` must be 'accepted' or 'rejected'. Returns the decided proposal's
    {oob_entity_id, channel_url} on accept (the caller — React — writes the URL into the
    .gpkg via geopackage.service.ts; this sidecar never touches the .gpkg), or None if
    the id doesn't exist or was already decided."""
    if status not in ("accepted", "rejected"):
        raise ValueError(f"status must be 'accepted' or 'rejected', got {status!r}")

    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        row = await conn.execute_fetchall(
            """
            SELECT p.oob_entity_id, c.username
            FROM oob_proposals p
            JOIN channels c ON c.id = p.channel_id
            WHERE p.id = ? AND p.status = 'pending'
            """,
            (proposal_id,),
        )
        if not row:
            return None

        await conn.execute(
            "UPDATE oob_proposals SET status = ?, decided_at = ? WHERE id = ?",
            (status, now, proposal_id),
        )
        await conn.commit()

    oob_entity_id, username = row[0]["oob_entity_id"], row[0]["username"]
    return {"oob_entity_id": oob_entity_id, "channel_url": f"https://t.me/{username}"}

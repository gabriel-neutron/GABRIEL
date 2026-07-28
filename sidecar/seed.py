"""
Seed import (FR-1, Phase 3). Inserts channel usernames/IDs as `status='seed'` rows —
no Telethon call here; a channel only gets real metadata once collector.py (Phase 3
collection, still gated on Phase 1 validation) actually fetches it. This file only
owns the DB-side bookkeeping of "the analyst wants this channel in the graph."
"""

import csv
import io
from datetime import datetime, timezone

import aiosqlite

from sidecar.db import DEFAULT_TGDB_PATH


def parse_seed_csv(csv_text: str) -> list[str]:
    """One channel username/ID per row; tolerates a header row and blank lines."""
    usernames: list[str] = []
    reader = csv.reader(io.StringIO(csv_text))
    for row in reader:
        if not row:
            continue
        value = row[0].strip().lstrip("@")
        if not value or value.lower() in ("username", "channel", "id"):
            continue
        usernames.append(value)
    return usernames


async def import_seeds(usernames: list[str], path=DEFAULT_TGDB_PATH) -> list[str]:
    """Insert each username as a seed channel if not already present (by username).
    Returns the usernames of newly-inserted channels (existing ones are skipped, not
    duplicated or reset).

    The PRD's `channels` table (docs/TELEGRAM_OSINT_PRD.md's Data Model) has no `status`
    column even though the timeline's Phase 3 task list says "insert channels with
    status=seed" — `type` is repurposed to hold `'seed'` until Phase 3's real
    collector.py overwrites it with the actual Telethon-reported type
    ('channel'/'group'), giving collection code an unambiguous "not yet collected" marker
    to query against (`WHERE type = 'seed'`).

    Deliberately does not assign `id` (per the identity contract, `channels.id` IS the
    Telegram peer ID — a seed row has no real id yet, so it stays NULL and is looked up
    by `username` until `collector.py`'s reconciliation upsert resolves it on first
    collection; see docs/timelines/TELEGRAM_TIMELINE.md Slice 1). Returning `username`
    instead of a surrogate rowid keeps callers from treating the row's SQLite rowid as a
    meaningful identifier."""
    now = datetime.now(timezone.utc).isoformat()
    inserted_usernames: list[str] = []

    async with aiosqlite.connect(path) as conn:
        for username in usernames:
            existing = await conn.execute_fetchall(
                "SELECT username FROM channels WHERE username = ?", (username,)
            )
            if existing:
                continue
            await conn.execute(
                """
                INSERT INTO channels (username, title, type, is_private, collected_at, raw_json)
                VALUES (?, ?, 'seed', 0, ?, '{}')
                """,
                (username, username, now),
            )
            inserted_usernames.append(username)
        await conn.commit()

    return inserted_usernames

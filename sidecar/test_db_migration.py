"""
Tests for `sidecar/db.py`'s identity-contract migration (Slice 1,
docs/timelines/TELEGRAM_TIMELINE.md): a pre-existing `channels` table with the old
`id INTEGER PRIMARY KEY` schema must be rebuilt so `id` can genuinely be NULL for
not-yet-collected seed rows, without losing already-collected data.
"""

from pathlib import Path

import aiosqlite
import pytest

from sidecar import db

OLD_SCHEMA = """
CREATE TABLE channels (
    id INTEGER PRIMARY KEY,
    username TEXT,
    title TEXT,
    description TEXT,
    member_count INTEGER,
    type TEXT,
    relevance_score REAL,
    is_private INTEGER,
    collected_at TEXT,
    raw_json TEXT
);
"""


@pytest.mark.asyncio
async def test_migrates_old_seed_row_id_to_null(tmp_path: Path):
    path = tmp_path / "old.tgdb"
    async with aiosqlite.connect(path) as conn:
        await conn.executescript(OLD_SCHEMA)
        await conn.execute(
            "INSERT INTO channels (username, title, type, is_private, raw_json) "
            "VALUES ('seedchan', 'seedchan', 'seed', 0, '{}')"
        )
        await conn.commit()

    await db.init_db(path)

    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        rows = await conn.execute_fetchall("SELECT * FROM channels")

    assert len(rows) == 1
    assert rows[0]["id"] is None
    assert rows[0]["username"] == "seedchan"


@pytest.mark.asyncio
async def test_migration_preserves_already_collected_channel_id(tmp_path: Path):
    path = tmp_path / "old.tgdb"
    async with aiosqlite.connect(path) as conn:
        await conn.executescript(OLD_SCHEMA)
        await conn.execute(
            "INSERT INTO channels (id, username, title, type, is_private, raw_json) "
            "VALUES (5555, 'realchan', 'Real', 'channel', 0, '{}')"
        )
        await conn.commit()

    await db.init_db(path)

    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        rows = await conn.execute_fetchall("SELECT * FROM channels")

    assert len(rows) == 1
    assert rows[0]["id"] == 5555


@pytest.mark.asyncio
async def test_migration_is_idempotent(tmp_path: Path):
    path = tmp_path / "old.tgdb"
    async with aiosqlite.connect(path) as conn:
        await conn.executescript(OLD_SCHEMA)
        await conn.commit()

    await db.init_db(path)
    await db.init_db(path)  # second run must not error or rebuild again

    async with aiosqlite.connect(path) as conn:
        cursor = await conn.execute("PRAGMA table_info(channels)")
        id_column = next(row for row in await cursor.fetchall() if row[1] == "id")
    assert id_column[5] == 0  # no longer a PRIMARY KEY


@pytest.mark.asyncio
async def test_fresh_db_has_no_surrogate_id_pk(tmp_path: Path):
    path = tmp_path / "fresh.tgdb"
    await db.init_db(path)

    async with aiosqlite.connect(path) as conn:
        cursor = await conn.execute("PRAGMA table_info(channels)")
        id_column = next(row for row in await cursor.fetchall() if row[1] == "id")
    assert id_column[5] == 0

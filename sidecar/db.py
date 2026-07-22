"""SQLite (.tgdb) schema init and connection helper. No React/FastAPI imports here."""

from pathlib import Path

import aiosqlite

DEFAULT_TGDB_PATH = Path(__file__).parent / "project.tgdb"

SCHEMA = """
-- `id` is the Telegram peer ID, not a SQLite-assigned surrogate — it is NULL until a
-- seed channel is actually collected (see `sidecar/seed.py` and `sidecar/collector.py`'s
-- reconciliation upsert), so it deliberately carries no PRIMARY KEY/AUTOINCREMENT
-- semantics that would hand out a fake id colliding with real peer ID space. `UNIQUE`
-- alone permits multiple NULL rows (SQL NULL != NULL) while still enforcing uniqueness
-- once a real id is known.
CREATE TABLE IF NOT EXISTS channels (
    id INTEGER UNIQUE,
    username TEXT UNIQUE,
    title TEXT,
    description TEXT,
    member_count INTEGER,
    type TEXT,
    relevance_score REAL,
    is_private INTEGER,
    collected_at TEXT,
    raw_json TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    is_bot INTEGER,
    collected_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id),
    message_id INTEGER,
    text TEXT,
    date TEXT,
    view_count INTEGER,
    raw_json TEXT
);

CREATE TABLE IF NOT EXISTS entities_extracted (
    id INTEGER PRIMARY KEY,
    source_id INTEGER,
    source_type TEXT,
    entity_type TEXT,
    value TEXT,
    confidence REAL,
    oob_entity_id TEXT
);

CREATE TABLE IF NOT EXISTS edges (
    id INTEGER PRIMARY KEY,
    from_id INTEGER NOT NULL REFERENCES channels(id),
    to_id INTEGER NOT NULL REFERENCES channels(id),
    edge_type TEXT NOT NULL,
    weight REAL,
    collected_at TEXT
);

CREATE TABLE IF NOT EXISTS crawl_sessions (
    id INTEGER PRIMARY KEY,
    started_at TEXT,
    status TEXT,
    depth_limit INTEGER,
    current_depth INTEGER,
    seed_ids TEXT
);
-- frontier_json/visited_json added via idempotent migration below, not here — kept out
-- of the PRD's literal schema listing (docs/TELEGRAM_OSINT_PRD.md) which doesn't name
-- them, but required to actually implement "persist the BFS frontier so paused crawls
-- can resume" (timeline Phase 5 task). See migrate_crawl_sessions_columns().

CREATE TABLE IF NOT EXISTS oob_proposals (
    id INTEGER PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id),
    oob_entity_id TEXT,
    confidence REAL,
    evidence_text TEXT,
    status TEXT DEFAULT 'pending',
    decided_at TEXT
);

-- Slice 3's persistent budget ledger (docs/issues/TELEGRAM_PHASE3_ISSUES.md,
-- sidecar/governor.py) — a single row (id=1, enforced by the CHECK) so the governor can
-- reload it on every governed call instead of trusting any in-memory-only counter (the
-- anti-pattern `sidecar/choke.py`'s `_cold_start_call_count` module global is; a
-- restart/`uvicorn --reload` must not reset the hourly/daily counts, the warm-up clock,
-- the cooldown state, or the kill-switch latch).
CREATE TABLE IF NOT EXISTS governor_ledger (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    first_call_at TEXT,
    hour_window_start TEXT,
    day_window_start TEXT,
    metadata_count INTEGER NOT NULL DEFAULT 0,
    history_count INTEGER NOT NULL DEFAULT 0,
    resolve_count INTEGER NOT NULL DEFAULT 0,
    daily_count INTEGER NOT NULL DEFAULT 0,
    cooldown_until TEXT,
    cooldown_multiplier REAL NOT NULL DEFAULT 1.0,
    cooldown_tighten_level INTEGER NOT NULL DEFAULT 0,
    flood_wait_events_json TEXT NOT NULL DEFAULT '[]',
    kill_switch_tripped INTEGER NOT NULL DEFAULT 0,
    kill_switch_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_channel_message_unique ON messages(channel_id, message_id);
CREATE INDEX IF NOT EXISTS idx_edges_from_id ON edges(from_id);
CREATE INDEX IF NOT EXISTS idx_edges_to_id ON edges(to_id);
CREATE INDEX IF NOT EXISTS idx_oob_proposals_status ON oob_proposals(status);
"""


async def migrate_crawl_sessions_columns(conn: aiosqlite.Connection) -> None:
    """Idempotent column-add migration, same feature-detection approach as
    `src/core/persistence/geopackage/columnDescriptor.ts`'s `getTableColumnNames` on the
    TS side — SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so check first."""
    cursor = await conn.execute("PRAGMA table_info(crawl_sessions)")
    existing_columns = {row[1] async for row in cursor}
    if "frontier_json" not in existing_columns:
        await conn.execute("ALTER TABLE crawl_sessions ADD COLUMN frontier_json TEXT")
    if "visited_json" not in existing_columns:
        await conn.execute("ALTER TABLE crawl_sessions ADD COLUMN visited_json TEXT")


async def migrate_messages_columns(conn: aiosqlite.Connection) -> None:
    """Idempotent column-add migration for `raw_json`, added alongside Slice 1's
    identity-contract fix so collected messages keep the same "raw JSON is
    authoritative" guarantee as `channels`."""
    cursor = await conn.execute("PRAGMA table_info(messages)")
    existing_columns = {row[1] async for row in cursor}
    if "raw_json" not in existing_columns:
        await conn.execute("ALTER TABLE messages ADD COLUMN raw_json TEXT")


async def migrate_channels_identity(conn: aiosqlite.Connection) -> None:
    """Rebuilds `channels` if it still has the old `id INTEGER PRIMARY KEY` schema —
    SQLite has no `ALTER TABLE ... DROP CONSTRAINT`, so a pre-existing table (from before
    Slice 1's identity-contract fix, docs/issues/TELEGRAM_PHASE3_ISSUES.md) must be
    recreated. `id` stops being SQLite's rowid alias so a not-yet-collected seed row can
    genuinely have no id, instead of an autoincrement surrogate that collides with real
    Telegram peer ID space. Existing `type='seed'` rows (never collected) have their
    surrogate id cleared to NULL; already-collected rows keep their id as-is (it should
    already be a real peer id)."""
    cursor = await conn.execute("PRAGMA table_info(channels)")
    columns = {row[1]: row for row in await cursor.fetchall()}
    id_column = columns.get("id")
    if id_column is None or id_column[5] == 0:  # row[5] is the `pk` flag
        return

    await conn.execute("ALTER TABLE channels RENAME TO channels_old_pk_migration")
    await conn.execute(
        """
        CREATE TABLE channels (
            id INTEGER UNIQUE,
            username TEXT UNIQUE,
            title TEXT,
            description TEXT,
            member_count INTEGER,
            type TEXT,
            relevance_score REAL,
            is_private INTEGER,
            collected_at TEXT,
            raw_json TEXT
        )
        """
    )
    await conn.execute(
        """
        INSERT INTO channels (id, username, title, description, member_count, type,
                               relevance_score, is_private, collected_at, raw_json)
        SELECT CASE WHEN type = 'seed' THEN NULL ELSE id END,
               username, title, description, member_count, type,
               relevance_score, is_private, collected_at, raw_json
        FROM channels_old_pk_migration
        """
    )
    await conn.execute("DROP TABLE channels_old_pk_migration")


async def init_db(path: Path = DEFAULT_TGDB_PATH) -> None:
    """Create all tables if they don't exist. Safe to call on every startup."""
    async with aiosqlite.connect(path) as conn:
        await conn.executescript(SCHEMA)
        await migrate_crawl_sessions_columns(conn)
        await migrate_messages_columns(conn)
        await migrate_channels_identity(conn)
        await conn.commit()


async def get_connection(path: Path = DEFAULT_TGDB_PATH) -> aiosqlite.Connection:
    return await aiosqlite.connect(path)

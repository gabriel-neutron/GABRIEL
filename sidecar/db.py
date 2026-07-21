"""SQLite (.tgdb) schema init and connection helper. No React/FastAPI imports here."""

from pathlib import Path

import aiosqlite

DEFAULT_TGDB_PATH = Path(__file__).parent / "project.tgdb"

SCHEMA = """
CREATE TABLE IF NOT EXISTS channels (
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
    view_count INTEGER
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

CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
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


async def init_db(path: Path = DEFAULT_TGDB_PATH) -> None:
    """Create all tables if they don't exist. Safe to call on every startup."""
    async with aiosqlite.connect(path) as conn:
        await conn.executescript(SCHEMA)
        await migrate_crawl_sessions_columns(conn)
        await conn.commit()


async def get_connection(path: Path = DEFAULT_TGDB_PATH) -> aiosqlite.Connection:
    return await aiosqlite.connect(path)

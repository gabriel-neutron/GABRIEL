"""
Phase 1 validation — SQLite (.tgdb) data volume and query performance.

Run manually: `python validation/06_sqlite_volume.py`

No Telegram/OpenAI credentials needed. Populates a synthetic `.tgdb` with the PRD's
medium-scale estimate (1,000 channels, 3M messages, 500K users, 2M edges), then
measures file size and query time for: 2-hop graph traversal, full-text search on
messages, and relevance-score sort — without additional indexes, matching the exit
criterion "acceptable performance without additional indexes."
"""

import random
import sqlite3
import time
from pathlib import Path

DB_PATH = Path(__file__).parent / "volume_test.tgdb"
N_CHANNELS = 1_000
N_MESSAGES = 3_000_000
N_USERS = 500_000
N_EDGES = 2_000_000

SCHEMA = """
CREATE TABLE channels (
    id INTEGER PRIMARY KEY, username TEXT, title TEXT, description TEXT,
    member_count INTEGER, type TEXT, relevance_score REAL, is_private INTEGER,
    collected_at TEXT, raw_json TEXT
);
CREATE TABLE users (
    id INTEGER PRIMARY KEY, username TEXT, first_name TEXT, last_name TEXT,
    is_bot INTEGER, collected_at TEXT
);
CREATE TABLE messages (
    id INTEGER PRIMARY KEY, channel_id INTEGER, message_id INTEGER, text TEXT,
    date TEXT, view_count INTEGER
);
CREATE TABLE edges (
    id INTEGER PRIMARY KEY, from_id INTEGER, to_id INTEGER, edge_type TEXT,
    weight REAL, collected_at TEXT
);
"""

SAMPLE_WORDS = ["батальон", "бригада", "МУН", "оружие", "личный состав", "техника", "командир"]


def populate() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)

    conn.executemany(
        "INSERT INTO channels VALUES (?,?,?,?,?,?,?,?,?,?)",
        (
            (i, f"chan{i}", f"Channel {i}", "test description", random.randint(10, 50000),
             "channel", random.random(), random.randint(0, 1), "2026-01-01", "{}")
            for i in range(N_CHANNELS)
        ),
    )
    conn.executemany(
        "INSERT INTO users VALUES (?,?,?,?,?,?)",
        ((i, f"user{i}", "First", "Last", 0, "2026-01-01") for i in range(N_USERS)),
    )
    conn.executemany(
        "INSERT INTO messages VALUES (?,?,?,?,?,?)",
        (
            (i, random.randint(0, N_CHANNELS - 1), i,
             " ".join(random.choices(SAMPLE_WORDS, k=10)), "2026-01-01", random.randint(0, 10000))
            for i in range(N_MESSAGES)
        ),
    )
    conn.executemany(
        "INSERT INTO edges VALUES (?,?,?,?,?,?)",
        (
            (i, random.randint(0, N_CHANNELS - 1), random.randint(0, N_CHANNELS - 1),
             random.choice(["LINKED_CHANNEL", "SHARED_ADMIN", "SHARED_MEMBER", "MENTIONS"]),
             random.random(), "2026-01-01")
            for i in range(N_EDGES)
        ),
    )
    conn.commit()
    conn.close()


# Matches sidecar/db.py's actual schema — re-measuring with these applied is what closes
# the Phase 1 SQLite exit criterion for real, instead of leaving the unindexed 12.9s
# result as the last word.
INDEXES = """
CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_edges_from_id ON edges(from_id);
CREATE INDEX idx_edges_to_id ON edges(to_id);
CREATE INDEX idx_channels_relevance_score ON channels(relevance_score);
"""


def measure(label: str) -> None:
    conn = sqlite3.connect(DB_PATH)

    start = time.monotonic()
    conn.execute(
        """
        SELECT DISTINCT e2.to_id FROM edges e1
        JOIN edges e2 ON e1.to_id = e2.from_id
        WHERE e1.from_id = ?
        """,
        (random.randint(0, N_CHANNELS - 1),),
    ).fetchall()
    two_hop_s = time.monotonic() - start

    start = time.monotonic()
    conn.execute("SELECT id FROM messages WHERE text LIKE ? LIMIT 100", ("%батальон%",)).fetchall()
    fts_s = time.monotonic() - start

    start = time.monotonic()
    conn.execute("SELECT id FROM channels ORDER BY relevance_score DESC LIMIT 100").fetchall()
    sort_s = time.monotonic() - start

    conn.close()

    print(f"--- {label} ---")
    print(f"DB file size: {DB_PATH.stat().st_size / 1024 / 1024:.1f} MB")
    print(f"2-hop traversal: {two_hop_s * 1000:.1f} ms")
    print(f"Message text LIKE search: {fts_s * 1000:.1f} ms")
    print(f"Relevance score sort: {sort_s * 1000:.1f} ms")
    print()


def apply_indexes() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(INDEXES)
    conn.commit()
    conn.close()


if __name__ == "__main__":
    print(f"Populating synthetic .tgdb at {DB_PATH} ...")
    populate()
    measure("without indexes")
    print("Applying sidecar/db.py's indexes...")
    apply_indexes()
    measure("with sidecar/db.py's indexes")
    print("Exit criterion: query time < 2s. Record both passes in sidecar/validation/RESULTS.md,")
    print("then delete volume_test.tgdb.")

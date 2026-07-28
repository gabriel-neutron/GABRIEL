"""
Collector tests (Slice 1, docs/timelines/TELEGRAM_TIMELINE.md), against a real
temp SQLite file and the `FakeChannelSource` test double — never a live Telegram call
or an emulated Telethon shape.
"""

from pathlib import Path

import aiosqlite
import pytest
import pytest_asyncio

from sidecar import collector, db, seed
from sidecar.channel_source import ChannelMeta, FakeChannelSource, MessageRecord


@pytest_asyncio.fixture
async def tgdb_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.tgdb"
    await db.init_db(path)
    return path


def _meta(**overrides) -> ChannelMeta:
    defaults = dict(
        id=1001,
        username="realchan",
        title="Real Channel",
        description="a channel",
        member_count=42,
        type="channel",
        is_private=False,
        raw_json="{}",
    )
    defaults.update(overrides)
    return ChannelMeta(**defaults)


async def _fetch_channel_rows(path: Path) -> list[dict]:
    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        rows = await conn.execute_fetchall("SELECT * FROM channels")
    return [dict(row) for row in rows]


async def _fetch_message_rows(path: Path) -> list[dict]:
    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        rows = await conn.execute_fetchall("SELECT * FROM messages")
    return [dict(row) for row in rows]


@pytest.mark.asyncio
async def test_fresh_collect_inserts_channel_and_messages(tgdb_path):
    source = FakeChannelSource(
        metadata={"realchan": _meta()},
        messages={"realchan": [MessageRecord(message_id=1, text="hi", date="2026-07-20", view_count=3, raw_json="{}")]},
    )

    result = await collector.collect_channel("realchan", source, path=tgdb_path)

    assert result == {"channel_id": 1001, "messages_collected": 1}
    channels = await _fetch_channel_rows(tgdb_path)
    assert len(channels) == 1
    assert channels[0]["id"] == 1001
    assert channels[0]["username"] == "realchan"
    assert channels[0]["member_count"] == 42

    messages = await _fetch_message_rows(tgdb_path)
    assert len(messages) == 1
    assert messages[0]["channel_id"] == 1001
    assert messages[0]["message_id"] == 1


@pytest.mark.asyncio
async def test_seed_then_collect_reconciles_same_row_no_duplicate(tgdb_path):
    """Identity contract acceptance criterion: a seed and its later-discovered self do
    not produce duplicate rows."""
    await seed.import_seeds(["realchan"], path=tgdb_path)
    seeded = await _fetch_channel_rows(tgdb_path)
    assert len(seeded) == 1
    assert seeded[0]["id"] is None
    assert seeded[0]["type"] == "seed"

    source = FakeChannelSource(metadata={"realchan": _meta()}, messages={})
    result = await collector.collect_channel("realchan", source, path=tgdb_path)

    assert result["channel_id"] == 1001
    channels = await _fetch_channel_rows(tgdb_path)
    assert len(channels) == 1  # reconciled in place, not a second row
    assert channels[0]["id"] == 1001
    assert channels[0]["type"] == "channel"


@pytest.mark.asyncio
async def test_recollecting_same_channel_is_idempotent(tgdb_path):
    source = FakeChannelSource(
        metadata={"realchan": _meta()},
        messages={"realchan": [MessageRecord(message_id=1, text="hi", date="2026-07-20", view_count=3, raw_json="{}")]},
    )

    await collector.collect_channel("realchan", source, path=tgdb_path)
    await collector.collect_channel("realchan", source, path=tgdb_path)

    channels = await _fetch_channel_rows(tgdb_path)
    assert len(channels) == 1

    messages = await _fetch_message_rows(tgdb_path)
    assert len(messages) == 1  # UNIQUE(channel_id, message_id) — updated, not duplicated


@pytest.mark.asyncio
async def test_recollecting_updates_message_text_in_place(tgdb_path):
    source_v1 = FakeChannelSource(
        metadata={"realchan": _meta()},
        messages={"realchan": [MessageRecord(message_id=1, text="v1", date="2026-07-20", view_count=1, raw_json="{}")]},
    )
    source_v2 = FakeChannelSource(
        metadata={"realchan": _meta()},
        messages={"realchan": [MessageRecord(message_id=1, text="v2 edited", date="2026-07-20", view_count=9, raw_json="{}")]},
    )

    await collector.collect_channel("realchan", source_v1, path=tgdb_path)
    await collector.collect_channel("realchan", source_v2, path=tgdb_path)

    messages = await _fetch_message_rows(tgdb_path)
    assert len(messages) == 1
    assert messages[0]["text"] == "v2 edited"
    assert messages[0]["view_count"] == 9


@pytest.mark.asyncio
async def test_collect_with_none_member_count_stores_null(tgdb_path):
    source = FakeChannelSource(metadata={"realchan": _meta(member_count=None)}, messages={})

    await collector.collect_channel("realchan", source, path=tgdb_path)

    channels = await _fetch_channel_rows(tgdb_path)
    assert channels[0]["member_count"] is None


@pytest.mark.asyncio
async def test_collect_unrelated_channel_does_not_touch_other_seeds(tgdb_path):
    await seed.import_seeds(["seed_a", "seed_b"], path=tgdb_path)

    source = FakeChannelSource(metadata={"seed_a": _meta(id=2002, username="seed_a")}, messages={})
    await collector.collect_channel("seed_a", source, path=tgdb_path)

    channels = {row["username"]: row for row in await _fetch_channel_rows(tgdb_path)}
    assert channels["seed_a"]["id"] == 2002
    assert channels["seed_b"]["id"] is None
    assert channels["seed_b"]["type"] == "seed"

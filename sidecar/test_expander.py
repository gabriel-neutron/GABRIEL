"""
`expand_channel` tests (Slice 2, docs/timelines/TELEGRAM_TIMELINE.md) — against a real
temp SQLite file populated by actually running `collector.collect_channel` (Slice 1)
against a `FakeChannelSource`, never synthetic rows inserted by hand, and a
`FakeUsernameResolver` double — never a live Telegram call or an emulated Telethon
shape.
"""

import inspect
from pathlib import Path

import aiosqlite
import pytest
import pytest_asyncio

from sidecar import collector, db, edges, expander, seed, telegram_channel_source, username_resolver
from sidecar.channel_source import ChannelMeta, FakeChannelSource, MessageRecord
from sidecar.username_resolver import FakeUsernameResolver


@pytest_asyncio.fixture
async def tgdb_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.tgdb"
    await db.init_db(path)
    return path


async def _channel_rows(path: Path) -> list[dict]:
    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        rows = await conn.execute_fetchall("SELECT * FROM channels")
    return [dict(row) for row in rows]


@pytest.mark.asyncio
async def test_expand_channel_resolves_linked_and_keyword_mentioned_neighbors(tgdb_path):
    # chanc is already known (seeded) so its bare-name mention is a keyword-mention
    # candidate, not just a t.me/ link.
    await seed.import_seeds(["chanc"], path=tgdb_path)

    source = FakeChannelSource(
        metadata={
            "chana": ChannelMeta(
                id=1001,
                username="chana",
                title="Chan A",
                description="Come join https://t.me/chanb and https://t.me/chand",
                member_count=10,
                type="channel",
                is_private=False,
                raw_json="{}",
            )
        },
        messages={
            "chana": [
                MessageRecord(
                    message_id=1, text="Shoutout to ChanC for the info", date="2026-07-22",
                    view_count=1, raw_json="{}",
                )
            ]
        },
    )
    await collector.collect_channel("chana", source, path=tgdb_path)

    resolver = FakeUsernameResolver({"chanb": 2002, "chanc": 3003})

    result = await expander.expand_channel(1001, resolver, path=tgdb_path)

    assert sorted(result) == [2002, 3003]  # chand unresolved, dropped


@pytest.mark.asyncio
async def test_expand_channel_upserts_placeholder_for_new_resolved_neighbor(tgdb_path):
    source = FakeChannelSource(
        metadata={
            "chana": ChannelMeta(
                id=1001, username="chana", title="Chan A",
                description="https://t.me/chanb", member_count=10, type="channel",
                is_private=False, raw_json="{}",
            )
        },
        messages={},
    )
    await collector.collect_channel("chana", source, path=tgdb_path)

    resolver = FakeUsernameResolver({"chanb": 2002})
    await expander.expand_channel(1001, resolver, path=tgdb_path)

    channels = {row["username"]: row for row in await _channel_rows(tgdb_path)}
    assert "chanb" in channels
    assert channels["chanb"]["id"] is None  # placeholder — resolved to real Telegram
    assert channels["chanb"]["type"] == "seed"  # id only via a real collect (Slice 1's contract)


@pytest.mark.asyncio
async def test_expand_channel_does_not_duplicate_already_known_neighbor(tgdb_path):
    """A resolved neighbor that's already a seed/collected row is not touched a second
    time — `seed.import_seeds`'s own dedup-by-username, reused rather than
    reimplemented."""
    await seed.import_seeds(["chanb"], path=tgdb_path)

    source = FakeChannelSource(
        metadata={
            "chana": ChannelMeta(
                id=1001, username="chana", title="Chan A",
                description="https://t.me/chanb", member_count=10, type="channel",
                is_private=False, raw_json="{}",
            )
        },
        messages={},
    )
    await collector.collect_channel("chana", source, path=tgdb_path)

    resolver = FakeUsernameResolver({"chanb": 2002})
    result = await expander.expand_channel(1001, resolver, path=tgdb_path)

    assert result == [2002]
    channels = await _channel_rows(tgdb_path)
    assert len([c for c in channels if c["username"] == "chanb"]) == 1


@pytest.mark.asyncio
async def test_expand_channel_drops_unresolvable_usernames_without_enqueueing_or_upserting(tgdb_path):
    source = FakeChannelSource(
        metadata={
            "chana": ChannelMeta(
                id=1001, username="chana", title="Chan A",
                description="https://t.me/ghostchannel", member_count=10, type="channel",
                is_private=False, raw_json="{}",
            )
        },
        messages={},
    )
    await collector.collect_channel("chana", source, path=tgdb_path)

    resolver = FakeUsernameResolver({})  # nothing resolves
    result = await expander.expand_channel(1001, resolver, path=tgdb_path)

    assert result == []
    channels = await _channel_rows(tgdb_path)
    assert "ghostchannel" not in {c["username"] for c in channels}


@pytest.mark.asyncio
async def test_expand_channel_excludes_self_mention(tgdb_path):
    source = FakeChannelSource(
        metadata={
            "chana": ChannelMeta(
                id=1001, username="chana", title="Chan A",
                description="Official channel: https://t.me/chana", member_count=10,
                type="channel", is_private=False, raw_json="{}",
            )
        },
        messages={},
    )
    await collector.collect_channel("chana", source, path=tgdb_path)

    resolver = FakeUsernameResolver({"chana": 1001})
    result = await expander.expand_channel(1001, resolver, path=tgdb_path)

    assert result == []


@pytest.mark.asyncio
async def test_expand_channel_returns_empty_for_channel_with_no_text(tgdb_path):
    source = FakeChannelSource(
        metadata={
            "chana": ChannelMeta(
                id=1001, username="chana", title="Chan A", description=None,
                member_count=10, type="channel", is_private=False, raw_json="{}",
            )
        },
        messages={},
    )
    await collector.collect_channel("chana", source, path=tgdb_path)

    resolver = FakeUsernameResolver({"chanb": 2002})
    result = await expander.expand_channel(1001, resolver, path=tgdb_path)

    assert result == []


def test_expand_channel_issues_no_member_enumeration_call():
    """Structural, not a comment: neither this module nor the seams it composes can
    reach `GetParticipants`/`fetch_participants` — provable by source inspection of the
    actual code (imports + function bodies), not by trusting a docstring."""
    for module in (expander, username_resolver):
        for _, obj in inspect.getmembers(module):
            if inspect.isfunction(obj) or inspect.isclass(obj):
                code = inspect.getsource(obj)
                assert "GetParticipants" not in code
                assert "fetch_participants" not in code

    assert not any(name == "telethon" for name in getattr(expander, "__dict__", {}))
    assert not any(name == "telethon" for name in getattr(username_resolver, "__dict__", {}))

    resolver_source = inspect.getsource(telegram_channel_source.TelethonUsernameResolver)
    assert "GetParticipants" not in resolver_source
    assert "fetch_participants" not in resolver_source


def test_edges_extractors_used_by_expander_are_the_real_slice1_module():
    """Guards against a future refactor silently swapping in a duplicate/parallel
    extractor implementation instead of Slice 1's `edges.py`."""
    assert expander.edges is edges

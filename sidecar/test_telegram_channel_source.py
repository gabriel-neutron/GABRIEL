"""
Unit tests for `TelethonChannelSource`'s own mapping/exception-handling logic. Stubs a
fake Telethon client object (not the real network) — assertions target the returned
domain `ChannelMeta`/`MessageRecord`, never the stub's shape, per Slice 1's TDD note
(docs/issues/TELEGRAM_PHASE3_ISSUES.md): "assert on domain records, never emulated
Telethon shapes."
"""

from datetime import datetime, timezone
from pathlib import Path

import aiosqlite
import pytest
import pytest_asyncio
from telethon.errors import ChatAdminRequiredError, UsernameInvalidError, UsernameNotOccupiedError

from sidecar import db, governor
from sidecar.telegram_channel_source import TelethonChannelSource, TelethonUsernameResolver


@pytest_asyncio.fixture(autouse=True)
async def _no_real_delay(monkeypatch, tmp_path: Path):
    # `_rpc_get_entity`/`_rpc_get_full_channel`/`_rpc_get_messages` are governed (Slice
    # 3) — point the governor's ledger at a throwaway temp file so these tests never
    # touch (or need) `sidecar/project.tgdb`, and never sleep for real.
    tgdb_path = tmp_path / "test.tgdb"
    await db.init_db(tgdb_path)
    governor.set_ledger_path_for_tests(tgdb_path)
    monkeypatch.setattr(governor.asyncio, "sleep", _no_sleep)
    yield
    governor.reset_ledger_path_for_tests()


async def _no_sleep(_seconds: float) -> None:
    return None


async def _metadata_call_count() -> int:
    async with aiosqlite.connect(governor._ledger_path) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute("SELECT metadata_count FROM governor_ledger WHERE id = 1")
        row = await cursor.fetchone()
        return row["metadata_count"] if row else 0


class _FakeEntity:
    def __init__(self, id, username, title, broadcast=False, megagroup=False, restricted=False):
        self.id = id
        self.username = username
        self.title = title
        self.broadcast = broadcast
        self.megagroup = megagroup
        self.restricted = restricted


class _FakeFullChat:
    def __init__(self, participants_count, about=""):
        self.participants_count = participants_count
        self.about = about


class _FakeFullChannelResult:
    def __init__(self, full_chat):
        self.full_chat = full_chat


class _FakeMessage:
    def __init__(self, id, text, date, views):
        self.id = id
        self.message = text
        self.date = date
        self.views = views

    def to_dict(self) -> dict:
        return {"_": "Message", "id": self.id, "message": self.message}


class _FakeClient:
    """Stands in for `TelegramClient`: `get_entity`, `__call__` (RPC dispatch), and
    `get_messages` are the only three surfaces `TelethonChannelSource` touches."""

    def __init__(
        self,
        entity,
        full_channel_result=None,
        full_channel_error=None,
        messages=None,
        get_entity_error=None,
    ):
        self._entity = entity
        self._full_channel_result = full_channel_result
        self._full_channel_error = full_channel_error
        self._messages = messages or []
        self._get_entity_error = get_entity_error

    async def get_entity(self, ref: str):
        if self._get_entity_error is not None:
            raise self._get_entity_error
        return self._entity

    async def __call__(self, request):
        if self._full_channel_error is not None:
            raise self._full_channel_error
        return self._full_channel_result

    async def get_messages(self, entity, limit: int):
        return self._messages[:limit]


def _source_for(client) -> TelethonChannelSource:
    return TelethonChannelSource(client_provider=lambda: client)


@pytest.mark.asyncio
async def test_fetch_channel_metadata_maps_member_count_and_description():
    entity = _FakeEntity(id=123, username="realchan", title="Real Channel", broadcast=True)
    client = _FakeClient(
        entity=entity,
        full_channel_result=_FakeFullChannelResult(_FakeFullChat(participants_count=4200, about="desc")),
    )

    meta = await _source_for(client).fetch_channel_metadata("realchan")

    assert meta.id == 123
    assert meta.username == "realchan"
    assert meta.title == "Real Channel"
    assert meta.member_count == 4200
    assert meta.description == "desc"
    assert meta.type == "channel"
    assert meta.is_private is False


@pytest.mark.asyncio
async def test_fetch_channel_metadata_none_member_count_from_get_entity_alone():
    """`GetFullChannelRequest` succeeding but reporting no participants count (e.g. an
    edge case in Telegram's own response) still maps to `member_count=None`, not a
    crash or a 0."""
    entity = _FakeEntity(id=456, username="nomembers", title="No Members")
    client = _FakeClient(
        entity=entity,
        full_channel_result=_FakeFullChannelResult(_FakeFullChat(participants_count=None)),
    )

    meta = await _source_for(client).fetch_channel_metadata("nomembers")

    assert meta.member_count is None


@pytest.mark.asyncio
async def test_fetch_channel_metadata_degrades_gracefully_on_chat_admin_required():
    """Broadcast channels can reject the full-info request; the adapter must not let
    `ChatAdminRequiredError` propagate out of `fetch_channel_metadata` — it degrades to
    `member_count=None` instead of failing the whole collect."""
    entity = _FakeEntity(id=789, username="broadcastonly", title="Broadcast Only", broadcast=True)
    client = _FakeClient(entity=entity, full_channel_error=ChatAdminRequiredError(_FakeRequest()))

    meta = await _source_for(client).fetch_channel_metadata("broadcastonly")

    assert meta.member_count is None
    assert meta.description is None
    assert meta.id == 789


@pytest.mark.asyncio
async def test_fetch_recent_messages_maps_to_domain_records():
    entity = _FakeEntity(id=1, username="chan", title="Chan")
    now = datetime(2026, 7, 20, tzinfo=timezone.utc)
    client = _FakeClient(
        entity=entity,
        messages=[_FakeMessage(id=10, text="hello", date=now, views=5)],
    )

    records = await _source_for(client).fetch_recent_messages("chan", limit=10)

    assert len(records) == 1
    assert records[0].message_id == 10
    assert records[0].text == "hello"
    assert records[0].view_count == 5
    assert "hello" in records[0].raw_json


@pytest.mark.asyncio
async def test_fetch_channel_metadata_raises_if_client_not_connected():
    with pytest.raises(RuntimeError):
        await TelethonChannelSource(client_provider=lambda: None).fetch_channel_metadata("x")


def _resolver_for(client) -> TelethonUsernameResolver:
    return TelethonUsernameResolver(client_provider=lambda: client)


@pytest.mark.asyncio
async def test_resolve_username_returns_peer_id():
    entity = _FakeEntity(id=999, username="found", title="Found")
    client = _FakeClient(entity=entity)

    result = await _resolver_for(client).resolve_username("found")

    assert result == 999


@pytest.mark.asyncio
async def test_resolve_username_returns_none_for_unoccupied_username():
    client = _FakeClient(entity=None, get_entity_error=UsernameNotOccupiedError(_FakeRequest()))

    assert await _resolver_for(client).resolve_username("ghost") is None


@pytest.mark.asyncio
async def test_resolve_username_returns_none_for_invalid_username():
    client = _FakeClient(entity=None, get_entity_error=UsernameInvalidError(_FakeRequest()))

    assert await _resolver_for(client).resolve_username("!!!") is None


@pytest.mark.asyncio
async def test_resolve_username_returns_none_on_value_error():
    """Telethon's own `get_entity` raises a bare `ValueError` for several
    could-not-resolve cases beyond the two named exception types."""
    client = _FakeClient(entity=None, get_entity_error=ValueError("Cannot find entity"))

    assert await _resolver_for(client).resolve_username("nope") is None


@pytest.mark.asyncio
async def test_resolve_username_raises_if_client_not_connected():
    with pytest.raises(RuntimeError):
        await TelethonUsernameResolver(client_provider=lambda: None).resolve_username("x")


@pytest.mark.asyncio
async def test_resolve_username_goes_through_the_same_governor_as_channel_source():
    """Reuses `_rpc_get_entity` — the identical `governed_rpc("metadata")`-wrapped call
    `fetch_channel_metadata` uses — so it spends from the same governor budget ledger
    rather than a separate/parallel rate-limit path."""
    entity = _FakeEntity(id=1, username="x", title="X")
    client = _FakeClient(entity=entity)

    start = await _metadata_call_count()
    await _resolver_for(client).resolve_username("x")

    assert await _metadata_call_count() == start + 1


class _FakeRequest:
    pass

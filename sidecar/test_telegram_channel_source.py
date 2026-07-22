"""
Unit tests for `TelethonChannelSource`'s own mapping/exception-handling logic. Stubs a
fake Telethon client object (not the real network) — assertions target the returned
domain `ChannelMeta`/`MessageRecord`, never the stub's shape, per Slice 1's TDD note
(docs/issues/TELEGRAM_PHASE3_ISSUES.md): "assert on domain records, never emulated
Telethon shapes."
"""

from datetime import datetime, timezone

import pytest
from telethon.errors import ChatAdminRequiredError

from sidecar import choke
from sidecar.telegram_channel_source import TelethonChannelSource


@pytest.fixture(autouse=True)
def _no_real_delay(monkeypatch):
    choke.reset_cold_start_counter_for_tests()
    monkeypatch.setattr(choke.asyncio, "sleep", _no_sleep)
    yield
    choke.reset_cold_start_counter_for_tests()


async def _no_sleep(_seconds: float) -> None:
    return None


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

    def __init__(self, entity, full_channel_result=None, full_channel_error=None, messages=None):
        self._entity = entity
        self._full_channel_result = full_channel_result
        self._full_channel_error = full_channel_error
        self._messages = messages or []

    async def get_entity(self, ref: str):
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


class _FakeRequest:
    pass

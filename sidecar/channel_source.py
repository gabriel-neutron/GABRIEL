"""
`ChannelSource` seam (Slice 1, docs/timelines/TELEGRAM_TIMELINE.md) — the narrow
protocol `sidecar/collector.py` depends on. `TelethonChannelSource`
(`sidecar/telegram_channel_source.py`) is the only module that imports Telethon RPCs;
everything else, including all unit tests, talks to this protocol and its plain
dataclasses so tests assert on domain records, never emulated Telethon shapes.
"""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ChannelMeta:
    id: int
    username: str | None
    title: str
    description: str | None
    member_count: int | None
    type: str  # 'channel' | 'group', Telethon's own broadcast/megagroup distinction
    is_private: bool
    raw_json: str


@dataclass(frozen=True)
class MessageRecord:
    message_id: int
    text: str | None
    date: str  # ISO 8601
    view_count: int | None
    raw_json: str


class NotAChannelError(Exception):
    """Raised by `fetch_channel_metadata` when `ref` resolves to a Telegram entity that
    isn't a channel/supergroup — in practice, a user account (e.g. a seed username that
    turns out to name a person, or a BFS-discovered neighbor whose linked/mentioned
    username belongs to a user, not a channel). Distinct from "not found": the entity
    exists, collection just doesn't apply to it. A caller expanding many discovered
    neighbors should treat this as "skip this one node," not as a reason to stop."""


class ChannelSource(Protocol):
    async def fetch_channel_metadata(self, ref: str) -> ChannelMeta:
        """`ref` is a username or numeric-id string. Wraps `get_entity` +
        `GetFullChannelRequest` — `participants_count` is `None` from `get_entity` alone
        (see sidecar/validation/RESULTS.md). Raises `NotAChannelError` if `ref` names a
        user rather than a channel/supergroup."""
        ...

    async def fetch_recent_messages(self, ref: str, limit: int) -> list[MessageRecord]:
        """One history page, newest first."""
        ...


class FakeChannelSource:
    """Test double: returns canned records keyed by `ref`, no network. Construct with
    `metadata={ref: ChannelMeta}` and `messages={ref: [MessageRecord, ...]}`; a `ref`
    missing from `metadata` raises `KeyError`, same as a real "channel not found"."""

    def __init__(
        self,
        metadata: dict[str, ChannelMeta],
        messages: dict[str, list[MessageRecord]] | None = None,
    ) -> None:
        self._metadata = metadata
        self._messages = messages or {}

    async def fetch_channel_metadata(self, ref: str) -> ChannelMeta:
        return self._metadata[ref]

    async def fetch_recent_messages(self, ref: str, limit: int) -> list[MessageRecord]:
        return self._messages.get(ref, [])[:limit]

"""
`UsernameResolver` seam (Slice 2, docs/timelines/TELEGRAM_TIMELINE.md) — resolves a
bare username to its Telegram peer id. Its own governed RPC, not a free sub-step of text
parsing: `sidecar/expander.py`'s `expand_channel` depends on this protocol, never
Telethon directly, so unit tests assert on plain `int | None`, never emulated Telethon
shapes. `TelethonUsernameResolver` (`sidecar/telegram_channel_source.py`) is the only
implementation that imports Telethon RPCs, routed through the identical
`sidecar/choke.py` choke as `ChannelSource` — no parallel rate-limit path.
"""

from typing import Protocol


class UsernameResolver(Protocol):
    async def resolve_username(self, username: str) -> int | None:
        """Returns the resolved peer id, or `None` if the username is private, renamed,
        or does not exist. Never raises for an unresolvable username — only for
        infrastructure failures (e.g. no connected client)."""
        ...


class FakeUsernameResolver:
    """Test double: returns canned ids keyed by (lowercased) username, `None` for any
    username not present in `resolvable` — same "unresolvable, not an error" contract
    as the real adapter."""

    def __init__(self, resolvable: dict[str, int]) -> None:
        self._resolvable = {username.lower(): peer_id for username, peer_id in resolvable.items()}

    async def resolve_username(self, username: str) -> int | None:
        return self._resolvable.get(username.lower())

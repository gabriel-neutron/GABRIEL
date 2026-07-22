"""
Telethon session management. Connect/disconnect only in Phase 2 — collection logic
lands in Phase 3's collector.py.

Hard boundary (see docs/TELEGRAM_OSINT_PRD.md#account-safety, rule 3): Gabriel is
read-only collection. This module must never expose add/invite/message-sending calls.
Do not add SendMessageRequest, AddChatUserRequest, or any invite/join-on-behalf-of-user
call here or anywhere else in the sidecar.
"""

import os
from pathlib import Path

from telethon import TelegramClient
from telethon.errors import RPCError

SESSION_PATH = Path(__file__).parent / "collector_session"

_client: TelegramClient | None = None


def _credentials() -> tuple[int, str] | None:
    api_id = os.environ.get("TG_API_ID")
    api_hash = os.environ.get("TG_API_HASH")
    if not api_id or not api_hash:
        return None
    return int(api_id), api_hash


async def connect() -> bool:
    """Connect using an existing .session file. Never triggers an interactive
    phone/code login (that must be done once, out of band, e.g. via a validation
    script) — the sidecar is a long-running server process, not a place to block on
    stdin input."""
    global _client
    creds = _credentials()
    if creds is None:
        return False

    api_id, api_hash = creds
    client = TelegramClient(str(SESSION_PATH), api_id, api_hash)
    try:
        await client.connect()
    except (OSError, RPCError):
        return False

    if not await client.is_user_authorized():
        await client.disconnect()
        return False

    _client = client
    return True


async def disconnect() -> None:
    global _client
    if _client is not None:
        await _client.disconnect()
        _client = None


def is_connected() -> bool:
    return _client is not None and _client.is_connected()


def _get_client() -> TelegramClient | None:
    """Not public API — `sidecar/telegram_channel_source.py`'s `TelethonChannelSource` is
    the only caller (Slice 1's `ChannelSource` seam, docs/issues/TELEGRAM_PHASE3_ISSUES.md).
    No other module may reach the raw Telethon client; go through `ChannelSource` instead."""
    return _client

"""
`TelethonChannelSource` — the ONLY module that imports Telethon RPCs (Slice 1,
docs/issues/TELEGRAM_PHASE3_ISSUES.md). Every call goes through `sidecar/choke.py`'s
`choked_rpc` (fixed jittered delay + cold-start cap, innermost; FloodWait/PeerFloodError
hard-stop outermost) — there is no path from here to Telegram that skips it.

Hard boundary (see docs/TELEGRAM_OSINT_PRD.md#account-safety, rule 3): read-only
collection only. Do not add SendMessageRequest, AddChatUserRequest, or any
invite/join-on-behalf-of-user call here or anywhere else in the sidecar.
"""

import json

from telethon import TelegramClient
from telethon.errors import ChatAdminRequiredError
from telethon.tl.functions.channels import GetFullChannelRequest

from sidecar import telegram_client
from sidecar.channel_source import ChannelMeta, MessageRecord
from sidecar.choke import choked_rpc
from sidecar.logging_config import logger


@choked_rpc
async def _rpc_get_entity(client: TelegramClient, ref: str):
    return await client.get_entity(ref)


@choked_rpc
async def _rpc_get_full_channel(client: TelegramClient, entity):
    return await client(GetFullChannelRequest(entity))


@choked_rpc
async def _rpc_get_messages(client: TelegramClient, entity, limit: int):
    return await client.get_messages(entity, limit=limit)


class TelethonChannelSource:
    """`ref` is a username or numeric-id string, per the `ChannelSource` protocol.
    `client_provider` defaults to `telegram_client._get_client` — the sole other caller
    of that accessor — but is injectable for tests that stub a fake Telethon client."""

    def __init__(self, client_provider=telegram_client._get_client) -> None:
        self._client_provider = client_provider

    def _require_client(self) -> TelegramClient:
        client = self._client_provider()
        if client is None:
            raise RuntimeError("Telegram client is not connected")
        return client

    async def fetch_channel_metadata(self, ref: str) -> ChannelMeta:
        client = self._require_client()
        entity = await _rpc_get_entity(client, ref)

        # `participants_count` is `None` on the entity from `get_entity` alone — needs
        # `GetFullChannelRequest` (sidecar/validation/RESULTS.md). Broadcast channels can
        # restrict this too; degrade to `member_count=None` rather than fail the whole
        # collect.
        member_count = None
        description = None
        try:
            full = await _rpc_get_full_channel(client, entity)
            member_count = full.full_chat.participants_count
            description = full.full_chat.about or None
        except ChatAdminRequiredError:
            logger.info(
                "GetFullChannelRequest forbidden for %r (broadcast channel) — member_count unknown",
                ref,
            )

        is_broadcast = bool(getattr(entity, "broadcast", False))
        username = getattr(entity, "username", None)

        raw = {
            "id": entity.id,
            "username": username,
            "title": getattr(entity, "title", None),
            "broadcast": is_broadcast,
            "megagroup": bool(getattr(entity, "megagroup", False)),
            "restricted": bool(getattr(entity, "restricted", False)),
            "member_count": member_count,
            "description": description,
        }

        return ChannelMeta(
            id=entity.id,
            username=username,
            title=getattr(entity, "title", None) or "",
            description=description,
            member_count=member_count,
            type="channel" if is_broadcast else "group",
            is_private=username is None,
            raw_json=json.dumps(raw, default=str),
        )

    async def fetch_recent_messages(self, ref: str, limit: int) -> list[MessageRecord]:
        client = self._require_client()
        entity = await _rpc_get_entity(client, ref)
        messages = await _rpc_get_messages(client, entity, limit)

        records = []
        for message in messages:
            records.append(
                MessageRecord(
                    message_id=message.id,
                    text=message.message or None,
                    date=message.date.isoformat() if message.date else "",
                    view_count=getattr(message, "views", None),
                    raw_json=json.dumps(message.to_dict(), default=str),
                )
            )
        return records

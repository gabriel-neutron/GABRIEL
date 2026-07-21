"""
Phase 1 validation helper — find a broadcast channel's linked discussion group.

Run manually: `python validation/01b_find_linked_group.py <channel_username>`

`get_participants` fails with ChatAdminRequiredError on broadcast channels — Telegram
hides their member list from non-admins. Megagroups (discussion groups) do expose it.
Most Russian military broadcast channels have a linked discussion group attached
(visible as `has_link: True` on the channel entity), which is on-topic by construction
and enumerable — a better validation target than a username guessed from a blog post,
since Telegram deletes OSINT channels without warning and published lists go stale.

This resolves that linked group so 01_telethon_connectivity.py can be re-run against it.
Read-only: two API calls, no joins, no messages. See docs/TELEGRAM_OSINT_PRD.md#account-safety.
"""

import asyncio
import os
import sys

from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.tl.functions.channels import GetFullChannelRequest

load_dotenv(Path(__file__).parent.parent / ".env")

API_ID = os.environ.get("TG_API_ID")
API_HASH = os.environ.get("TG_API_HASH")
SESSION_NAME = "validation_session"


async def main(channel: str) -> None:
    if not API_ID or not API_HASH:
        print("Set TG_API_ID and TG_API_HASH in sidecar/.env first.", file=sys.stderr)
        sys.exit(1)

    client = TelegramClient(SESSION_NAME, int(API_ID), API_HASH)

    async with client:
        entity = await client.get_entity(channel)
        full = await client(GetFullChannelRequest(entity))
        linked_id = full.full_chat.linked_chat_id

        if not linked_id:
            print(f"@{channel} has no linked discussion group.")
            print("Try another channel whose entity showed has_link: True.")
            return

        linked = await client.get_entity(linked_id)
        username = getattr(linked, "username", None)
        print(f"Linked discussion group: {linked.title}")
        print(f"  id:        {linked.id}")
        print(f"  username:  {username or '(private — no username)'}")
        print(f"  megagroup: {getattr(linked, 'megagroup', None)}")
        print(f"  broadcast: {getattr(linked, 'broadcast', None)}")

        # No public username is fine: this run cached the group's access_hash in the
        # .session file, so 01 can resolve it by ID from here on.
        print("\nRe-run connectivity validation against it:")
        print(f"  python validation/01_telethon_connectivity.py {username or linked.id}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <channel_username>", file=sys.stderr)
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))

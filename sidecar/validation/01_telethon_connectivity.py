"""
Phase 1 validation — Telethon basic connectivity.

Run manually: `python validation/01_telethon_connectivity.py <public_channel_username>`

Connects with real api_id/api_hash (from .env) against one known public channel.
First run is interactive: Telethon will prompt for phone number and login code and
persist a `.session` file next to this script's cwd (sidecar/) — DO NOT COMMIT IT.

Records channel entity shape, one message's field shape, and how many API calls were
made before anything throttled, so Phase 2's rate-limit assumptions are grounded in a
real response rather than the Telethon docs alone.
"""

import asyncio
import json
import os
import sys

from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.errors import ChatAdminRequiredError, FloodWaitError

load_dotenv(Path(__file__).parent.parent / ".env")

API_ID = os.environ.get("TG_API_ID")
API_HASH = os.environ.get("TG_API_HASH")
SESSION_NAME = "validation_session"


async def main(channel: str) -> None:
    if not API_ID or not API_HASH:
        print("Set TG_API_ID and TG_API_HASH in sidecar/.env first.", file=sys.stderr)
        sys.exit(1)

    client = TelegramClient(SESSION_NAME, int(API_ID), API_HASH)
    call_count = 0

    async with client:
        # A numeric arg is a channel ID (e.g. a linked discussion group resolved by
        # 01b_find_linked_group.py, which has no public username). Telethon resolves it
        # from the access_hash it cached in the .session file when 01b first fetched it —
        # so run 01b against the parent channel first, in the same session.
        target = int(channel) if channel.lstrip("-").isdigit() else channel
        entity = await client.get_entity(target)
        call_count += 1
        print("=== Channel entity fields ===")
        print(json.dumps({k: str(v) for k, v in vars(entity).items()}, indent=2, default=str))

        messages = await client.get_messages(entity, limit=5)
        call_count += 1
        print("\n=== Sample message fields (first message) ===")
        if messages:
            print(json.dumps({k: str(v) for k, v in vars(messages[0]).items()}, indent=2, default=str))
        else:
            print("(no messages returned)")

        try:
            participants = await client.get_participants(entity, limit=10)
            call_count += 1
            print(f"\n=== Participants sample: {len(participants)} returned ===")
            if participants:
                print(json.dumps({k: str(v) for k, v in vars(participants[0]).items()}, indent=2, default=str))
        except FloodWaitError as e:
            print(f"\nFloodWaitError on get_participants after {call_count} calls: wait {e.seconds}s")
        except ChatAdminRequiredError:
            print(
                "\nChatAdminRequiredError on get_participants: this is a broadcast channel "
                "(member list hidden from non-admins by Telegram itself) — retry against a "
                "megagroup to validate get_participants."
            )

    print(f"\nTotal API calls this run: {call_count}")
    print("Record this in sidecar/validation/RESULTS.md.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <public_channel_username>", file=sys.stderr)
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))

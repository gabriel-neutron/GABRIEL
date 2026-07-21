"""
Phase 1 validation — Telethon channel metadata collection at scale.

Run manually: `python validation/02_telethon_metadata.py <username1> <username2> ...`
(pass 5 public channels, ideally including a ~100-member, ~1,000-member, and
~10,000-member group per the timeline's exit criteria)

For each channel, measures wall-clock time and API call count to collect: entity,
last N messages (paginated via GetHistoryRequest), and participant list. Confirms
message batch size / pagination behavior and reports per-channel timing so BFS crawl
speed (Phase 5) can be estimated from real numbers.
"""

import asyncio
import os
import sys
import time

from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.errors import FloodWaitError

load_dotenv(Path(__file__).parent.parent / ".env")

API_ID = os.environ.get("TG_API_ID")
API_HASH = os.environ.get("TG_API_HASH")
SESSION_NAME = "validation_session"
MESSAGE_BATCH_SIZE = 100  # GetHistoryRequest page size to probe pagination with


async def collect_one(client: TelegramClient, username: str) -> dict:
    result = {"username": username, "calls": 0, "errors": []}
    start = time.monotonic()

    try:
        entity = await client.get_entity(username)
        result["calls"] += 1
        result["member_count"] = getattr(entity, "participants_count", None)
    except Exception as e:  # noqa: BLE001 — validation script, report and continue
        result["errors"].append(f"get_entity: {e}")
        result["elapsed_s"] = time.monotonic() - start
        return result

    messages = []
    try:
        async for message in client.iter_messages(entity, limit=MESSAGE_BATCH_SIZE * 3):
            messages.append(message)
        result["calls"] += (len(messages) // MESSAGE_BATCH_SIZE) + 1
        result["messages_collected"] = len(messages)
    except FloodWaitError as e:
        result["errors"].append(f"iter_messages FloodWaitError: wait {e.seconds}s")

    try:
        participants = await client.get_participants(entity, limit=1000)
        result["calls"] += 1
        result["participants_sample"] = len(participants)
    except FloodWaitError as e:
        result["errors"].append(f"get_participants FloodWaitError: wait {e.seconds}s")
    except Exception as e:  # noqa: BLE001
        result["errors"].append(f"get_participants: {e} (expected for broadcast channels)")

    result["elapsed_s"] = round(time.monotonic() - start, 2)
    return result


async def main(usernames: list[str]) -> None:
    if not API_ID or not API_HASH:
        print("Set TG_API_ID and TG_API_HASH in sidecar/.env first.", file=sys.stderr)
        sys.exit(1)

    client = TelegramClient(SESSION_NAME, int(API_ID), API_HASH)
    async with client:
        for username in usernames:
            print(f"\n=== {username} ===")
            report = await collect_one(client, username)
            for k, v in report.items():
                print(f"  {k}: {v}")

    print("\nRecord these per-channel timings/call-counts in sidecar/validation/RESULTS.md.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} <username1> [username2 ...]", file=sys.stderr)
        sys.exit(1)
    asyncio.run(main(sys.argv[1:]))

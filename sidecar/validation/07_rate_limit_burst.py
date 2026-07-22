"""
Phase 1 / Slice 0 validation — where does FloodWaitError first fire on a tight loop of
low-risk calls? (docs/issues/TELEGRAM_PHASE3_ISSUES.md Slice 0: "A separate metered
rate-limit burst on a single channel records a first real data point for where
FloodWaitError begins.")

Deliberately uses `get_messages` (history — Account Safety rule 5 calls this "low-risk
and stable"), NOT `get_participants` (the top ban vector) — this measures the choke's
conservative delay/ceiling numbers against reality without touching the riskiest call
type. Hard-capped at MAX_CALLS so an unexpectedly high threshold doesn't turn this into
an actual burst attack on the account.

Run manually: `python validation/07_rate_limit_burst.py <channel_id_or_username>`
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
MAX_CALLS = 40


async def main(target: str) -> None:
    if not API_ID or not API_HASH:
        print("Set TG_API_ID and TG_API_HASH in sidecar/.env first.", file=sys.stderr)
        sys.exit(1)

    client = TelegramClient(SESSION_NAME, int(API_ID), API_HASH)

    async with client:
        resolved = int(target) if target.lstrip("-").isdigit() else target
        entity = await client.get_entity(resolved)
        print(f"Target: {entity.title} (get_messages, tight loop, cap={MAX_CALLS})")

        start = time.monotonic()
        for call_count in range(1, MAX_CALLS + 1):
            try:
                await client.get_messages(entity, limit=1)
            except FloodWaitError as e:
                elapsed = time.monotonic() - start
                print(
                    f"\nFloodWaitError on call {call_count}/{MAX_CALLS} "
                    f"after {elapsed:.1f}s: wait {e.seconds}s"
                )
                return
            print(f"  call {call_count}/{MAX_CALLS} ok")

        elapsed = time.monotonic() - start
        print(
            f"\nNo FloodWaitError within {MAX_CALLS} tight-loop get_messages calls "
            f"({elapsed:.1f}s elapsed). Threshold is above {MAX_CALLS} calls at this "
            "cadence — raise MAX_CALLS deliberately for a tighter number, or accept "
            f'">{MAX_CALLS} calls" as the conservative floor.'
        )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <channel_id_or_username>", file=sys.stderr)
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))

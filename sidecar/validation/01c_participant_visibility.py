"""
Phase 1 validation — is member enumeration possible WITHOUT joining the group?

Run manually: `python validation/01c_participant_visibility.py <group_id_or_username>`

01_telethon_connectivity.py requested limit=10 on a large discussion group the account
had NOT joined (`left: True`) and got back only 5 participants, the first of which was a
ChannelParticipantAdmin. That suggests Telegram returns *admins only* to non-members —
which would break the PRD's member-overlap channel-similarity signal, since real overlap
needs rank-and-file members, not the handful of admins every group has.

This script settles it: request a larger limit and break down what came back by
participant type. Read-only, one GetParticipants call, no join. If every result is an
admin/creator, member enumeration requires joining each group first — a materially
different ban-risk profile than the PRD assumes (see docs/TELEGRAM_OSINT_PRD.md#account-safety,
rule 5: GetParticipants is the top ban vector).
"""

import asyncio
import os
import sys

from collections import Counter
from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.errors import ChatAdminRequiredError, FloodWaitError

load_dotenv(Path(__file__).parent.parent / ".env")

API_ID = os.environ.get("TG_API_ID")
API_HASH = os.environ.get("TG_API_HASH")
SESSION_NAME = "validation_session"
REQUESTED_LIMIT = 200


async def main(target: str) -> None:
    if not API_ID or not API_HASH:
        print("Set TG_API_ID and TG_API_HASH in sidecar/.env first.", file=sys.stderr)
        sys.exit(1)

    client = TelegramClient(SESSION_NAME, int(API_ID), API_HASH)

    async with client:
        resolved = int(target) if target.lstrip("-").isdigit() else target
        entity = await client.get_entity(resolved)

        joined = not getattr(entity, "left", True)
        print(f"Group:        {entity.title}")
        print(f"megagroup:    {getattr(entity, 'megagroup', None)}")
        print(f"account joined this group: {joined}  (entity.left={getattr(entity, 'left', None)})")

        try:
            participants = await client.get_participants(entity, limit=REQUESTED_LIMIT)
        except ChatAdminRequiredError:
            print("\nChatAdminRequiredError — member list hidden from non-admins entirely.")
            return
        except FloodWaitError as e:
            print(f"\nFloodWaitError: wait {e.seconds}s")
            return

        kinds = Counter(type(p.participant).__name__ for p in participants)
        print(f"\nRequested {REQUESTED_LIMIT}, received {len(participants)}.")
        print("Participant types returned:")
        for kind, count in kinds.most_common():
            print(f"  {kind}: {count}")

        privileged = {"ChannelParticipantAdmin", "ChannelParticipantCreator"}
        if set(kinds) <= privileged:
            print(
                "\nADMINS ONLY. Member enumeration does NOT work without joining the group.\n"
                "The PRD's member-overlap signal cannot be built from non-member enumeration —\n"
                "it would require joining every discovered group. Record this in RESULTS.md and\n"
                "reassess that signal before Phase 2."
            )
        else:
            print(
                f"\nRank-and-file members ARE visible without joining "
                f"({len(participants)} returned for a {REQUESTED_LIMIT} request).\n"
                "Member-overlap signal is viable from non-member enumeration."
            )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <group_id_or_username>", file=sys.stderr)
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))

"""
Phase 1 validation — Telethon connectivity against Telegram's public TEST DC.

Safe to run without any real account: Telegram's test servers accept synthetic phone
numbers (99966<dc_id><4 digits>) and a fixed login code (<dc_id> repeated 5 times), per
https://docs.telethon.dev/en/stable/concepts/sessions.html and Telegram's own test-server
docs. Confirmed via user sign-off (2026-07-20) that the api_id/api_hash + RSA key in
docs/TELEGRAM_OSINT_PRD.md's Credentials section is Telegram's public test-DC config, not
a real account — do not reuse these credentials against production DCs.

This validates the Telethon integration mechanics (connect, auth, entity/message shapes)
but NOT real rate limits or real channel content — the test DC is an empty sandbox with no
real public channels. Phase 1's "5 known Russian military channels" and rate-limit
measurements still require a real account (validation/01 and /02).

KNOWN FINDING (2026-07-20, see sidecar/validation/RESULTS.md): from this machine's network,
the MTProto handshake to 149.154.167.40 gets intercepted — raw TCP connect succeeds (confirmed
via Test-NetConnection) but the DH-params exchange comes back as an HTTP 404 instead of MTProto
binary, on both port 443 and port 80, with and without obfuscated transport. This points to a
network-level block on this machine/network (corporate proxy, antivirus TLS inspection, or
ISP-level filtering) rather than a code or Telegram-side issue — it will likely also block
validation/01-03 (which hit production DCs) from this same network. Try from a different
network, or via a VPN/proxy Telegram itself isn't blocking, before concluding Telethon itself
doesn't work.
"""

import asyncio
import random

from telethon import TelegramClient
from telethon.crypto import rsa
from telethon.network import ConnectionTcpObfuscated

API_ID = 38723789
API_HASH = "f24b56beee4756ff947f24954710089d"
TEST_DC_ID = 2
TEST_DC_IP = "149.154.167.40"
TEST_DC_PORT = 443
TEST_DC_PUBLIC_KEY = """-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEAyMEdY1aR+sCR3ZSJrtztKTKqigvO/vBfqACJLZtS7QMgCGXJ6XIR
yy7mx66W0/sOFa7/1mAZtEoIokDP3ShoqF4fVNb6XeqgQfaUHd8wJpDWHcR2OFwv
plUUI1PLTktZ9uW2WE23b+ixNwJjJGwBDJPQEQFBE+vfmH0JP503wr5INS1poWg/
j25sIWeYPHYeOrFp/eXaqhISP6G+q2IeTaWTXpwZj4LzXq5YOpk4bYEQ6mvRq7D1
aHWfYmlEGepfaYR8Q0YqvvhYtMte3ITnuSJs171+GDqpdKcSwHnd6FudwGO4pcCO
j4WcDuXc2CTHgH8gFTNhp/Y8/SpDOhvn9QIDAQAB
-----END RSA PUBLIC KEY-----"""

SESSION_NAME = "validation_test_dc_session"


def synthetic_test_phone() -> str:
    """99966<dc_id><4 random digits> — Telegram's documented test-DC phone format."""
    return f"99966{TEST_DC_ID}{random.randint(0, 9999):04d}"


def synthetic_test_code() -> str:
    """<dc_id> repeated 5 times — Telegram's documented test-DC fixed login code."""
    return str(TEST_DC_ID) * 5


async def main() -> None:
    rsa.add_key(TEST_DC_PUBLIC_KEY, old=False)

    client = TelegramClient(SESSION_NAME, API_ID, API_HASH, connection=ConnectionTcpObfuscated)
    client.session.set_dc(TEST_DC_ID, TEST_DC_IP, TEST_DC_PORT)

    phone = synthetic_test_phone()
    code = synthetic_test_code()
    print(f"Connecting to test DC {TEST_DC_ID} at {TEST_DC_IP}:{TEST_DC_PORT}", flush=True)
    print(f"Synthetic phone: {phone}, fixed code: {code}", flush=True)

    await asyncio.wait_for(client.connect(), timeout=15)
    print(f"connect() succeeded. is_connected={client.is_connected()}", flush=True)

    await asyncio.wait_for(
        client.start(
            phone=phone,
            code_callback=lambda: code,
            first_name="Gabriel",
            last_name="Validator",
        ),
        timeout=30,
    )
    print("start() succeeded", flush=True)
    me = await client.get_me()
    print(f"Authenticated as test user: id={me.id}, phone={me.phone}", flush=True)

    dialogs = await client.get_dialogs(limit=5)
    print(f"get_dialogs() returned {len(dialogs)} dialogs (expected ~0 on a fresh test account)", flush=True)

    await client.disconnect()
    print("Disconnected cleanly. Test-DC connectivity confirmed.", flush=True)


if __name__ == "__main__":
    asyncio.run(main())

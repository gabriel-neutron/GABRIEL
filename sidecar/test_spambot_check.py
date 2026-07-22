"""
Tests for `sidecar/spambot_check.py` — the sidecar's one deliberate exception to "no
send call anywhere" (Slice 3, docs/issues/TELEGRAM_PHASE3_ISSUES.md). Exercises the real
adapter's mapping against a fake Telethon client (never the network) and asserts the
isolation guardrail: no other collection-path module imports this module.
"""

import ast
from pathlib import Path

import pytest

from sidecar.spambot_check import FakeSpamBotProbe, TelethonSpamBotProbe

FORBIDDEN_IMPORTERS = [
    "channel_source.py",
    "username_resolver.py",
    "telegram_channel_source.py",
    "expander.py",
    "collector.py",
]


class _FakeMessage:
    def __init__(self, text: str) -> None:
        self.message = text


class _FakeClient:
    def __init__(self, reply_text: str) -> None:
        self._reply_text = reply_text
        self.sent_requests: list = []

    async def get_entity(self, ref: str):
        return f"entity:{ref}"

    async def __call__(self, request) -> None:
        self.sent_requests.append(request)

    async def iter_messages(self, entity, limit: int):
        yield _FakeMessage(self._reply_text)


@pytest.mark.asyncio
async def test_real_probe_sends_start_and_returns_reply_text():
    client = _FakeClient(reply_text="Good, no limits are currently applied to your account.")
    probe = TelethonSpamBotProbe(client_provider=lambda: client)

    reply = await probe.check()

    assert reply == "Good, no limits are currently applied to your account."
    assert len(client.sent_requests) == 1


@pytest.mark.asyncio
async def test_real_probe_raises_if_client_not_connected():
    probe = TelethonSpamBotProbe(client_provider=lambda: None)
    with pytest.raises(RuntimeError):
        await probe.check()


@pytest.mark.asyncio
async def test_fake_probe_returns_canned_reply_no_network():
    probe = FakeSpamBotProbe(reply="restricted")
    assert await probe.check() == "restricted"


def test_no_collection_path_module_imports_spambot_check():
    """Structural guardrail (not just a comment): none of the read-only collection
    modules may import `sidecar.spambot_check` — it must only ever be reached from an
    explicit, human-triggered preflight."""
    sidecar_dir = Path(__file__).parent
    for filename in FORBIDDEN_IMPORTERS:
        source = (sidecar_dir / filename).read_text(encoding="utf-8")
        tree = ast.parse(source, filename=filename)
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module and "spambot_check" in node.module:
                pytest.fail(f"{filename} must not import sidecar.spambot_check")
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if "spambot_check" in alias.name:
                        pytest.fail(f"{filename} must not import sidecar.spambot_check")

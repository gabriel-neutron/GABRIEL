"""
@SpamBot preflight probe (Slice 3, docs/timelines/TELEGRAM_TIMELINE.md).

THIS IS THE SIDECAR'S ONE DELIBERATE, NAMED EXCEPTION TO "NO SEND CALL ANYWHERE". Every
other module in this sidecar is read-only collection — see
docs/TELEGRAM_OSINT_PRD.md#account-safety, Hard Rule 3 ("Never combine member
enumeration with adds/invites" implies, and the surrounding rules make explicit, that
this is otherwise a read-only crawler), and the identical boundary documented in
`sidecar/telegram_client.py` and `sidecar/telegram_channel_source.py`. The PRD's Account
Safety section itself calls for this one exception: "Detect account health by messaging
@SpamBot." This module sends a real `SendMessageRequest` ("/start") to Telegram's own
@SpamBot to ask it.

Guardrails (do not weaken these without re-reading the PRD section above):
  - This module must NEVER be imported by `sidecar/channel_source.py`,
    `sidecar/username_resolver.py`, `sidecar/telegram_channel_source.py`,
    `sidecar/expander.py`, or `sidecar/collector.py`. It is reachable only from an
    explicit, human-triggered preflight (a future `/preflight/spambot`-style endpoint,
    or a manual script) — never automatically or unattended from inside a crawl.
  - Not routed through `sidecar/governor.py`'s per-collection-call-type ceilings — it
    isn't a collection call ("metadata"/"history"/"resolve"), it's a rare,
    human-triggered health check, and folding it into those budgets would be
    security-theater, not a real protection.
  - Returns SpamBot's raw reply text, unparsed. Classifying "good standing" vs.
    "restricted" out of a natural-language bot reply is out of scope here — a human
    reads the text and decides.
"""

from typing import Protocol

from telethon import TelegramClient
from telethon.tl.functions.messages import SendMessageRequest

SPAMBOT_USERNAME = "SpamBot"


class SpamBotProbe(Protocol):
    async def check(self) -> str:
        """Sends `/start` to @SpamBot and returns its reply text, unparsed."""
        ...


class TelethonSpamBotProbe:
    """Real adapter — the only place in the sidecar that constructs a
    `SendMessageRequest`. See module docstring: never call this from inside
    `ChannelSource`/`UsernameResolver`/`expander.py`/`collector.py`; only from an
    explicit, human-triggered preflight."""

    def __init__(self, client_provider) -> None:
        self._client_provider = client_provider

    async def check(self) -> str:
        client: TelegramClient | None = self._client_provider()
        if client is None:
            raise RuntimeError("Telegram client is not connected")

        entity = await client.get_entity(SPAMBOT_USERNAME)
        await client(SendMessageRequest(peer=entity, message="/start"))

        async for message in client.iter_messages(entity, limit=1):
            return message.message or ""
        return ""


class FakeSpamBotProbe:
    """Test double: returns a canned reply, no network, no `SendMessageRequest` ever
    constructed. Construct with `reply=...`."""

    def __init__(self, reply: str = "Good, no limits are currently applied to your account.") -> None:
        self._reply = reply

    async def check(self) -> str:
        return self._reply

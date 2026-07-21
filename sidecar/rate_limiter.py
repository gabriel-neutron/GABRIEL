"""
FloodWaitError / PeerFloodError handling (Phase 3). This is mechanical, not empirical:
`FloodWaitError.seconds` is a documented attribute Telegram's own MTProto response
provides — catching it and sleeping exactly that long doesn't require Phase 1's
measurements to be correct. What DOES require Phase 1's real numbers (and is
deliberately NOT in this file) is the *proactive* delay budget between calls before any
error occurs — the jittered base delay and the safe `GetParticipants` calls/hour figure
the PRD's Account Safety section calls for. Do not add a proactive delay here without
Phase 1's measured findings backing the specific numbers.

Hard rule from docs/TELEGRAM_OSINT_PRD.md#account-safety: `PeerFloodError` is a
persistent restriction, not a timeout — hard-stop the account, never retry.
"""

import asyncio
import functools
from typing import Awaitable, Callable, ParamSpec, TypeVar

from telethon.errors import FloodWaitError, PeerFloodError

from sidecar.logging_config import logger

P = ParamSpec("P")
T = TypeVar("T")


class AccountHardStopped(Exception):
    """Raised when a `PeerFloodError` occurs. Callers must not catch-and-retry this —
    per Account Safety rule 1, treat the account as unsafe to continue using for this
    session. Re-raising as a distinct type (rather than propagating `PeerFloodError`
    directly) makes the hard-stop unmissable at call sites that only skim for Telethon
    error types."""


def with_flood_wait_retry(
    max_retries: int = 3,
) -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
    """Wraps an async Telethon call: on `FloodWaitError`, sleeps exactly the server-told
    duration and retries (up to `max_retries`); on `PeerFloodError`, hard-stops
    immediately — no retry, ever, per Account Safety rule 1."""

    def decorator(func: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
        @functools.wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            attempt = 0
            while True:
                try:
                    return await func(*args, **kwargs)
                except PeerFloodError as e:
                    logger.error("PeerFloodError — hard-stopping account: %s", e)
                    raise AccountHardStopped(str(e)) from e
                except FloodWaitError as e:
                    attempt += 1
                    if attempt > max_retries:
                        logger.error(
                            "FloodWaitError after %d retries, giving up: wait=%ds", attempt, e.seconds
                        )
                        raise
                    logger.info(
                        "FloodWaitError, waiting %ds (attempt %d/%d)", e.seconds, attempt, max_retries
                    )
                    await asyncio.sleep(e.seconds)

        return wrapper

    return decorator

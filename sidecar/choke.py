"""
The non-bypassable choke every outbound Telegram call must pass through (Slice 1,
docs/issues/TELEGRAM_PHASE3_ISSUES.md). Two pieces, composed innermost-out:

    with_flood_wait_retry()(governed(rpc))

`governed` is innermost so each *physical* retry `with_flood_wait_retry` performs also
pays its own jittered delay and spends a cold-start token — a retry storm can't dodge
the choke by looping inside the retry decorator.

This is deliberately the *minimal* choke, not the full tunable governor (that's Slice 3,
`docs/issues/TELEGRAM_PHASE3_ISSUES.md`). The numbers below are placeholders — no Phase 0
live measurement exists yet for real FloodWait onset (see
`sidecar/validation/RESULTS.md`, `01c_participant_visibility.py` still unrun) — so they
are picked deliberately conservative and, per the Slice 1 spec, are NOT read from any
config/env var. Nothing in this file may be disabled, raised, or bypassed by
configuration; the only way to loosen it is to edit this source file.
"""

import asyncio
import functools
import random
from typing import Awaitable, Callable, ParamSpec, TypeVar

from sidecar.logging_config import logger
from sidecar.rate_limiter import with_flood_wait_retry

P = ParamSpec("P")
T = TypeVar("T")

# Deliberately conservative and hardcoded — see module docstring. Revisit once
# validation/01c and the rate-limit burst measurement (Slice 0) produce real numbers.
BASE_DELAY_SECONDS = 3.0
JITTER_SECONDS = 2.0
COLD_START_CALL_CEILING = 15

_cold_start_call_count = 0


class ColdStartCeilingExceeded(Exception):
    """Raised once `COLD_START_CALL_CEILING` calls have been made in this process
    lifetime. Not recoverable by retrying or reconfiguring — restart the process (a
    conscious human action) to reset it. This is intentionally the crudest possible
    stop-gap ahead of Slice 3's persistent, cross-restart budget ledger."""


def reset_cold_start_counter_for_tests() -> None:
    """Test-only helper — production code has no path that calls this."""
    global _cold_start_call_count
    _cold_start_call_count = 0


async def _throttle() -> None:
    global _cold_start_call_count
    if _cold_start_call_count >= COLD_START_CALL_CEILING:
        raise ColdStartCeilingExceeded(
            f"Cold-start cap of {COLD_START_CALL_CEILING} calls reached for this process; "
            "restart the sidecar to continue. Not configurable — see sidecar/choke.py."
        )
    _cold_start_call_count += 1
    delay = BASE_DELAY_SECONDS + random.uniform(0, JITTER_SECONDS)
    logger.info(
        "choke: call %d/%d, delaying %.2fs", _cold_start_call_count, COLD_START_CALL_CEILING, delay
    )
    await asyncio.sleep(delay)


def governed(func: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
    """Wraps an async RPC call with the fixed jittered inter-call delay and the
    cold-start ceiling. Innermost layer of the choke — see module docstring."""

    @functools.wraps(func)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        await _throttle()
        return await func(*args, **kwargs)

    return wrapper


def choked_rpc(func: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
    """`with_flood_wait_retry()(governed(rpc))` — the one non-bypassable choke-point
    every Telegram RPC in `TelethonChannelSource` must be wrapped with."""
    return with_flood_wait_retry()(governed(func))

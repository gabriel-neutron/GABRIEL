import asyncio

import pytest
from telethon.errors import FloodWaitError, PeerFloodError

from sidecar import choke
from sidecar.rate_limiter import AccountHardStopped


@pytest.fixture(autouse=True)
def _reset_cold_start(monkeypatch):
    choke.reset_cold_start_counter_for_tests()
    # Never actually sleep in tests.
    monkeypatch.setattr(choke.asyncio, "sleep", _no_sleep)
    yield
    choke.reset_cold_start_counter_for_tests()


async def _no_sleep(_seconds: float) -> None:
    return None


class _FakeRpcError(Exception):
    pass


def _make_flood_wait_error(seconds: int) -> FloodWaitError:
    return FloodWaitError(_FakeRequest(), capture=seconds)


@pytest.mark.asyncio
async def test_governed_delays_and_passes_through_result():
    calls = []

    @choke.governed
    async def rpc(value: int) -> int:
        calls.append(value)
        return value * 2

    assert await rpc(21) == 42
    assert calls == [21]


@pytest.mark.asyncio
async def test_governed_enforces_cold_start_ceiling():
    @choke.governed
    async def rpc() -> None:
        return None

    for _ in range(choke.COLD_START_CALL_CEILING):
        await rpc()

    with pytest.raises(choke.ColdStartCeilingExceeded):
        await rpc()


@pytest.mark.asyncio
async def test_cold_start_ceiling_is_not_configurable_per_call():
    """No kwarg/parameter on `governed` or `choked_rpc` can raise or skip the ceiling —
    it is a fixed module constant, not a call-site option."""
    assert not hasattr(choke.governed, "ceiling")
    assert not hasattr(choke.choked_rpc, "ceiling")

    @choke.governed
    async def rpc() -> None:
        return None

    for _ in range(choke.COLD_START_CALL_CEILING):
        await rpc()
    with pytest.raises(choke.ColdStartCeilingExceeded):
        await rpc(**{})  # no override kwarg exists to bypass the ceiling


@pytest.mark.asyncio
async def test_choked_rpc_hard_stops_on_peer_flood_without_retry():
    attempts = 0

    @choke.choked_rpc
    async def rpc() -> None:
        nonlocal attempts
        attempts += 1
        raise PeerFloodError(_FakeRequest())

    with pytest.raises(AccountHardStopped):
        await rpc()
    assert attempts == 1


@pytest.mark.asyncio
async def test_choked_rpc_retries_flood_wait_and_each_retry_spends_a_cold_start_token():
    attempts = 0

    @choke.choked_rpc
    async def rpc() -> str:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise _make_flood_wait_error(seconds=1)
        return "ok"

    start_count = choke._cold_start_call_count
    result = await rpc()

    assert result == "ok"
    assert attempts == 3
    # governed() is innermost, so with_flood_wait_retry's physical retries each pass
    # through governed() again — 3 attempts must have spent 3 cold-start tokens.
    assert choke._cold_start_call_count == start_count + 3


class _FakeRequest:
    pass

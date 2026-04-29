"""Tests for SSE streaming."""

import json

import pytest

from app.market.cache import PriceCache
from app.market.stream import _generate_events, create_stream_router


class _DummyClient:
    def __init__(self, host: str = "127.0.0.1") -> None:
        self.host = host


class _DummyRequest:
    def __init__(self, disconnected_sequence: list[bool]) -> None:
        self._states = iter(disconnected_sequence)
        self.client = _DummyClient()

    async def is_disconnected(self) -> bool:
        return next(self._states, True)


class TestStream:
    @pytest.mark.asyncio
    async def test_generate_events_emits_retry_and_price_payload(self):
        cache = PriceCache()
        cache.update("AAPL", 190.5, timestamp=123.0)
        request = _DummyRequest([False, True])

        generator = _generate_events(cache, request, interval=0)

        assert await generator.__anext__() == "retry: 1000\n\n"

        payload_event = await generator.__anext__()
        assert payload_event.startswith("data: ")

        payload = json.loads(payload_event.removeprefix("data: ").strip())
        assert payload["AAPL"]["price"] == 190.5
        assert payload["AAPL"]["timestamp"] == 123.0

        with pytest.raises(StopAsyncIteration):
            await generator.__anext__()

    def test_create_stream_router_returns_fresh_router(self):
        first_router = create_stream_router(PriceCache())
        second_router = create_stream_router(PriceCache())

        assert first_router is not second_router
        assert [route.path for route in first_router.routes] == ["/api/stream/prices"]
        assert [route.path for route in second_router.routes] == ["/api/stream/prices"]

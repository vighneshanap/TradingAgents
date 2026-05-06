"""SSE bridge between the per-run sync `queue.Queue` and FastAPI's async loop."""

from __future__ import annotations

import asyncio
import json
import queue as q
from typing import AsyncIterator

from webserver.runs import _Run


async def sse_event_stream(run: _Run) -> AsyncIterator[bytes]:
    """Yield SSE-formatted lines from a run's queue until ``done``."""
    while True:
        # Block in a thread so we don't stall the event loop
        try:
            item = await asyncio.to_thread(run.queue.get, True, 30.0)
        except q.Empty:
            # heartbeat to keep connection alive on slow runs
            yield b": keepalive\n\n"
            continue

        event = item.get("event", "message")
        data = json.dumps({"phase": item.get("phase"), "data": item.get("data")})
        yield f"event: {event}\ndata: {data}\n\n".encode("utf-8")

        if event == "done":
            break

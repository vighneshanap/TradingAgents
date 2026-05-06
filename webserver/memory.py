"""HTTP-side wrappers over `TradingMemoryLog` for the REST surface."""

from __future__ import annotations

from typing import List

from tradingagents.agents.utils.memory import TradingMemoryLog
from tradingagents.default_config import DEFAULT_CONFIG

from webserver.models import MemoryEntry


def _log() -> TradingMemoryLog:
    return TradingMemoryLog(DEFAULT_CONFIG)


def list_all() -> List[MemoryEntry]:
    entries = _log().load_entries()
    return [
        MemoryEntry(
            date=e["date"],
            ticker=e["ticker"],
            rating=e["rating"],
            pending=e["pending"],
            raw_return=e.get("raw"),
            alpha_return=e.get("alpha"),
            holding=e.get("holding"),
            decision=e.get("decision", ""),
            reflection=e.get("reflection", ""),
        )
        for e in entries
    ]


def list_for_ticker(ticker: str) -> List[MemoryEntry]:
    return [m for m in list_all() if m.ticker.upper() == ticker.upper()]

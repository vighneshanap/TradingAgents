"""RunManager: kicks off `TradingAgentsGraph.propagate` in a worker thread,
owns per-run async queues for SSE streaming, tracks status, supports cancel.

Threading model:
- Each run gets a worker `threading.Thread`.
- A bounded `queue.Queue` is shared between the worker (producer of chunks)
  and the SSE endpoint (async consumer running in the FastAPI event loop).
- We bridge sync queue → asyncio via `asyncio.to_thread(queue.get, timeout=...)`
  in a small async generator inside `streaming.py`.

Cancellation is best-effort: a `threading.Event` is checked between LangGraph
chunks. The graph itself doesn't expose a cancel hook, but each chunk is the
boundary at which we can stop iterating and let the thread exit cleanly.
"""

from __future__ import annotations

import json
import logging
import os
import queue as q
import threading
import time
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from cli.stats_handler import StatsCallbackHandler
from tradingagents.agents.utils.rating import parse_rating
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.dataflows.utils import safe_ticker_component
from tradingagents.graph.trading_graph import TradingAgentsGraph

from webserver.models import RunDetail, RunRequest, RunStatus, RunSummary

logger = logging.getLogger(__name__)


_SERIALISABLE_KEYS = (
    "company_of_interest", "trade_date",
    "market_report", "sentiment_report", "news_report", "fundamentals_report",
    "investment_plan", "trader_investment_plan", "final_trade_decision",
    "investment_debate_state", "risk_debate_state",
    "past_context",
)


def _serialise_chunk(chunk: Dict[str, Any]) -> Dict[str, Any]:
    """Pluck only JSON-safe fields out of a LangGraph stream chunk."""
    out: Dict[str, Any] = {}
    for k in _SERIALISABLE_KEYS:
        if k in chunk:
            v = chunk[k]
            # Strip the volatile fields that aren't useful to the UI
            if k in ("investment_debate_state", "risk_debate_state") and isinstance(v, dict):
                out[k] = {kk: vv for kk, vv in v.items() if kk != "current_response"}
            else:
                out[k] = v
    return out


def _infer_phase(chunk: Dict[str, Any], prev: Dict[str, Any]) -> str:
    """Derive a coarse phase label from which keys just changed."""
    new_keys = [k for k in _SERIALISABLE_KEYS if k in chunk and prev.get(k) != chunk.get(k)]
    if "final_trade_decision" in new_keys:
        return "pm_decided"
    if "risk_debate_state" in new_keys:
        return "risk_debate"
    if "trader_investment_plan" in new_keys:
        return "trader"
    if "investment_plan" in new_keys:
        return "research_manager"
    if "investment_debate_state" in new_keys:
        return "research_debate"
    if "fundamentals_report" in new_keys:
        return "fundamentals_analyst"
    if "news_report" in new_keys:
        return "news_analyst"
    if "sentiment_report" in new_keys:
        return "social_analyst"
    if "market_report" in new_keys:
        return "market_analyst"
    return "running"


class _Run:
    def __init__(self, req: RunRequest):
        self.id: str = uuid.uuid4().hex[:12]
        self.request: RunRequest = req
        self.status: RunStatus = "queued"
        self.rating: Optional[str] = None
        self.error: Optional[str] = None
        self.started_at: Optional[datetime] = None
        self.finished_at: Optional[datetime] = None
        self.final_state: Optional[Dict[str, Any]] = None
        self.queue: q.Queue = q.Queue(maxsize=64)
        self.cancel_event = threading.Event()
        self.thread: Optional[threading.Thread] = None
        self.stats: StatsCallbackHandler = StatsCallbackHandler()

    def summary(self) -> RunSummary:
        return RunSummary(
            run_id=self.id, ticker=self.request.ticker,
            trade_date=str(self.request.trade_date), status=self.status,
            rating=self.rating, started_at=self.started_at,
            finished_at=self.finished_at, error=self.error,
        )

    def detail(self) -> RunDetail:
        return RunDetail(
            **self.summary().model_dump(),
            request=self.request,
            final_state=self.final_state,
            stats=self.stats.get_stats(),
        )


def _build_config(req: RunRequest) -> Dict[str, Any]:
    cfg = DEFAULT_CONFIG.copy()
    cfg["llm_provider"] = req.llm_provider
    cfg["deep_think_llm"] = req.deep_think_llm
    cfg["quick_think_llm"] = req.quick_think_llm
    cfg["max_debate_rounds"] = req.research_depth
    cfg["max_risk_discuss_rounds"] = req.research_depth
    cfg["output_language"] = req.output_language
    cfg["google_thinking_level"] = req.google_thinking_level
    cfg["openai_reasoning_effort"] = req.openai_reasoning_effort
    cfg["anthropic_effort"] = req.anthropic_effort
    cfg["checkpoint_enabled"] = req.checkpoint_enabled
    cfg["data_vendors"] = dict(req.data_vendors)
    return cfg


class RunManager:
    """Process-wide singleton — one in-memory store of runs."""

    def __init__(self) -> None:
        self._runs: Dict[str, _Run] = {}
        self._lock = threading.Lock()

    def start(self, req: RunRequest) -> _Run:
        # Validate ticker early — same guard as the rest of the codebase.
        safe_ticker_component(req.ticker.strip().upper())

        run = _Run(req)
        with self._lock:
            self._runs[run.id] = run

        run.thread = threading.Thread(
            target=self._worker, args=(run,), daemon=True, name=f"run-{run.id}"
        )
        run.thread.start()
        return run

    def get(self, run_id: str) -> Optional[_Run]:
        with self._lock:
            return self._runs.get(run_id)

    def list(self) -> list[_Run]:
        with self._lock:
            return list(self._runs.values())

    def cancel(self, run_id: str) -> bool:
        run = self.get(run_id)
        if not run or run.status not in ("queued", "running"):
            return False
        run.cancel_event.set()
        return True

    # ----- worker -----

    def _worker(self, run: _Run) -> None:
        run.status = "running"
        run.started_at = datetime.utcnow()
        try:
            cfg = _build_config(run.request)
            graph = TradingAgentsGraph(
                selected_analysts=list(run.request.selected_analysts),
                config=cfg,
                debug=False,
                callbacks=[run.stats],
            )

            ticker = run.request.ticker.strip().upper()
            init_state = graph.propagator.create_initial_state(
                ticker, str(run.request.trade_date),
                past_context=graph.memory_log.get_past_context(ticker),
            )
            args = graph.propagator.get_graph_args(callbacks=[run.stats])

            prev: Dict[str, Any] = {}
            final: Dict[str, Any] = {}
            for chunk in graph.graph.stream(init_state, **args):
                if run.cancel_event.is_set():
                    raise RuntimeError("cancelled")

                payload = _serialise_chunk(chunk)
                phase = _infer_phase(payload, prev)
                prev = {**prev, **payload}
                final = {**final, **payload}

                try:
                    run.queue.put({"event": "chunk", "phase": phase, "data": payload}, timeout=2.0)
                except q.Full:
                    logger.warning("run %s queue full; dropping chunk", run.id)

            # Persist the way the existing code does
            graph._log_state(str(run.request.trade_date), final)
            graph.memory_log.store_decision(
                ticker=ticker, trade_date=str(run.request.trade_date),
                final_trade_decision=final.get("final_trade_decision", ""),
            )

            run.final_state = final
            run.rating = parse_rating(final.get("final_trade_decision", ""))
            run.status = "completed"
        except RuntimeError as exc:
            if str(exc) == "cancelled":
                run.status = "cancelled"
            else:
                run.status = "failed"
                run.error = repr(exc)
                logger.exception("run %s failed", run.id)
        except Exception as exc:  # noqa: BLE001 — surface any failure
            run.status = "failed"
            run.error = repr(exc)
            logger.exception("run %s failed", run.id)
        finally:
            run.finished_at = datetime.utcnow()
            run.queue.put({"event": "done", "data": {
                "run_id": run.id, "status": run.status,
                "rating": run.rating, "error": run.error,
            }})


# Process-wide singleton
RUN_MANAGER = RunManager()

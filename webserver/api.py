"""REST + SSE routes."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Path as FPath
from fastapi.responses import StreamingResponse

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.dataflows.utils import safe_ticker_component
from tradingagents.llm_clients.model_catalog import MODEL_OPTIONS

from webserver.auth import require_token
from webserver.memory import list_all, list_for_ticker
from webserver.models import (
    HealthResponse, MemoryEntry, ProviderInfo, RunDetail, RunRequest, RunSummary,
)
from webserver.runs import RUN_MANAGER
from webserver.streaming import sse_event_stream


router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


# ---- meta ----

@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    from importlib.metadata import version
    try:
        v = version("tradingagents")
    except Exception:
        v = "0.2.4"
    return HealthResponse(status="ok", version=v)


@router.get("/config")
def config() -> Dict[str, Any]:
    """Sanitised default config — no environment secrets."""
    cfg = {k: v for k, v in DEFAULT_CONFIG.items() if k != "project_dir"}
    return cfg


PROVIDER_KEY_ENV = {
    "openai": "OPENAI_API_KEY", "anthropic": "ANTHROPIC_API_KEY",
    "google": "GOOGLE_API_KEY", "xai": "XAI_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY", "qwen": "DASHSCOPE_API_KEY",
    "glm": "ZHIPU_API_KEY", "openrouter": "OPENROUTER_API_KEY",
    "azure": "AZURE_OPENAI_API_KEY", "ollama": None,
}

PROVIDER_LABELS = {
    "openai": "OpenAI", "anthropic": "Anthropic", "google": "Google",
    "azure": "Azure OpenAI", "xai": "xAI", "deepseek": "DeepSeek",
    "qwen": "Qwen", "glm": "GLM", "openrouter": "OpenRouter", "ollama": "Ollama",
}


@router.get("/providers", response_model=List[ProviderInfo])
def providers() -> List[ProviderInfo]:
    out: List[ProviderInfo] = []
    for name, label in PROVIDER_LABELS.items():
        env = PROVIDER_KEY_ENV.get(name)
        configured = bool(env and os.environ.get(env))
        if name == "ollama":
            configured = True  # local, no key required
        opts = MODEL_OPTIONS.get(name, {"quick": [], "deep": []})
        out.append(ProviderInfo(
            name=name, label=label,
            api_key_env=env, api_key_configured=configured,
            models_quick=[{"label": d, "value": v} for d, v in opts.get("quick", [])],
            models_deep=[{"label": d, "value": v} for d, v in opts.get("deep", [])],
        ))
    return out


# ---- runs ----

@router.post("/runs", response_model=RunSummary, status_code=201)
def create_run(req: RunRequest) -> RunSummary:
    try:
        safe_ticker_component(req.ticker.strip().upper())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    run = RUN_MANAGER.start(req)
    return run.summary()


@router.get("/runs", response_model=List[RunSummary])
def list_runs() -> List[RunSummary]:
    return [r.summary() for r in RUN_MANAGER.list()]


@router.get("/runs/{run_id}", response_model=RunDetail)
def get_run(run_id: str) -> RunDetail:
    run = RUN_MANAGER.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    return run.detail()


@router.get("/runs/{run_id}/state")
def get_run_state(run_id: str) -> Dict[str, Any]:
    run = RUN_MANAGER.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    return run.final_state or {}


@router.post("/runs/{run_id}/cancel")
def cancel_run(run_id: str) -> Dict[str, str]:
    if not RUN_MANAGER.cancel(run_id):
        raise HTTPException(status_code=409, detail="run not cancellable")
    return {"status": "cancelling"}


@router.get("/runs/{run_id}/stream")
async def stream_run(run_id: str) -> StreamingResponse:
    run = RUN_MANAGER.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    return StreamingResponse(
        sse_event_stream(run),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering when proxied
        },
    )


@router.get("/runs/{run_id}/stats")
def run_stats(run_id: str) -> Dict[str, int]:
    run = RUN_MANAGER.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    return run.stats.get_stats()


# ---- memory ----

@router.get("/memory", response_model=List[MemoryEntry])
def memory_all() -> List[MemoryEntry]:
    return list_all()


@router.get("/memory/{ticker}", response_model=List[MemoryEntry])
def memory_ticker(ticker: str = FPath(..., min_length=1, max_length=32)) -> List[MemoryEntry]:
    try:
        safe_ticker_component(ticker.strip().upper())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return list_for_ticker(ticker)

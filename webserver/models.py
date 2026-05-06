"""Pydantic schemas for the REST API.

Keep these decoupled from the in-package TypedDicts (AgentState etc.) so the
HTTP boundary can evolve without forcing changes to the orchestrator.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


Provider = Literal[
    "openai", "anthropic", "google", "azure", "xai",
    "deepseek", "qwen", "glm", "openrouter", "ollama",
]
AnalystKey = Literal["market", "social", "news", "fundamentals"]
VendorKey = Literal["yfinance", "alpha_vantage"]
Rating = Literal["Buy", "Overweight", "Hold", "Underweight", "Sell"]
RunStatus = Literal["queued", "running", "completed", "failed", "cancelled"]


# ---- requests ----


class RunRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=32)
    trade_date: date
    selected_analysts: List[AnalystKey] = ["market", "social", "news", "fundamentals"]
    research_depth: Literal[1, 3, 5] = 1
    llm_provider: Provider = "openai"
    deep_think_llm: str
    quick_think_llm: str
    output_language: str = "English"
    google_thinking_level: Optional[Literal["low", "minimal", "medium", "high"]] = None
    openai_reasoning_effort: Optional[Literal["low", "medium", "high"]] = None
    anthropic_effort: Optional[Literal["low", "medium", "high"]] = None
    checkpoint_enabled: bool = True
    data_vendors: Dict[Literal["core_stock_apis", "technical_indicators", "fundamental_data", "news_data"], VendorKey] = {
        "core_stock_apis": "yfinance",
        "technical_indicators": "yfinance",
        "fundamental_data": "yfinance",
        "news_data": "yfinance",
    }


# ---- responses ----


class RunSummary(BaseModel):
    run_id: str
    ticker: str
    trade_date: str
    status: RunStatus
    rating: Optional[Rating] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error: Optional[str] = None


class RunDetail(RunSummary):
    request: Optional[RunRequest] = None
    final_state: Optional[Dict[str, Any]] = None
    stats: Optional[Dict[str, int]] = None


class MemoryEntry(BaseModel):
    date: str
    ticker: str
    rating: str
    pending: bool
    raw_return: Optional[str] = None
    alpha_return: Optional[str] = None
    holding: Optional[str] = None
    decision: str = ""
    reflection: str = ""


class ProviderInfo(BaseModel):
    name: Provider
    label: str
    models_quick: List[Dict[str, str]]
    models_deep: List[Dict[str, str]]
    api_key_env: Optional[str] = None
    api_key_configured: bool = False


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str

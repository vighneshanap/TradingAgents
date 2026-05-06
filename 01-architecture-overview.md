# 01 — Architecture Overview

## Layers

```
┌──────────────────────────────────────────────────────────────────┐
│  CLI / Entry layer                                               │
│   cli/main.py        — Rich TUI, interactive questionnaire       │
│   main.py / test.py  — programmatic entry points                 │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Orchestration layer (tradingagents/graph/)                      │
│   trading_graph.py     — TradingAgentsGraph: top-level facade    │
│   setup.py             — LangGraph DAG construction              │
│   conditional_logic.py — debate routing + exit conditions        │
│   propagation.py       — initial state + invocation args         │
│   reflection.py        — post-hoc α-return reflection            │
│   signal_processing.py — extracts 5-tier rating from PM prose    │
│   checkpointer.py      — per-ticker SqliteSaver                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Agents layer (tradingagents/agents/)                            │
│   analysts/      — market, social, news, fundamentals            │
│   researchers/   — bull, bear                                    │
│   managers/      — research_manager, portfolio_manager           │
│   trader/        — trader                                        │
│   risk_mgmt/     — aggressive, conservative, neutral             │
│   schemas.py     — Pydantic structured-output schemas            │
│   utils/         — agent_states, agent_utils, memory, structured │
└──────────────────────────────────────────────────────────────────┘
                              │           │
                              ▼           ▼
┌────────────────────────────┐ ┌────────────────────────────────┐
│ LLM client layer           │ │ Dataflow layer                 │
│ tradingagents/llm_clients/ │ │ tradingagents/dataflows/       │
│  factory.py                │ │  interface.py (vendor router)  │
│  openai_client.py          │ │  y_finance.py                  │
│  anthropic_client.py       │ │  yfinance_news.py              │
│  google_client.py          │ │  alpha_vantage*.py             │
│  azure_client.py           │ │  stockstats_utils.py           │
│  model_catalog.py          │ │  config.py / utils.py          │
└────────────────────────────┘ └────────────────────────────────┘
```

## Package map

```
tradingagents/
├─ default_config.py              # All tunable knobs (see doc 11)
├─ __init__.py
├─ agents/                        # All 11 agent factories
├─ dataflows/                     # Vendor-agnostic data layer
├─ graph/                         # LangGraph orchestration
└─ llm_clients/                   # Pluggable LLM provider layer

cli/                              # Rich-based terminal UI
├─ main.py                        # Typer app entry, live display
├─ models.py                      # CLI dataclasses
├─ utils.py                       # interactive questionnaire
├─ config.py
├─ announcements.py               # fetches https://api.tauric.ai/v1/announcements
├─ stats_handler.py               # LangChain BaseCallbackHandler counts
└─ static/                        # ASCII banners

scripts/smoke_structured_output.py  # quick end-to-end smoke
tests/                              # 10 test modules (see doc 16)
main.py / test.py                   # example programmatic entry
Dockerfile, docker-compose.yml      # deployment (see doc 17)
.env.example, .env.enterprise.example
pyproject.toml                      # version 0.2.4
```

## Request flow (one `propagate(ticker, date)` call)

1. **Resolve pending memory entries** for this ticker — fetch realised returns,
   compute α vs SPY, generate reflections, atomically batch-write into
   `trading_memory.md`. (Done *before* the new run starts.)
2. **Load `past_context`** from the memory log: most recent N=5 same-ticker
   decisions plus N=3 cross-ticker reflections.
3. **Initialise state** (`AgentState`) with the ticker, date, empty reports,
   empty debate states, and the `past_context` blob.
4. **Run LangGraph DAG.** Analysts (parallelised inside their own tool-calling
   loop) populate four reports → Bull/Bear debate → Research Manager →
   Trader → 3-way risk debate → Portfolio Manager → END.
5. **Persist:** save the full state as JSON under `~/.tradingagents/logs/<TICKER>/`,
   append the decision (status `pending`) to the memory log, and (if checkpointing
   was on) clear the per-thread checkpoint rows.
6. **Return** `(final_state, rating)` where `rating ∈ {Buy, Overweight, Hold,
   Underweight, Sell}` extracted by `SignalProcessor`.

## What is *not* in this codebase

* No broker integration (Alpaca, IBKR, etc.). See [doc 14](14-brokers-execution-ml.md).
* No order/execution engine, no paper-trading sim.
* No ML / forecasting models (no sklearn, torch, xgboost, prophet).
* No LangSmith / Langfuse / OpenTelemetry / Phoenix tracing. See [doc 12](12-logging-and-observability.md).
* No LiteLLM. Each provider has a hand-written client wrapping the vendor's
  LangChain integration. See [doc 07](07-llm-providers.md).
* No web UI / dashboard. See [doc 10](10-cli-and-ui.md).
* No vector DB / RAG. Memory is plain markdown with regex parsing.

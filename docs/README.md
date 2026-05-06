# TradingAgents — Project Documentation

A complete, file-by-file walkthrough of the **TradingAgents** framework: a multi-agent
LLM trading research pipeline built on LangGraph, with multi-provider LLM support, a
Rich-based terminal UI, persistent decision memory, checkpoint resume, and pluggable
data vendors.

> ⚠️ **What this project is, and is not.**
> TradingAgents is a *research and analysis* framework. It produces a structured
> Buy / Overweight / Hold / Underweight / Sell rating per ticker. It **does not
> execute orders, connect to a broker, or place trades.** It has no Alpaca,
> Interactive Brokers, or paper-trading integration. See
> [14-brokers-execution-ml.md](14-brokers-execution-ml.md) for details.

## Documentation map

| # | File | What it covers |
|---|------|----------------|
| 01 | [architecture-overview.md](01-architecture-overview.md) | The big picture: layers, package map, request flow |
| 02 | [agents-and-system-prompts.md](02-agents-and-system-prompts.md) | All 11 agents with **verbatim system prompts**, inputs, outputs |
| 03 | [langgraph-orchestration.md](03-langgraph-orchestration.md) | The LangGraph DAG, edges, debate loops, exit conditions |
| 04 | [state-and-schemas.md](04-state-and-schemas.md) | `AgentState`, debate states, Pydantic structured-output schemas |
| 05 | [data-sources.md](05-data-sources.md) | yfinance, Alpha Vantage, vendor routing, fallback |
| 06 | [tools.md](06-tools.md) | The 9 LangChain tools agents call |
| 07 | [llm-providers.md](07-llm-providers.md) | All 10 LLM providers, model catalog, factory pattern |
| 08 | [memory-and-reflection.md](08-memory-and-reflection.md) | Append-only decision log, deferred reflection, alpha vs SPY |
| 09 | [checkpointing.md](09-checkpointing.md) | LangGraph SqliteSaver, per-ticker DBs, resume mechanics |
| 10 | [cli-and-ui.md](10-cli-and-ui.md) | Rich-based terminal UI, interactive prompts, live layout |
| 11 | [configuration.md](11-configuration.md) | Every config key, env vars, examples |
| 12 | [logging-and-observability.md](12-logging-and-observability.md) | Logs, callback stats, **no LangSmith / Langfuse / OTel** |
| 13 | [governance-and-security.md](13-governance-and-security.md) | Ticker safety, PII posture, gaps |
| 14 | [brokers-execution-ml.md](14-brokers-execution-ml.md) | **No broker, no execution, no ML models** — what's actually there |
| 15 | [decision-flow.md](15-decision-flow.md) | End-to-end walkthrough of one `propagate()` call |
| 16 | [development-and-testing.md](16-development-and-testing.md) | Tests, fixtures, scripts |
| 17 | [deployment-docker.md](17-deployment-docker.md) | Docker, Dockerfile, env, enterprise variant |
| 18 | [cli-internals.md](18-cli-internals.md) | `MessageBuffer`, decorators, message classification, streaming loop |
| 19 | [changelog-summary.md](19-changelog-summary.md) | Architecture-relevant release timeline (0.1.0 → 0.2.4) |
| 20 | [glossary.md](20-glossary.md) | Quick reference for every term used in the codebase |
| 21 | [extending-the-framework.md](21-extending-the-framework.md) | Recipes: add an analyst / provider / data vendor / approval gate |
| 22 | [output-artefacts.md](22-output-artefacts.md) | Every file written to disk per run |
| 23 | [file-index.md](23-file-index.md) | One-line summary of every Python module |
| 24 | [faq.md](24-faq.md) | Common questions answered against v0.2.4 |

## TL;DR

* **Framework:** LangGraph (no LangChain agent runtime, no LangSmith, no LiteLLM).
* **Agents:** 4 analysts (Market, Social, News, Fundamentals) → 2 researchers (Bull/Bear)
  → Research Manager → Trader → 3 risk debaters (Aggressive, Conservative, Neutral)
  → Portfolio Manager. **11 agents total.**
* **LLMs:** Pluggable. OpenAI, Anthropic, Google, Azure OpenAI, xAI, DeepSeek, Qwen,
  GLM, OpenRouter, Ollama. Default: `gpt-5.4` (deep) / `gpt-5.4-mini` (quick).
* **Data:** yfinance (default, free, no key) or Alpha Vantage (fallback, requires key).
* **Memory:** Append-only markdown log at `~/.tradingagents/memory/trading_memory.md`.
  Past decisions plus realised α-vs-SPY are injected into future PM prompts.
* **UI:** Rich terminal app via `tradingagents` CLI (`cli/main.py`). No web UI.
* **Tracing/Observability:** None external. In-process callback counts only
  (LLM calls, tool calls, tokens) shown in the live footer.
* **Brokers / Execution / ML:** None. Output is a markdown decision; you act on it manually.

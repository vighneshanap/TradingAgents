# 19 — Release History (Summary)

A condensed view of [`CHANGELOG.md`](../CHANGELOG.md). The full file lists
contributors and PR numbers; this is the architecture-relevant timeline.

## 0.2.4 — 2026-04-25 (current)

The release of record for everything in these docs.

* **Structured-output decision agents.** Research Manager, Trader, Portfolio
  Manager moved to typed Pydantic schemas via `with_structured_output`. Each
  provider's native mechanism (OpenAI/xAI `json_schema`, Gemini `response_schema`,
  Anthropic tool-use, OpenAI-compatible function-calling).
* **LangGraph checkpoint resume** opt-in via `--checkpoint`, per-ticker SQLite.
* **Persistent decision log** (`trading_memory.md`). Replaced the per-agent
  BM25 `FinancialSituationMemory`. Decisions stored at end of `propagate`,
  resolved with α-vs-SPY on next same-ticker run.
* **DeepSeek, Qwen, GLM, Azure OpenAI** providers added; OpenRouter model
  selection became dynamic.
* **Docker support** (multi-stage build, `docker-compose.yml`).
* **5-tier rating scale** unified across Research Manager, Portfolio Manager,
  signal processor, memory log. Trader stays 3-tier.
* **`scripts/smoke_structured_output.py`** smoke script.
* `backend_url` default flipped from OpenAI URL to `None` so non-OpenAI
  providers don't inherit a wrong endpoint.
* All file I/O passes explicit `encoding="utf-8"` (Windows cp1252 fix).
* Cache and log directories moved to `~/.tradingagents/`.
* OpenAI structured output uses `method="function_calling"` to silence
  langchain-openai Responses-API parse warnings.

Removed:
* `FinancialSituationMemory` (BM25 per-agent memory).
* `reflect_and_remember()` — replaced by deferred reflection in the memory log.
* Hardcoded Google endpoint that 404'd after a `langchain-google-genai` change.

## 0.2.3 — 2026-03-29

* **Multi-language output** (`output_language` config) for analyst reports
  and final decisions. Internal debate stays English.
* **GPT-5.4 family** in the catalog with deep/quick split.
* **Unified model catalog** as the single source of truth for CLI options
  + provider validation.
* `base_url` forwarded to Google and Anthropic clients (corporate proxies).
* Look-ahead bias fix in backtesting fetchers (`filter_financials_by_date`).
* Invalid indicator names handled at the tool boundary.
* yfinance news fetchers got the same exponential backoff as price fetchers.

## 0.2.2 — 2026-03-22

* **Five-tier rating scale** introduced (PM only at this stage).
* **Anthropic effort level** support.
* **OpenAI Responses API** for native OpenAI models.
* `risk_manager` renamed to `portfolio_manager`.
* Exchange-qualified tickers preserved across all prompts (`7203.T`, `BRK.B`).
* yfinance rate-limit retry with exponential backoff.
* HTTP client SSL customisation.

## 0.2.1 — 2026-03-15

* **Security:** patched `langchain-core` LangGrinch vulnerability (#335),
  removed `chainlit` dependency (CVE-2026-22218).
* `pyproject.toml` packaging; `setup.py` removed.
* Risk manager reads correct fundamental report source.
* Initial UTF-8 encoding pass on all `open()` calls.
* `get_indicators` handles comma-separated indicator names.
* `Propagation` initialises every debate-state field.
* Conditional debate logic respects configured round count.

## 0.2.0 — 2026-02-04

The largest release since the initial public version.

* **Multi-provider LLM support** (OpenAI, Google, Anthropic, xAI, OpenRouter,
  Ollama) via the factory pattern.
* **Alpha Vantage** integration as a configurable primary data provider.
* **Footer statistics** in CLI: real-time LLM/tool/token tracking.
* **Per-section markdown report saving**.
* **Announcements panel** (`api.tauric.ai/v1/announcements`).
* **Tool fallbacks** — single vendor outage doesn't stop the run.
* Risky/Safe risk debaters renamed Aggressive/Conservative.

## 0.1.1 — 2025-06-07

Maintenance: removed bundled static-site assets; the public site moved out of
the repo.

## 0.1.0 — 2025-06-05

**Initial public release.** Multi-agent shape (4 analysts, bull/bear,
trader, 3 risk debaters, portfolio manager). LangGraph orchestration.
yfinance only. **Per-agent BM25 memory** (later replaced). Single-provider
OpenAI. Interactive CLI.

## What this means for you

If you're reading the codebase right now (v0.2.4), historical references
in old issues or arXiv preprint to:

* `FinancialSituationMemory` / per-agent ChromaDB → **gone**, see [doc 08](08-memory-and-reflection.md).
* `reflect_and_remember(returns)` → **gone**, reflection is now automatic and
  deferred to the next same-ticker run.
* `risk_manager` agent → **renamed** `portfolio_manager`.
* "Risky / Safe" debaters → **renamed** Aggressive / Conservative.
* Single OpenAI hardcode → **gone**, factory pattern.
* `setup.py` → **gone**, `pyproject.toml`.
* In-process BM25 retrieval → **gone**, plain markdown decision log.

These are common sources of confusion when comparing the published paper
([arXiv 2412.20138](https://arxiv.org/abs/2412.20138)) against the current
codebase.

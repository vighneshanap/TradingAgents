# 13 — Governance, Security, and Safety Posture

> This is a **research framework**, not a regulated production trading system.
> The governance posture below describes what is and is not implemented today,
> not what an enterprise deployment would require.

## Implemented

### Path-traversal hardening on tickers

File: [`tradingagents/dataflows/utils.py`](../tradingagents/dataflows/utils.py)
(`safe_ticker_component`).

The ticker is interpolated into multiple filesystem paths:
* `<data_cache_dir>/checkpoints/<TICKER>.db` (checkpoint DB)
* `<results_dir>/<TICKER>/...` (run outputs)
* yfinance OHLCV cache filename

Without sanitisation a malicious ticker `../../../etc/passwd` would escape the
intended directory. `safe_ticker_component` enforces:

* Allowed chars: `[A-Za-z0-9._\-\^]` (letters, digits, dot, dash, underscore,
  caret for indices like `^GSPC`).
* Max length 32.
* Trims whitespace, uppercases, raises `ValueError` on rejection.

Enforced at every path-construction site. Shipped in PR
[#618](https://github.com/TauricResearch/TradingAgents/pull/618). Tests:
`tests/test_safe_ticker_component.py`, `tests/test_ticker_symbol_handling.py`.

### Provider-base-URL leakage fix

`config["backend_url"]` defaults to `None`. An earlier version had
`https://api.openai.com/v1` baked in, which leaked into Gemini and Anthropic
clients when the user switched provider — producing malformed URLs. The fix:
each provider's client falls back to its own default base URL when `None`.
(See comment block in `default_config.py:18-23`.)

### Atomic memory log writes

Phase B updates to `trading_memory.md` use the temp-file + `os.replace()` idiom
so a crash mid-write never corrupts the log. Idempotency: `store_decision` skips
if a `pending` tag for `(date, ticker)` already exists.

### Look-ahead bias prevention in data layer

`filter_financials_by_date()` and the look-back-window logic in
`stockstats_utils.py` strip rows whose period is later than `curr_date`. This
prevents an analyst reasoning about 2024-Q1 when running a 2023-12-31 backtest.

### Structured-output schema validation

Three decision-making agents (Research Manager, Trader, Portfolio Manager)
constrain output to typed Pydantic schemas. The provider's native structured
mode (function calling for OpenAI/xAI, response_schema for Gemini, tool-use for
Anthropic) enforces the shape. Free-text fallback is logged.

## Not implemented

### PII and content controls

* No automatic PII detection or redaction.
* No content moderation layer over LLM outputs.
* No prompt-injection filter on tool results (a maliciously crafted news
  article fed into the news analyst is not sanitised).
* The ticker symbol is stored plain-text everywhere (this is benign — it's a
  public market identifier).

### Authentication and authorisation

* No multi-user model. The CLI runs as the local user.
* No RBAC, no role separation between analysts and approvers.
* The "Portfolio Manager approves the transaction" language in the README is
  **conceptual**, not enforced. There is no human-in-the-loop gate.

### Audit and compliance

* No tamper-evident audit log. Files on disk are mutable.
* No signed decisions, no append-only enforcement at filesystem level.
* No timestamped attestations of which model, which prompt, which data source
  was used (though those are *implicitly* recoverable from the JSON state
  dump + git SHA).

### Guardrails / safety

* No financial-advice disclaimers injected into outputs (the README disclaims
  it; the LLM outputs do not).
* No regulatory-jurisdiction filtering.
* No "do not trade these tickers" allowlist/blocklist.
* No rate limiting on `propagate()` calls.

### Secrets

* API keys are read from `.env` / environment. The repo does not encrypt or
  vault secrets, and assumes the host environment is trusted.
* `.env.example` and `.env.enterprise.example` are checked in as templates
  with empty values.

### Data egress

* yfinance and Alpha Vantage requests go out as plain HTTPS. No proxying,
  no DLP layer.
* The CLI fetches `https://api.tauric.ai/v1/announcements` once per run with
  a 1.0 s timeout. Failures are silent; no announcement data is sent
  outbound. Output language and ticker are not transmitted.

## Recommended hardening for production-style deployment

Things you would likely add (none are present today):

* A `human-in-the-loop` node before the Portfolio Manager that pauses for an
  approver — LangGraph supports this natively but no node is wired.
* Centralised structured logging with run IDs (UUID per `propagate`).
* Cost/latency budgets enforced in `propagate()`.
* Provider key rotation through a secret manager.
* OpenTelemetry instrumentation for spans + metrics.
* Tamper-evident audit (sign each decision JSON with a key managed externally).
* A jurisdiction allowlist on tickers.
* Output content filtering (e.g. block decisions on instruments the user is
  not authorised to advise on).

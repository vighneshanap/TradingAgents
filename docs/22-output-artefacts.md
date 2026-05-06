# 22 — Output Artefacts (everything written to disk)

A complete inventory of what one `tradingagents analyze` run leaves behind.

## Directory tree

```
~/.tradingagents/                                  # base, override TRADINGAGENTS_*
├── cache/
│   ├── checkpoints/                               # only if --checkpoint
│   │   └── NVDA.db                                # SqliteSaver per ticker
│   └── ohlcv/                                     # implicit yfinance cache
│       └── NVDA.csv                               # 5-year rolling OHLCV
│
├── logs/                                          # results_dir
│   └── NVDA/                                      # safe_ticker_component(TICKER)
│       ├── 2026-01-15/                            # CLI per-date subfolder
│       │   ├── message_tool.log                   # streamed event log
│       │   └── reports/
│       │       ├── market_report.md               # per-section streamed
│       │       ├── sentiment_report.md
│       │       ├── news_report.md
│       │       ├── fundamentals_report.md
│       │       ├── investment_plan.md
│       │       ├── trader_investment_plan.md
│       │       └── final_trade_decision.md
│       └── TradingAgentsStrategy_logs/
│           └── full_states_log_2026-01-15.json    # full AgentState dump
│
└── memory/
    └── trading_memory.md                          # append-only decision log
```

## CLI-driven save (optional, prompted post-run)

If the user answers **Y** to "Save report?", the CLI also writes to a
user-chosen path (default: `./reports/<TICKER>_<YYYYMMDD_HHMMSS>/`):

```
reports/NVDA_20260115_142301/
├── 1_analysts/
│   ├── market.md
│   ├── sentiment.md
│   ├── news.md
│   └── fundamentals.md
├── 2_research/
│   ├── bull.md
│   ├── bear.md
│   └── manager.md
├── 3_trading/
│   └── trader.md
├── 4_risk/
│   ├── aggressive.md
│   ├── conservative.md
│   └── neutral.md
├── 5_portfolio/
│   └── decision.md
└── complete_report.md                             # header + 5 sections concatenated
```

This save is performed by `save_report_to_disk` in
[`cli/main.py:639-726`](../cli/main.py).

## Content shape per file

### `message_tool.log`

```
14:23:01 [System] Selected ticker: NVDA
14:23:01 [System] Analysis date: 2026-01-15
14:23:02 [User] NVDA
14:23:05 [Tool Call] get_stock_data(symbol=NVDA, start_date=2025-12-15, end_date=2026-01-15)
14:23:07 [Data] Date,Open,High,Low,Close,Volume,Adj Close ...
14:23:12 [Agent] Based on the price action, NVDA shows a strong uptrend ...
14:23:14 [Tool Call] get_indicators(symbol=NVDA, indicator=close_50_sma,close_200_sma,rsi, ...)
...
```

Newlines in the original LLM output are collapsed to spaces. The format
is `HH:MM:SS [Type] content`.

### `reports/<section>.md`

Plain markdown — the value of `final_state["<section>"]`. The PM's section
(`final_trade_decision.md`) starts with `**Rating**: ...`.

### `full_states_log_<date>.json`

A pretty-printed JSON dump (indent=4) of the entire `AgentState` produced by
`TradingAgentsGraph._log_state`. Top-level keys:

```json
{
  "company_of_interest": "NVDA",
  "trade_date": "2026-01-15",
  "market_report": "...",
  "sentiment_report": "...",
  "news_report": "...",
  "fundamentals_report": "...",
  "investment_debate_state": {
    "bull_history": "...", "bear_history": "...",
    "history": "...", "current_response": "...",
    "judge_decision": "..."
  },
  "trader_investment_decision": "...",
  "risk_debate_state": {
    "aggressive_history": "...", "conservative_history": "...",
    "neutral_history": "...", "history": "...",
    "judge_decision": "..."
  },
  "investment_plan": "...",
  "final_trade_decision": "..."
}
```

`messages` is **not** included — too noisy and contains LangChain message
objects that don't JSON-serialise cleanly. The `count` fields are also
omitted.

### `trading_memory.md`

See [doc 08](08-memory-and-reflection.md). Block-per-decision with HTML
comment delimiters.

### `<TICKER>.db` (checkpoint)

Standard LangGraph SqliteSaver schema, two tables:

* `checkpoints` (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata)
* `writes` (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, value)

Cleared by `clear_checkpoint(cache_dir, ticker, date)` after a successful run
(deletes only the rows for this thread_id, leaves other dates' checkpoints
in the same DB intact).

## What is *not* written

* No global log file (the only log goes per-run to `message_tool.log`).
* No metrics file, no Prometheus exporter snapshot.
* No cost/latency report.
* No PDF, no slide deck, no email.
* No git commit / artefact upload.
* No persistent token usage tally between runs (`StatsCallbackHandler`
  state is in-memory only).

## Cleanup

* **Memory log:** set `config["memory_log_max_entries"] = N` to cap resolved
  entries. Pending entries are never auto-pruned.
* **Checkpoints:** `tradingagents analyze --clear-checkpoints` deletes the
  whole `checkpoints/` directory before the run; or just delete files manually.
* **Logs / reports:** no automatic rotation. They accumulate forever under
  `~/.tradingagents/logs/`. `rm -rf ~/.tradingagents/logs/<TICKER>/` is safe
  — none of the runtime depends on past logs.
* **OHLCV cache:** safe to delete; will be rebuilt on next run.

## Concurrency notes

* Two CLI processes analysing the **same ticker on the same date** with
  `--checkpoint` will collide on the same `thread_id` — don't.
* Two processes on **same ticker, different dates** will share the
  `<TICKER>.db` SQLite file but use different thread_ids; SqliteSaver opens
  with `check_same_thread=False`. Tested behaviour is fine but heavy parallelism
  is not the design point.
* Two processes on **different tickers** are fully isolated (separate
  `.db` files, separate `<TICKER>/` log dirs).
* The memory log uses temp-file + `os.replace()` for rewrites, so concurrent
  writers from different tickers shouldn't corrupt the file — but they could
  lose each other's pending entries if writes interleave during the
  read-modify-write window. The idempotency guard makes this self-correcting
  on the next run, but be aware.

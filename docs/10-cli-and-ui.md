# 10 — CLI and UI

The framework ships with a single user interface: a **Rich-based interactive
terminal application**. There is **no web UI, no REST API, no GraphQL
endpoint, no Streamlit/Gradio dashboard, and no Electron app**.

## Entry points

| Command | Source | Effect |
|---------|--------|--------|
| `tradingagents` | `[project.scripts]` in `pyproject.toml` → `cli.main:app` | Typer app |
| `python -m cli.main` | direct module invocation | Typer app |
| `python main.py` | repo root | Programmatic example: `TradingAgentsGraph().propagate("NVDA", "2024-05-10")` |
| `python test.py` | repo root | Smoke variant of `main.py` |
| `python scripts/smoke_structured_output.py` | scripts/ | End-to-end structured-output smoke |

## CLI commands

```bash
tradingagents analyze [--checkpoint] [--clear-checkpoints]
```

| Flag | Effect |
|------|--------|
| `--checkpoint` | Sets `config["checkpoint_enabled"] = True` (see [doc 09](09-checkpointing.md)) |
| `--clear-checkpoints` | Wipes `<cache_dir>/checkpoints/` before running |

Other commands surfaced by Typer: only `analyze`. There is no `backtest`,
`reflect`, `replay`, or `serve` subcommand at present.

## Interactive questionnaire (8 prompts)

`cli/utils.py` drives an 8-step `questionary` flow before the run starts:

1. **Ticker symbol** — preserves exchange suffixes (`SPY`, `7203.T`, `0700.HK`,
   `BRK.B`, `^GSPC`, …) via `safe_ticker_component`.
2. **Analysis date** — `YYYY-MM-DD`, must not be in the future.
3. **Output language** — English (default), Chinese, Japanese, Korean, Hindi,
   Spanish, Portuguese, French, German, Arabic, Russian, or custom. Sets
   `config["output_language"]`. Internal debate stays English regardless.
4. **Analyst team** — checkbox selection of any subset of
   `{market, social, news, fundamentals}` (≥ 1 required). Drives `selected_analysts`.
5. **Research depth** — Shallow (1 round), Medium (3), Deep (5).
   Sets `max_debate_rounds` and `max_risk_discuss_rounds`.
6. **LLM provider** — one of the 10 providers (see [doc 07](07-llm-providers.md)).
7. **Thinking agents** — separate quick / deep model picks from `model_catalog.MODEL_OPTIONS`.
8. **Provider-specific config:**
   * Google: thinking mode (Enable / Minimal)
   * OpenAI: reasoning effort (Low / Medium / High)
   * Anthropic: effort (Low / Medium / High)

After the run finishes, two more prompts:

* Save report to disk? (Y/N)
* Display full report on screen? (Y/N)

## Live display layout

`cli/main.py` builds a Rich `Layout` with five panes, refreshed at **4 Hz**
during graph execution:

```
┌──────────────── Welcome panel (Tauric Research banner) ────────────────┐
├──────────────── Progress: per-team agent status table ──────────────────┤
│   Analyst Team    [pending|in_progress|done] x4                         │
│   Research Team   x2 + Research Manager                                 │
│   Trading Team    x1                                                    │
│   Risk Mgmt       x3 + Portfolio Manager                                │
├──────────────── Messages: live tool & LLM message feed ─────────────────┤
├──────────────── Analysis: current report section markdown ──────────────┤
└────────────── Footer: agents N/M | LLM N | Tools N | ↑Nk ↓Nk | MM:SS ──┘
```

The footer pulls counters from `cli/stats_handler.StatsCallbackHandler`,
a thread-safe `BaseCallbackHandler` (`langchain_core.callbacks.BaseCallbackHandler`)
that hooks `on_llm_start`, `on_chat_model_start`, `on_llm_end`, `on_tool_start`
and accumulates `{llm_calls, tool_calls, tokens_in, tokens_out}`.

## Output artefacts

After a run, `cli/main.py` saves under
`<results_dir>/<TICKER>/<YYYY-MM-DD>/`:

```
message_tool.log               # HH:MM:SS [TYPE] line-per-event log
reports/
├── market_report.md
├── sentiment_report.md
├── news_report.md
├── fundamentals_report.md
├── investment_plan.md
├── trader_investment_plan.md
└── final_trade_decision.md
complete_report.md             # consolidated single-file deliverable
```

Plus `<results_dir>/<TICKER>/TradingAgentsStrategy_logs/full_states_log_<date>.json`
written by `TradingAgentsGraph._log_state` containing the entire `AgentState`.

## Static assets and announcements

* `cli/static/welcome.txt` — ASCII art banner shown at startup.
* `cli/announcements.py` fetches `https://api.tauric.ai/v1/announcements` with a
  1.0 s timeout and silently falls back to a "visit GitHub" link on failure. The
  endpoint may set `require_attention=True`, which gates the run on a
  `getpass.getpass()` call until the user presses Enter.
* `assets/cli/cli_init.png`, `cli_news.png`, `cli_transaction.png` are README
  screenshots of the Rich UI (referenced from `README.md`).

## Encoding

Rich console writes report files with explicit `encoding="utf-8"` after a
v0.2.4 fix that addressed Windows `cp1252` failures on multi-language outputs.

# 20 — Glossary

Quick-reference for terms used across the codebase, prompts, and these docs.

## Agents

| Term | Meaning |
|------|---------|
| **Analyst** | One of four "first stage" agents (Market, Social, News, Fundamentals) that calls tools and writes a markdown report into `*_report` state fields. Quick-tier LLM. |
| **Researcher** | Bull or Bear Researcher — debates the analyst reports, no tools. Quick-tier LLM. |
| **Research Manager** | Adjudicates the bull/bear debate, produces a `ResearchPlan` (5-tier rating + rationale + actions). Deep-tier LLM. |
| **Trader** | Translates the research plan into a concrete `TraderProposal` (Buy/Hold/Sell + reasoning, optional entry/stop/sizing). Quick-tier LLM. |
| **Risk debaters** | Aggressive / Conservative / Neutral analysts that argue about the trader proposal. Quick-tier LLM. |
| **Portfolio Manager** | Final decision-maker. Reads risk debate, research plan, trader proposal, and `past_context`. Produces a `PortfolioDecision`. Deep-tier LLM. |
| **Reflector** | Not a graph node. Runs at the start of the next same-ticker run to grade the *previous* decision against actual α-vs-SPY. |
| **`Msg Clear *` node** | Synthetic node that wipes the message history between analysts to keep context clean (and Anthropic-compatible). |

## State

| Term | Meaning |
|------|---------|
| **`AgentState`** | The dict that flows through the LangGraph DAG (extends `MessagesState`). [doc 04](04-state-and-schemas.md). |
| **`InvestDebateState`** | TypedDict tracking Bull/Bear histories and `count`. |
| **`RiskDebateState`** | TypedDict tracking 3-way risk histories, `latest_speaker`, `count`. |
| **`past_context`** | Memory-log injection (5 same-ticker + 3 cross-ticker recent reflections). Currently consumed by Portfolio Manager only. |
| **`final_trade_decision`** | Markdown string of the rendered `PortfolioDecision`. Memory log + signal processor read this. |

## Schemas

| Schema | Owner | Fields |
|--------|-------|--------|
| `ResearchPlan` | Research Manager | `recommendation` (5-tier), `rationale`, `strategic_actions` |
| `TraderProposal` | Trader | `action` (3-tier), `reasoning`, optional `entry_price`, `stop_loss`, `position_sizing` |
| `PortfolioDecision` | Portfolio Manager | `rating` (5-tier), `executive_summary`, `investment_thesis`, optional `price_target`, `time_horizon` |
| `PortfolioRating` | shared enum | `Buy`, `Overweight`, `Hold`, `Underweight`, `Sell` |
| `TraderAction` | shared enum | `Buy`, `Hold`, `Sell` |

## Ratings

| Rating | Meaning (PM context) |
|--------|----------------------|
| `Buy` | Strong conviction to enter or add to position |
| `Overweight` | Favourable outlook, gradually increase exposure |
| `Hold` | Maintain current position, no action needed |
| `Underweight` | Reduce exposure, take partial profits |
| `Sell` | Exit position or avoid entry |

## Orchestration

| Term | Meaning |
|------|---------|
| **LangGraph** | The DAG/state-machine runtime under `langgraph>=0.4.8`. |
| **`StateGraph(AgentState)`** | The graph builder. Compiled in `setup.py`. |
| **`ToolNode`** | LangGraph prebuilt node that executes tool calls and returns `ToolMessage`s. Four buckets: market, social, news, fundamentals. |
| **`thread_id`** | 16-hex char SHA-256 prefix of `f"{TICKER}:{date}"`. LangGraph uses it as the checkpoint partition key. |
| **`stream_mode="values"`** | Streaming mode that yields the full state dict per chunk (vs `"updates"` which yields deltas). The CLI relies on this. |
| **`recursion_limit`** | LangGraph guard against infinite loops. Default 100 (config: `max_recur_limit`). |
| **`max_debate_rounds`** | Bull/Bear loop exits at `count >= 2 * max_debate_rounds`. |
| **`max_risk_discuss_rounds`** | Risk loop exits at `count >= 3 * max_risk_discuss_rounds`. |

## Memory

| Term | Meaning |
|------|---------|
| **Memory log** | The append-only `trading_memory.md` file. No vector DB. [doc 08](08-memory-and-reflection.md). |
| **Phase A** | Decision storage at end of `propagate`: writes a `pending` entry. No LLM call. |
| **Phase B** | Outcome resolution at start of next same-ticker `propagate`: fetches realised α, generates reflection, atomically updates the entry. One quick-LLM call per pending entry. |
| **`pending`** | Tag state on a memory entry whose outcome (return / α) is not yet known. |
| **`raw_return`** | Stock close-to-close return over the holding window (default 5 trading days). |
| **`alpha_return`** | `raw_return - SPY_return` over the same window. |

## LLMs

| Term | Meaning |
|------|---------|
| **Quick-tier LLM** | `quick_think_llm` config. Used by analysts, debaters, trader, reflector. |
| **Deep-tier LLM** | `deep_think_llm` config. Used by Research Manager, Portfolio Manager. |
| **Provider** | One of 10 backends. See [doc 07](07-llm-providers.md). |
| **Reasoning effort / Thinking level / Effort** | Provider-specific knob exposed via `openai_reasoning_effort`, `google_thinking_level`, `anthropic_effort`. |
| **Structured output** | Provider-native typed-output mode. Wrapped by `bind_structured` with free-text fallback. |
| **Normalised content** | The string produced by `normalize_content` after collapsing typed-block content lists into plain text. |

## Data

| Term | Meaning |
|------|---------|
| **Vendor** | A data backend: `yfinance` or `alpha_vantage`. |
| **Category** | One of `core_stock_apis`, `technical_indicators`, `fundamental_data`, `news_data`. Vendor selection is per-category by default. |
| **Tool override** | `config["tool_vendors"][tool_name] = vendor` — beats category default. |
| **Look-ahead bias** | Using post-`curr_date` data during analysis. Prevented by `filter_financials_by_date()` and `load_ohlcv()` slicing. |
| **`safe_ticker_component`** | Guard that rejects path-traversal-y ticker strings before they hit the filesystem. |
| **stockstats** | The third-party library that computes technical indicators on a wrapped pandas DataFrame. |

## CLI

| Term | Meaning |
|------|---------|
| **`MessageBuffer`** | Live-display state object with agent statuses, recent messages, recent tool calls, and accumulated `report_sections`. |
| **`StatsCallbackHandler`** | LangChain `BaseCallbackHandler` counting `llm_calls / tool_calls / tokens_in / tokens_out`. |
| **Selected analysts** | The user-chosen subset of `{market, social, news, fundamentals}`. Drives both `setup_graph()` and the buffer's status table. |
| **Research depth** | Maps to `max_debate_rounds == max_risk_discuss_rounds` — Shallow=1, Medium=3, Deep=5. |

## Files & paths

| Path | Purpose |
|------|---------|
| `~/.tradingagents/cache/` | OHLCV cache + checkpoint DBs. Override: `TRADINGAGENTS_CACHE_DIR`. |
| `~/.tradingagents/cache/checkpoints/<TICKER>.db` | LangGraph SqliteSaver per ticker. |
| `~/.tradingagents/logs/<TICKER>/<DATE>/` | CLI run outputs (markdown + log). Override: `TRADINGAGENTS_RESULTS_DIR`. |
| `~/.tradingagents/logs/<TICKER>/TradingAgentsStrategy_logs/full_states_log_<date>.json` | Full `AgentState` dump per run. |
| `~/.tradingagents/memory/trading_memory.md` | Append-only decision log. Override: `TRADINGAGENTS_MEMORY_LOG_PATH`. |

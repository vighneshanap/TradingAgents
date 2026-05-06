# 15 — End-to-End Decision Flow

A walkthrough of one `propagate("NVDA", "2026-01-15")` call. Times are
illustrative.

```
T+0.0s  TradingAgentsGraph.__init__()
        ├── set_config(config)                     # Cascade to dataflows.config
        ├── mkdirs for results_dir, data_cache_dir
        ├── create_llm_client(provider, deep_model, **provider_kwargs)
        ├── create_llm_client(provider, quick_model, ...)
        │   → both wrap the LangChain integration with NormalizedChat* subclass
        │   → callbacks (StatsCallbackHandler, etc.) injected here
        ├── TradingMemoryLog(config)               # opens trading_memory.md path
        ├── _create_tool_nodes()                   # market/social/news/fundamentals ToolNodes
        ├── ConditionalLogic(max_debate_rounds=1, max_risk_discuss_rounds=1)
        ├── GraphSetup.setup_graph(["market","social","news","fundamentals"])
        │   → builds the LangGraph DAG
        ├── self.workflow = ...                    # uncompiled
        └── self.graph = self.workflow.compile()   # no checkpointer yet

T+0.5s  ta.propagate("NVDA", "2026-01-15")
        │
        ├── _resolve_pending_entries("NVDA")
        │   ├── Read trading_memory.md
        │   ├── For each pending NVDA entry:
        │   │   ├── _fetch_returns: yfinance.NVDA + yfinance.SPY for 5d window
        │   │   ├── reflector.reflect_on_final_decision(...)  # ONE quick-LLM call per entry
        │   │   └── append to updates list
        │   └── batch_update_with_outcomes(updates)            # atomic temp-file rewrite
        │
        ├── (if checkpoint_enabled)
        │   ├── get_checkpointer(cache_dir, "NVDA")            # opens NVDA.db
        │   ├── self.graph = self.workflow.compile(checkpointer=saver)
        │   ├── checkpoint_step(...) → log "Resuming…" or "Starting fresh…"
        │   └── inject thread_id into config["configurable"]
        │
        └── _run_graph("NVDA", "2026-01-15")
            ├── past_context = memory_log.get_past_context("NVDA", 5, 3)
            │   → "Past analyses of NVDA…" + "Recent cross-ticker lessons…"
            │
            ├── init_state = Propagator.create_initial_state(...)
            │   → AgentState dict with messages=[("human","NVDA")], past_context=...
            │
            ├── self.graph.invoke(init_state, **args)        # or .stream() in debug
```

## Inside the graph

```
START
  ↓
Market Analyst (quick LLM)
  ├── tool_calls: [get_stock_data] → ToolNode "tools_market" → returns OHLCV CSV
  ├── tool_calls: [get_indicators] → ToolNode → returns indicator series
  └── final response (no tool calls) → state.market_report = response.content

Msg Clear Market   → wipes message history, inserts HumanMessage("Continue")

Social Analyst (quick LLM)
  ├── tool_calls: [get_news("NVDA", ...)] → ToolNode → returns news markdown
  └── final response → state.sentiment_report

Msg Clear Social
News Analyst        → state.news_report
Msg Clear News
Fundamentals Analyst → state.fundamentals_report
Msg Clear Fundamentals

Bull Researcher (quick LLM)
  → reads all 4 reports + investment_debate_state.history
  → prepends "Bull Analyst:" to response
  → updates investment_debate_state (count=1)

[count(1) < 2 * max_debate_rounds(1) ? false]   → exit at count=2

Bear Researcher (quick LLM)
  → updates investment_debate_state (count=2)
  → routing exits to Research Manager

Research Manager (deep LLM, structured ResearchPlan)
  → state.investment_plan = render_research_plan(plan)
  → state.investment_debate_state.judge_decision = same

Trader (quick LLM, structured TraderProposal)
  → state.trader_investment_plan = render_trader_proposal(proposal)
  → state.messages += [AIMessage(trader_plan)]
  → state.sender = "Trader"

Aggressive Analyst (quick LLM)
  → updates risk_debate_state (count=1, latest_speaker="Aggressive")

Conservative Analyst (quick LLM)
  → updates risk_debate_state (count=2, latest_speaker="Conservative")

Neutral Analyst (quick LLM)
  → updates risk_debate_state (count=3, latest_speaker="Neutral")

[count(3) >= 3 * max_risk_discuss_rounds(1) ? true] → exit to Portfolio Manager

Portfolio Manager (deep LLM, structured PortfolioDecision)
  → reads risk_debate_state.history, investment_plan, trader_investment_plan,
        past_context (memory log)
  → state.final_trade_decision = render_pm_decision(decision)
  → state.risk_debate_state.judge_decision = same

END
```

## After the graph returns

```
T+~minutes
        ├── self.curr_state = final_state
        ├── _log_state(trade_date, final_state)
        │   → writes <results_dir>/<TICKER>/TradingAgentsStrategy_logs/full_states_log_<date>.json
        │
        ├── memory_log.store_decision("NVDA", "2026-01-15", final_trade_decision)
        │   → appends "[2026-01-15 | NVDA | Buy | pending]" block to trading_memory.md
        │
        ├── (if checkpoint_enabled)
        │       clear_checkpoint(cache_dir, "NVDA", "2026-01-15")
        │
        └── return (final_state, signal_processor.process_signal(final_decision))
                                  → parse_rating(...) → "Buy"
```

The CLI (`cli/main.py`) wraps all of the above with a Rich Live layout updating
at 4 Hz, plus the post-run prompts to save & display the final report.

## Rough LLM call count (default config, 4 analysts, 1+1 debate rounds)

| Phase | Calls | Tier |
|-------|-------|------|
| Reflection on prior pending entries | 1 per pending NVDA entry | quick |
| Each analyst loop (≥ 1 LLM call + N tool-result re-invocations) | 4 × ~2 | quick |
| Bull Researcher | 1 | quick |
| Bear Researcher | 1 | quick |
| Research Manager | 1 | **deep** |
| Trader | 1 | quick |
| Aggressive / Conservative / Neutral | 3 | quick |
| Portfolio Manager | 1 | **deep** |
| **Total** | **~16 + reflections** | mostly quick |

Plus tool calls (yfinance / Alpha Vantage HTTP requests) in the analyst loops.

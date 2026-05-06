# 23 — File Index

A one-line summary of every Python module in the repo, plus the key
non-Python files. Use this to jump into the codebase.

## Root

| File | Summary |
|------|---------|
| [`main.py`](../main.py) | Programmatic entry — builds `DEFAULT_CONFIG.copy()`, calls `TradingAgentsGraph(...).propagate("NVDA", "2024-05-10")`. |
| [`test.py`](../test.py) | Smoke variant of `main.py`. |
| [`pyproject.toml`](../pyproject.toml) | Package metadata: version 0.2.4, `requires-python>=3.10`, deps, entry point `tradingagents = "cli.main:app"`, pytest config. |
| [`uv.lock`](../uv.lock) | uv lockfile (large, generated). |
| [`requirements.txt`](../requirements.txt) | Trivial — pyproject is the source of truth. |
| [`README.md`](../README.md) | Public framework overview, install + CLI usage + persistence sections. |
| [`CHANGELOG.md`](../CHANGELOG.md) | Release history (see [doc 19](19-changelog-summary.md)). |
| [`LICENSE`](../LICENSE) | Apache 2.0. |
| [`Dockerfile`](../Dockerfile) | Multi-stage Python 3.12-slim build. |
| [`docker-compose.yml`](../docker-compose.yml) | `tradingagents` + `ollama` + `tradingagents-ollama` services. |
| [`.dockerignore`](../.dockerignore) | Build-context exclusions. |
| [`.env.example`](../.env.example) | LLM provider + Alpha Vantage key template. |
| [`.env.enterprise.example`](../.env.enterprise.example) | Azure OpenAI variables template. |
| `.gitignore` | Standard. |

## `tradingagents/`

| File | Summary |
|------|---------|
| [`__init__.py`](../tradingagents/__init__.py) | Empty namespace package. |
| [`default_config.py`](../tradingagents/default_config.py) | The `DEFAULT_CONFIG` dict — every tunable knob. See [doc 11](11-configuration.md). |

### `tradingagents/agents/`

| File | Summary |
|------|---------|
| [`__init__.py`](../tradingagents/agents/__init__.py) | Re-exports every `create_*` factory + state TypedDicts. |
| [`schemas.py`](../tradingagents/agents/schemas.py) | Pydantic schemas: `ResearchPlan`, `TraderProposal`, `PortfolioDecision` + render functions. |
| `analysts/fundamentals_analyst.py` | Reads financial statements, writes `fundamentals_report`. |
| `analysts/market_analyst.py` | Picks ≤8 indicators, calls `get_stock_data` + `get_indicators`, writes `market_report`. |
| `analysts/news_analyst.py` | Calls `get_news` + `get_global_news`, writes `news_report`. |
| `analysts/social_media_analyst.py` | Calls `get_news`, writes `sentiment_report`. (No social-media API!) |
| `researchers/bull_researcher.py` | Bull-side debater. No tools. |
| `researchers/bear_researcher.py` | Bear-side debater. No tools. |
| `managers/research_manager.py` | Adjudicates Bull/Bear. Uses `ResearchPlan` structured output. Deep-tier. |
| `managers/portfolio_manager.py` | Final decision. Uses `PortfolioDecision` structured output. Deep-tier. |
| `trader/trader.py` | Translates research plan into `TraderProposal`. |
| `risk_mgmt/aggressive_debator.py` | High-risk advocate in the 3-way risk debate. |
| `risk_mgmt/conservative_debator.py` | Low-risk advocate. |
| `risk_mgmt/neutral_debator.py` | Balanced view. |
| `utils/agent_states.py` | `AgentState`, `InvestDebateState`, `RiskDebateState` TypedDicts. |
| `utils/agent_utils.py` | Re-exports the 9 LangChain tools, `get_language_instruction`, `build_instrument_context`, `create_msg_delete`. |
| `utils/structured.py` | `bind_structured` + `invoke_structured_or_freetext`. |
| `utils/memory.py` | `TradingMemoryLog` — append-only markdown decision log. |
| `utils/rating.py` | `parse_rating` heuristic; `RATINGS_5_TIER` constant. |
| `utils/core_stock_tools.py` | `@tool get_stock_data`. |
| `utils/technical_indicators_tools.py` | `@tool get_indicators` with comma-separated indicator support. |
| `utils/fundamental_data_tools.py` | `@tool get_fundamentals / get_balance_sheet / get_cashflow / get_income_statement`. |
| `utils/news_data_tools.py` | `@tool get_news / get_global_news / get_insider_transactions`. |

### `tradingagents/dataflows/`

| File | Summary |
|------|---------|
| [`__init__.py`](../tradingagents/dataflows/__init__.py) | (empty). |
| [`config.py`](../tradingagents/dataflows/config.py) | `_config` singleton with `initialize_config / set_config / get_config`. |
| [`utils.py`](../tradingagents/dataflows/utils.py) | `safe_ticker_component`, `save_output`, `get_current_date`, `get_next_weekday`. |
| [`interface.py`](../tradingagents/dataflows/interface.py) | Vendor router: `TOOLS_CATEGORIES`, `VENDOR_LIST`, `VENDOR_METHODS`, `route_to_vendor`. |
| `y_finance.py` | yfinance OHLCV / fundamentals / financial statements / insider transactions. |
| `yfinance_news.py` | yfinance per-ticker + global news. |
| `stockstats_utils.py` | Indicator calculation, OHLCV loader with caching, `yf_retry`, `_clean_dataframe`. |
| `alpha_vantage.py` | (Re-exports from sub-modules.) |
| `alpha_vantage_common.py` | `_make_api_request`, `format_datetime_for_api`, `AlphaVantageRateLimitError`. |
| `alpha_vantage_stock.py` | `TIME_SERIES_DAILY_ADJUSTED`. |
| `alpha_vantage_indicator.py` | SMA/EMA/MACD/RSI/BBANDS/ATR via Alpha Vantage. |
| `alpha_vantage_fundamentals.py` | OVERVIEW / BALANCE_SHEET / CASH_FLOW / INCOME_STATEMENT. |
| `alpha_vantage_news.py` | NEWS_SENTIMENT, INSIDER_TRANSACTIONS. |

### `tradingagents/graph/`

| File | Summary |
|------|---------|
| [`__init__.py`](../tradingagents/graph/__init__.py) | Re-exports. |
| [`trading_graph.py`](../tradingagents/graph/trading_graph.py) | `TradingAgentsGraph` facade — LLM creation, propagate(), reflection, signal processing, state logging. |
| [`setup.py`](../tradingagents/graph/setup.py) | `GraphSetup.setup_graph(selected_analysts)` — full DAG construction. |
| [`conditional_logic.py`](../tradingagents/graph/conditional_logic.py) | `should_continue_*` routing functions. |
| [`propagation.py`](../tradingagents/graph/propagation.py) | `Propagator.create_initial_state` + `get_graph_args`. |
| [`reflection.py`](../tradingagents/graph/reflection.py) | `Reflector.reflect_on_final_decision`. |
| [`signal_processing.py`](../tradingagents/graph/signal_processing.py) | `SignalProcessor.process_signal` → `parse_rating`. |
| [`checkpointer.py`](../tradingagents/graph/checkpointer.py) | Per-ticker SqliteSaver, `thread_id`, `clear_checkpoint`. |

### `tradingagents/llm_clients/`

| File | Summary |
|------|---------|
| [`__init__.py`](../tradingagents/llm_clients/__init__.py) | Re-exports `create_llm_client`. |
| [`factory.py`](../tradingagents/llm_clients/factory.py) | Provider → client dispatch. Lazy imports. |
| [`base_client.py`](../tradingagents/llm_clients/base_client.py) | `BaseLLMClient` ABC + `normalize_content`. |
| [`openai_client.py`](../tradingagents/llm_clients/openai_client.py) | `OpenAIClient` (covers OpenAI/xAI/DeepSeek/Qwen/GLM/Ollama/OpenRouter), `NormalizedChatOpenAI`, `DeepSeekChatOpenAI`. |
| [`anthropic_client.py`](../tradingagents/llm_clients/anthropic_client.py) | `AnthropicClient`, `NormalizedChatAnthropic`. |
| [`google_client.py`](../tradingagents/llm_clients/google_client.py) | `GoogleClient` with Gemini 2.5 vs 3 thinking-mode mapping. |
| [`azure_client.py`](../tradingagents/llm_clients/azure_client.py) | `AzureOpenAIClient`. |
| [`model_catalog.py`](../tradingagents/llm_clients/model_catalog.py) | `MODEL_OPTIONS[provider][quick|deep]` and `get_known_models`. |
| [`validators.py`](../tradingagents/llm_clients/validators.py) | `validate_model(provider, model)`. |
| [`TODO.md`](../tradingagents/llm_clients/TODO.md) | Tiny TODO file (most items now done). |

## `cli/`

| File | Summary |
|------|---------|
| [`__init__.py`](../cli/__init__.py) | (empty). |
| [`main.py`](../cli/main.py) | The Typer app, MessageBuffer, Live display, save/display routines. |
| [`utils.py`](../cli/utils.py) | All `questionary` prompts. |
| [`models.py`](../cli/models.py) | `AnalystType` enum. |
| [`config.py`](../cli/config.py) | `CLI_CONFIG` (announcements URL/timeout/fallback). |
| [`announcements.py`](../cli/announcements.py) | Fetch + display the Tauric announcements panel. |
| [`stats_handler.py`](../cli/stats_handler.py) | `StatsCallbackHandler`. |
| [`static/welcome.txt`](../cli/static/welcome.txt) | ASCII art welcome banner. |

## `scripts/`

| File | Summary |
|------|---------|
| [`scripts/smoke_structured_output.py`](../scripts/smoke_structured_output.py) | Diagnostic script — exercises Research Manager, Trader, Portfolio Manager structured-output paths. |

## `tests/`

| File | Summary |
|------|---------|
| `conftest.py` | Pytest fixtures, dummy API key injection. |
| `test_structured_agents.py` | Schemas + render functions + fallback. |
| `test_memory_log.py` | Append-only log behaviour. |
| `test_checkpoint_resume.py` | LangGraph checkpoint round-trip. |
| `test_signal_processing.py` | `parse_rating` heuristic. |
| `test_model_validation.py` | Model catalog validation. |
| `test_google_api_key.py` | api_key/google_api_key kwarg handling. |
| `test_deepseek_reasoning.py` | DeepSeek thinking-mode round-trip + structured-output rejection. |
| `test_ticker_symbol_handling.py` | Exchange-suffix preservation. |
| `test_safe_ticker_component.py` | Path-traversal guard. |

## `assets/`

* `TauricResearch.png`, `analyst.png`, `researcher.png`, `risk.png`,
  `schema.png`, `trader.png`, `wechat.png` — README graphics.
* `cli/cli_init.png`, `cli/cli_news.png`, `cli/cli_transaction.png` —
  CLI screenshots referenced in the README.

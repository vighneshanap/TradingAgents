# 11 — Configuration Reference

The full default config lives in
[`tradingagents/default_config.py`](../tradingagents/default_config.py). Override
any key by passing a `dict` to `TradingAgentsGraph(config=...)` or, for paths,
by setting environment variables.

## Every key explained

| Key | Default | Type | Purpose / accepted values |
|-----|---------|------|---------------------------|
| `project_dir` | (auto) | path | Set to the package directory at import time. Don't override. |
| `results_dir` | `~/.tradingagents/logs/` | path | Run outputs (markdown reports, full-state JSON). Env: `TRADINGAGENTS_RESULTS_DIR`. |
| `data_cache_dir` | `~/.tradingagents/cache/` | path | OHLCV cache + per-ticker checkpoint DBs. Env: `TRADINGAGENTS_CACHE_DIR`. |
| `memory_log_path` | `~/.tradingagents/memory/trading_memory.md` | path | Append-only decision log. Env: `TRADINGAGENTS_MEMORY_LOG_PATH`. |
| `memory_log_max_entries` | `None` | int \| None | Soft cap on resolved entries (oldest pruned). `None` disables rotation. Pending never pruned. |
| `llm_provider` | `"openai"` | str | One of `openai, anthropic, google, azure, xai, deepseek, qwen, glm, openrouter, ollama`. |
| `deep_think_llm` | `"gpt-5.4"` | str | Model used by Research Manager, Portfolio Manager, Reflector. |
| `quick_think_llm` | `"gpt-5.4-mini"` | str | Model used by analysts, debaters, trader. |
| `backend_url` | `None` | str \| None | Override the provider's base URL (corporate proxy etc.). When `None`, each provider uses its own default. |
| `google_thinking_level` | `None` | str \| None | Gemini-only: `low / minimal / medium / high`. Mapped to `thinking_budget` for Gemini 2.5. |
| `openai_reasoning_effort` | `None` | str \| None | OpenAI-only: `low / medium / high`. |
| `anthropic_effort` | `None` | str \| None | Anthropic-only: `low / medium / high`. |
| `checkpoint_enabled` | `False` | bool | Opt-in LangGraph checkpointing for resume. |
| `output_language` | `"English"` | str | Final report language. Internal debate stays English. |
| `max_debate_rounds` | `1` | int | Bull/Bear loop exits at `count >= 2 * max_debate_rounds`. |
| `max_risk_discuss_rounds` | `1` | int | Risk loop exits at `count >= 3 * max_risk_discuss_rounds`. |
| `max_recur_limit` | `100` | int | LangGraph `recursion_limit`. |
| `data_vendors` | dict | dict | Category-level vendor selection (see below). |
| `tool_vendors` | `{}` | dict | Tool-level vendor overrides (highest precedence). |

### `data_vendors`

```python
{
    "core_stock_apis":      "yfinance",   # or "alpha_vantage"
    "technical_indicators": "yfinance",   # or "alpha_vantage"
    "fundamental_data":     "yfinance",   # or "alpha_vantage"
    "news_data":            "yfinance",   # or "alpha_vantage"
}
```

### `tool_vendors`

Empty by default. Example:

```python
config["tool_vendors"]["get_stock_data"] = "alpha_vantage"
# leaves all other tools on yfinance
```

## Environment variables

### Path overrides
* `TRADINGAGENTS_RESULTS_DIR`
* `TRADINGAGENTS_CACHE_DIR`
* `TRADINGAGENTS_MEMORY_LOG_PATH`

### LLM provider keys (set the one you use)
| Provider | Env var |
|---|---|
| OpenAI | `OPENAI_API_KEY` |
| Google Gemini | `GOOGLE_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| xAI / Grok | `XAI_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| Qwen / DashScope | `DASHSCOPE_API_KEY` |
| Zhipu GLM | `ZHIPU_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Ollama | (none — sends literal `"ollama"`) |
| Azure OpenAI | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME`, `OPENAI_API_VERSION` |

### Data vendor key
* `ALPHA_VANTAGE_API_KEY` (only needed if you switch from yfinance)

### Loaded automatically
`main.py` and `cli/main.py` call `load_dotenv()`, so a `.env` file at the
working directory is read. `.env.example` and `.env.enterprise.example` are
provided as starting templates.

## Programmatic overrides

```python
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

config = DEFAULT_CONFIG.copy()
config["llm_provider"]            = "anthropic"
config["deep_think_llm"]          = "claude-opus-4-6"
config["quick_think_llm"]         = "claude-haiku-4-5"
config["anthropic_effort"]        = "medium"
config["max_debate_rounds"]       = 2
config["checkpoint_enabled"]      = True
config["output_language"]         = "Japanese"
config["data_vendors"]["news_data"] = "alpha_vantage"

ta = TradingAgentsGraph(debug=False, config=config)
state, rating = ta.propagate("NVDA", "2026-01-15")
```

`config["callbacks"]` is **not** a documented key — pass callbacks via
`TradingAgentsGraph(callbacks=[handler])` instead. Callbacks are forwarded into
each LLM client constructor.

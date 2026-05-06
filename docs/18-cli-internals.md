# 18 — CLI Internals

A deeper look at [`cli/main.py`](../cli/main.py) — the Rich-based runtime that
sits between the questionnaire and `TradingAgentsGraph`.

## Module layout

| Module | Responsibility |
|--------|---------------|
| [`cli/main.py`](../cli/main.py) | Typer app, MessageBuffer, Live Rich layout, the chunk-streaming loop, save/display routines |
| [`cli/utils.py`](../cli/utils.py) | All `questionary` prompts (`get_ticker`, `get_analysis_date`, `select_analysts`, `select_llm_provider`, etc.) |
| [`cli/models.py`](../cli/models.py) | `AnalystType` enum (`market`, `social`, `news`, `fundamentals`) |
| [`cli/config.py`](../cli/config.py) | `CLI_CONFIG` dict for the announcements URL + timeout + fallback |
| [`cli/announcements.py`](../cli/announcements.py) | `fetch_announcements()` + `display_announcements()` (silent failure) |
| [`cli/stats_handler.py`](../cli/stats_handler.py) | `StatsCallbackHandler` — `BaseCallbackHandler` counting LLM/tool/token events |
| [`cli/static/welcome.txt`](../cli/static/welcome.txt) | ASCII art shown in the welcome panel |

## `MessageBuffer`

A single in-memory buffer that the live UI reads from. Defined in
`cli/main.py:44-227`.

```python
class MessageBuffer:
    FIXED_AGENTS = {
        "Research Team":      ["Bull Researcher", "Bear Researcher", "Research Manager"],
        "Trading Team":       ["Trader"],
        "Risk Management":    ["Aggressive Analyst", "Neutral Analyst", "Conservative Analyst"],
        "Portfolio Management": ["Portfolio Manager"],
    }
    ANALYST_MAPPING = {
        "market":       "Market Analyst",
        "social":       "Social Analyst",
        "news":         "News Analyst",
        "fundamentals": "Fundamentals Analyst",
    }
    REPORT_SECTIONS = {
        "market_report":         ("market",       "Market Analyst"),
        "sentiment_report":      ("social",       "Social Analyst"),
        "news_report":           ("news",         "News Analyst"),
        "fundamentals_report":   ("fundamentals", "Fundamentals Analyst"),
        "investment_plan":       (None,           "Research Manager"),
        "trader_investment_plan":(None,           "Trader"),
        "final_trade_decision":  (None,           "Portfolio Manager"),
    }
```

`init_for_analysis(selected_analysts)` builds two dicts:

* `agent_status[name]  ∈ {"pending", "in_progress", "completed", "error"}`
* `report_sections[key] = None | str` (latest content)

`get_completed_reports_count()` is **the** "how many reports are done" metric
shown in the footer. A report is done only if its content is non-empty AND its
*finalising* agent is marked `completed`. Without that gate, intermediate Bull
or Bear chunks would inflate the count.

### Decorator pattern for disk I/O

`run_analysis` wraps three `MessageBuffer` methods to also persist to disk:

```python
message_buffer.add_message          = save_message_decorator(...)
message_buffer.add_tool_call        = save_tool_call_decorator(...)
message_buffer.update_report_section = save_report_section_decorator(...)
```

Effect:
* Every message → appended to `<results_dir>/<TICKER>/<DATE>/message_tool.log`
  as `HH:MM:SS [TYPE] content` (newlines → spaces).
* Every tool call → same log as `HH:MM:SS [Tool Call] tool_name(k=v, k=v)`.
* Every report-section update → also written to
  `<results_dir>/<TICKER>/<DATE>/reports/<section>.md`.

This means the full transcript and per-section markdowns are persisted **as
they stream**, even before the run finishes.

## Streaming loop

`run_analysis` calls `graph.graph.stream(init_state, **args)` and iterates
chunks. The chunk handler (cli/main.py ≈1056-1153):

1. Walks `chunk["messages"]`, deduplicates by `message.id`, classifies each
   one (`User / Agent / Data / Control / System`) via `classify_message_type`,
   and adds to the buffer.
2. Records every `message.tool_calls` entry.
3. Calls `update_analyst_statuses(buffer, chunk)` to flip pending → in_progress
   → completed for the four analysts based on accumulated `report_sections`.
4. Inspects `chunk["investment_debate_state"]` and updates the Bull / Bear /
   Research Manager statuses + writes interim history into the
   `investment_plan` report section.
5. If `chunk["trader_investment_plan"]` appears, marks Trader completed and
   Aggressive in_progress.
6. Inspects `chunk["risk_debate_state"]` and updates the three risk debaters
   + writes interim history into `final_trade_decision`. When the PM judge
   appears, marks all four risk-stage agents completed.
7. Calls `update_display(layout, ...)` to repaint.

All seven kinds of state mutation happen in the **same loop body**, so the
display reflects every chunk.

## Message classification

`classify_message_type(message)` (cli/main.py:896-919) maps LangChain message
classes to the four UI types:

| LangChain class | UI type | Notes |
|-----------------|---------|-------|
| `HumanMessage` with content `"Continue"` | **Control** | the `Msg Clear *` placeholder |
| `HumanMessage` (other) | **User** | initial ticker input |
| `AIMessage` | **Agent** | analyst / debater output |
| `ToolMessage` | **Data** | a tool's return value |
| anything else | **System** | rare |

`extract_content_string(content)` handles three shapes the LLM can emit:
plain string, dict with `text` key, list of typed blocks (Gemini 3 / OpenAI
Responses API style).

## `StatsCallbackHandler`

Thread-safe counters surfaced in the live footer. Hooks:

| Hook | Effect |
|------|--------|
| `on_llm_start` | `llm_calls += 1` |
| `on_chat_model_start` | `llm_calls += 1` |
| `on_llm_end(response)` | reads `response.generations[0][0].message.usage_metadata` and adds `input_tokens` / `output_tokens` |
| `on_tool_start` | `tool_calls += 1` |

The handler is constructed once per run, passed to
`TradingAgentsGraph(callbacks=[handler])` (which forwards it into every LLM
client) **and** via `propagator.get_graph_args(callbacks=[handler])` (which
adds it to the LangGraph `config["callbacks"]` so tool execution is tracked).

## Layout shape

`create_layout()` builds:

```
header   (size=3)
main
├── upper (ratio=3)
│    ├── progress  (ratio=2)   — agent status table
│    └── messages  (ratio=3)   — recent tool/LLM messages
└── analysis (ratio=5)         — current report markdown
footer   (size=3)              — stats line
```

The stats line is `Agents: A/B | LLM: N | Tools: N | Tokens: Nk↑ Nk↓ |
Reports: A/B | ⏱ MM:SS`.

## CLI provider URL list

The CLI's `select_llm_provider()` ([`cli/utils.py:231-268`](../cli/utils.py))
hard-codes display URLs that **differ slightly** from the defaults inside the
LLM clients:

| Provider | CLI URL | Client default URL (`_PROVIDER_CONFIG`) |
|----------|---------|------------------------------------------|
| OpenAI | `https://api.openai.com/v1` | (uses Responses API native, no override needed) |
| Google | (None — uses provider default) | (None — uses provider default) |
| Anthropic | `https://api.anthropic.com/` | (None — uses provider default) |
| xAI | `https://api.x.ai/v1` | `https://api.x.ai/v1` |
| DeepSeek | `https://api.deepseek.com` | `https://api.deepseek.com` |
| Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |
| GLM | `https://open.bigmodel.cn/api/paas/v4/` | `https://api.z.ai/api/paas/v4/` |
| OpenRouter | `https://openrouter.ai/api/v1` | `https://openrouter.ai/api/v1` |
| Azure OpenAI | (None) | (uses `AZURE_OPENAI_ENDPOINT` env var) |
| Ollama | `http://localhost:11434/v1` | `http://localhost:11434/v1` |

Programmatic users hit `_PROVIDER_CONFIG`. CLI users hit the CLI URL because
`base_url` from the questionnaire takes precedence in `OpenAIClient.get_llm()`.
The Qwen and GLM divergence is intentional: CLI users are expected to be on
the China-region endpoints; programmatic users default to the international
ones.

## OpenRouter dynamic catalog

For OpenRouter only, the CLI hits `https://openrouter.ai/api/v1/models` at
selection time (`_fetch_openrouter_models`) and shows the first 5 names plus a
"Custom model ID" entry. Failure to fetch falls back to a custom-only prompt.

## Azure deployment input

For Azure OpenAI, the CLI does **not** present a model picker — instead it
prompts for the **deployment name** (which is the value `AzureChatOpenAI`
needs as `azure_deployment`). The model id passed to `validate_model` is also
the deployment name; Azure's validator returns `True` unconditionally.

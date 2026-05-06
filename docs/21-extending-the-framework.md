# 21 — Extending the Framework

Concrete recipes for the most common extension points. Each one names every
file that has to change.

## Add a new analyst

Suppose you want a "Macro Analyst" that uses macro data. You need:

1. **Agent factory** — create
   `tradingagents/agents/analysts/macro_analyst.py` with
   `def create_macro_analyst(llm): def macro_analyst_node(state): ...`. Mirror
   one of the existing analysts (e.g. `news_analyst.py`). Write into a new
   state field `macro_report`.
2. **State** — add `macro_report: Annotated[str, "..."]` to `AgentState` in
   [`agents/utils/agent_states.py`](../tradingagents/agents/utils/agent_states.py).
3. **Initial state** — `Propagator.create_initial_state` in
   [`graph/propagation.py`](../tradingagents/graph/propagation.py) needs
   `"macro_report": ""`.
4. **Conditional logic** — add a `should_continue_macro` method to
   [`graph/conditional_logic.py`](../tradingagents/graph/conditional_logic.py).
5. **Tool node** — add a `macro` ToolNode in
   `TradingAgentsGraph._create_tool_nodes`
   ([`graph/trading_graph.py`](../tradingagents/graph/trading_graph.py)).
6. **Graph wiring** — extend the `if "macro" in selected_analysts:` block in
   [`graph/setup.py`](../tradingagents/graph/setup.py) to register the analyst,
   tools_macro, and Msg Clear Macro nodes.
7. **Package export** — add `create_macro_analyst` to
   [`agents/__init__.py`](../tradingagents/agents/__init__.py).
8. **Bull/Bear (and Aggressive/Conservative/Neutral) prompts** — they currently
   reference exactly four reports in their f-strings. Either widen them to
   include `{macro_research_report}` or accept that downstream debaters won't
   see the macro report.
9. **CLI** — add `MACRO = "macro"` to `AnalystType` in
   [`cli/models.py`](../cli/models.py); add a row to `ANALYST_ORDER` in
   [`cli/utils.py`](../cli/utils.py); add the agent to `ANALYST_MAPPING`,
   `REPORT_SECTIONS`, `ANALYST_ORDER`, `ANALYST_AGENT_NAMES`, `ANALYST_REPORT_MAP`
   in [`cli/main.py`](../cli/main.py).
10. **Tests** — extend `tests/test_ticker_symbol_handling.py` and add at
    minimum a smoke test against the new analyst factory.

## Add a new LLM provider

Suppose you want to add Cohere.

1. **Client class** — `tradingagents/llm_clients/cohere_client.py` subclassing
   `BaseLLMClient`. Implement `get_llm()` (returning a configured
   `ChatCohere(...)` instance, possibly subclassed for `normalize_content`)
   and `validate_model()`.
2. **Factory** — add a branch in
   [`llm_clients/factory.py`](../tradingagents/llm_clients/factory.py):
   ```python
   if provider_lower == "cohere":
       from .cohere_client import CohereClient
       return CohereClient(model, base_url, **kwargs)
   ```
3. **Model catalog** — add a `"cohere"` entry to `MODEL_OPTIONS` in
   [`llm_clients/model_catalog.py`](../tradingagents/llm_clients/model_catalog.py)
   with quick + deep `(label, model_id)` tuples.
4. **Validators** — `validators.VALID_MODELS` is auto-built from
   `get_known_models()` so you get validation for free unless you add Cohere
   to the "any model accepted" list (`("ollama", "openrouter")`).
5. **CLI provider list** — add a row to the `PROVIDERS` list in
   [`cli/utils.py:select_llm_provider`](../cli/utils.py).
6. **Provider-kwargs branch** in `TradingAgentsGraph._get_provider_kwargs`
   if Cohere has a thinking/effort knob you want to pipe through from config.
7. **Dependency** — add `langchain-cohere` (or your equivalent) to
   `pyproject.toml`.

## Add a new data vendor

Suppose you want to add Polygon.io.

1. **Vendor module** — create `tradingagents/dataflows/polygon.py` exporting
   functions named like `get_stock(symbol, start, end)`,
   `get_indicator(symbol, indicator, curr_date, look_back_days, ...)`,
   `get_fundamentals`, `get_balance_sheet`, `get_cashflow`,
   `get_income_statement`, `get_news`, `get_global_news`,
   `get_insider_transactions`. Match the existing yfinance / alpha-vantage
   signatures exactly.
2. **Vendor router** — extend
   [`dataflows/interface.py`](../tradingagents/dataflows/interface.py):
   * import the new functions,
   * add `"polygon"` to `VENDOR_LIST`,
   * add Polygon entries to every method dict in `VENDOR_METHODS`.
3. **Default config** — optionally let users select `"polygon"` per-category in
   `data_vendors`. No changes needed to the routing logic.
4. **Rate-limit class** — if Polygon has its own quota error, raise a
   `PolygonRateLimitError` (analogous to `AlphaVantageRateLimitError`) and
   widen the `except` clause in `route_to_vendor` to fall through on it.
5. **API key** — read from a new env var inside `polygon.py`. Add it to
   `.env.example` and the README's Required APIs section.

## Add a new structured-output decision agent

Use the existing pattern in
[`agents/utils/structured.py`](../tradingagents/agents/utils/structured.py):

1. Define a Pydantic schema in
   [`agents/schemas.py`](../tradingagents/agents/schemas.py).
2. Define `render_<schema>(instance) -> str` to produce the markdown your
   downstream consumers (memory log, CLI display) expect.
3. In your agent factory:
   ```python
   structured_llm = bind_structured(llm, MySchema, "MyAgent")

   def my_node(state):
       prompt = ...
       result_md = invoke_structured_or_freetext(
           structured_llm, llm, prompt, render_my_schema, "MyAgent"
       )
       return {"my_report": result_md}
   ```

The fallback path means a single provider that lacks structured output won't
break your agent.

## Add an external observability backend

Two clean options:

### Option A — LangSmith

LangChain honours `LANGSMITH_TRACING=true` + `LANGSMITH_API_KEY` purely from
env. You get LCEL-level spans for every LLM call out of the box. No code
change required.

### Option B — Custom callback

Write a `BaseCallbackHandler` and pass it via
`TradingAgentsGraph(callbacks=[my_handler])`. It will be installed on every
LLM client AND on the LangGraph config (because the CLI already passes it
through `propagator.get_graph_args(callbacks=...)` — for programmatic use,
either do the same or accept that only LLM callbacks fire).

Suggested hooks for cost/latency tracking:

| Hook | Use |
|------|-----|
| `on_chat_model_start` | record start time, model, agent name (if you propagate it) |
| `on_llm_end` | record latency, token usage; multiply by per-1k-token rate per model |
| `on_tool_start` / `on_tool_end` | track tool latency |
| `on_chain_start` / `on_chain_end` | LCEL-level timing |

Persist the rows to wherever you like — Postgres, SQLite, OTel exporter,
Datadog, …

## Add a human-in-the-loop approval

LangGraph supports interrupts natively. Suggested wiring:

1. Edit
   [`graph/setup.py`](../tradingagents/graph/setup.py): replace the unconditional
   `workflow.add_edge("Trader", "Aggressive Analyst")` with a custom node that
   prompts the operator (or, with `interrupt_before=["Aggressive Analyst"]`
   passed to `compile`, just stop and wait).
2. The CLI would need to detect the interrupt, render the trader proposal,
   prompt for approve/modify/reject, then call `graph.invoke(None, args)` to
   resume.
3. Memory log + checkpointing already cover crash recovery between approval
   sessions.

The codebase doesn't ship this — it's a clean point to add it.

## Add a backtester

`backtrader` is in the dependency tree but unused. To wire it in:

1. Generate a list of `(date, ticker)` pairs.
2. For each, call `propagate(ticker, date)` and record `(date, ticker, rating,
   raw_return, alpha)` from the resolved memory entry.
3. Drive a `backtrader` `cerebro` with a simple strategy that maps rating →
   position size (e.g. Buy=+100%, Overweight=+50%, Hold=0%, Underweight=−50%,
   Sell=−100%) and applies it on the next trading day.
4. Use `backtrader`'s analyzer to compute Sharpe, max drawdown, etc.

There is no helper for this in the repo today.

## Things to watch out for

* **Adding state fields** without initialising them in `Propagator` will
  break LangGraph's state merging — analyst nodes that read those fields
  will see `KeyError`.
* **Adding a new agent that doesn't use a tool** still needs a node, but no
  tools_X node and no Msg Clear node — see `bull_researcher` for the pattern.
* **Rendering** — the memory log + CLI both parse `**Rating**: X` from the
  PM's markdown. If you change the structured rendering, update
  `parse_rating` simultaneously or break decision logging silently.
* **Ticker safety** — any new path-construction site must call
  `safe_ticker_component(ticker)`. Reviewers will block PRs that don't.

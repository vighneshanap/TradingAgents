# 06 — Tools (the agents' callable surface)

Every tool the LLMs can call is a LangChain `@tool` decorated function in
`tradingagents/agents/utils/`. They are thin wrappers over `route_to_vendor`
([doc 05](05-data-sources.md)).

Wired into agents in [`tradingagents/agents/utils/agent_utils.py`](../tradingagents/agents/utils/agent_utils.py)
and grouped into four `ToolNode`s by `TradingAgentsGraph._create_tool_nodes`.

## Tool list (9 tools)

| Tool | File | Used by | Vendor category |
|------|------|---------|----------------|
| `get_stock_data(symbol, start_date, end_date)` | [`core_stock_tools.py`](../tradingagents/agents/utils/core_stock_tools.py) | Market Analyst | `core_stock_apis` |
| `get_indicators(symbol, indicator, curr_date, look_back_days=30)` | [`technical_indicators_tools.py`](../tradingagents/agents/utils/technical_indicators_tools.py) | Market Analyst | `technical_indicators` |
| `get_fundamentals(ticker, curr_date)` | [`fundamental_data_tools.py`](../tradingagents/agents/utils/fundamental_data_tools.py) | Fundamentals Analyst | `fundamental_data` |
| `get_balance_sheet(ticker, freq="quarterly", curr_date=None)` | same | Fundamentals Analyst | `fundamental_data` |
| `get_cashflow(ticker, freq="quarterly", curr_date=None)` | same | Fundamentals Analyst | `fundamental_data` |
| `get_income_statement(ticker, freq="quarterly", curr_date=None)` | same | Fundamentals Analyst | `fundamental_data` |
| `get_news(ticker, start_date, end_date)` | [`news_data_tools.py`](../tradingagents/agents/utils/news_data_tools.py) | News + Social Analysts | `news_data` |
| `get_global_news(curr_date, look_back_days=7, limit=5)` | same | News Analyst | `news_data` |
| `get_insider_transactions(ticker)` | same | News Analyst | `news_data` |

`get_indicators` accepts a comma-separated list of indicator names and aggregates
results.

## ToolNode buckets

From `TradingAgentsGraph._create_tool_nodes`
([`graph/trading_graph.py:155-189`](../tradingagents/graph/trading_graph.py)):

```python
{
    "market":       ToolNode([get_stock_data, get_indicators]),
    "social":       ToolNode([get_news]),
    "news":         ToolNode([get_news, get_global_news, get_insider_transactions]),
    "fundamentals": ToolNode([get_fundamentals, get_balance_sheet,
                              get_cashflow, get_income_statement]),
}
```

Each `ToolNode` is wired in `setup.py` as the loop-back target of the matching
analyst's `should_continue_*` conditional. Tool *result* messages flow back into
`messages`, the analyst is re-invoked, and once it stops emitting tool calls the
graph proceeds to the next analyst.

## Anti-pattern: persistent tool history

Without intervention, the messages list would carry every tool call from every
prior analyst into every subsequent analyst's prompt. To prevent that,
`create_msg_delete()` ([`agent_utils.py`](../tradingagents/agents/utils/agent_utils.py))
issues `RemoveMessage` ops for the entire message list and pushes a single
`HumanMessage("Continue")` placeholder. This **`Msg Clear <Analyst>`** node sits
between every analyst and the next one (see [doc 03](03-langgraph-orchestration.md)).
Anthropic in particular requires this — it rejects message lists that start with
non-human turns.

## Why tools are scoped per analyst

Bundling all nine tools into a single global tool set would massively increase
prompt size and make tool selection harder for smaller models. Scoping each
analyst to ≤ 4 tools focused on its job keeps quick-tier models reliable.

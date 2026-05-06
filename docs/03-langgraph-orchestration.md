# 03 — LangGraph Orchestration

The orchestration layer is built on **LangGraph** ([`langgraph>=0.4.8`](../pyproject.toml)).
There is no LangChain agent runtime, no AutoGen, no CrewAI, no LiteLLM. LangChain Core
is used only for prompt templates and `@tool` decorators on the data tools.

## Top-level entry: `TradingAgentsGraph`

* File: [`tradingagents/graph/trading_graph.py`](../tradingagents/graph/trading_graph.py)
* Constructor builds two LLMs (deep + quick), creates `ToolNode`s for the four
  analyst tool buckets, instantiates `ConditionalLogic`, `GraphSetup`,
  `Propagator`, `Reflector`, `SignalProcessor`, then compiles the LangGraph workflow.
* Public surface: `propagate(ticker, date)` → `(final_state, rating)`.

## Node graph

`GraphSetup.setup_graph(selected_analysts)` ([`graph/setup.py`](../tradingagents/graph/setup.py))
builds the DAG dynamically based on which analysts the user enabled. With the
default `["market", "social", "news", "fundamentals"]`:

```
START
  ↓
Market Analyst ─┬─ tool_calls? → tools_market ──┐
                │                               │
                └─ no tools  → Msg Clear Market │
                                  ↓             │
                            Social Analyst ←────┘
                                  ↓
                          (same pattern: Social → News → Fundamentals)
                                  ↓
                          Bull Researcher ⇄ Bear Researcher (debate loop)
                                  ↓ (after N rounds)
                          Research Manager
                                  ↓
                          Trader
                                  ↓
                          Aggressive → Conservative → Neutral (round-robin)
                                  ↓ (after N rounds)
                          Portfolio Manager
                                  ↓
                          END
```

Each analyst is wrapped by a **3-node trio**:

| Node | Type | Role |
|------|------|------|
| `Market Analyst` | LLM node (function) | Reads state, may emit tool calls |
| `tools_market` | `langgraph.prebuilt.ToolNode` | Executes any tool calls and feeds results back |
| `Msg Clear Market` | LLM node (function) | Strips messages and inserts a `HumanMessage("Continue")` placeholder so the next analyst doesn't inherit the previous tool history (Anthropic compatibility — see [`agent_utils.py:create_msg_delete`](../tradingagents/agents/utils/agent_utils.py)) |

## Conditional routing

File: [`tradingagents/graph/conditional_logic.py`](../tradingagents/graph/conditional_logic.py)

### Per-analyst tool-call routing

```python
def should_continue_market(state):
    if state["messages"][-1].tool_calls:
        return "tools_market"
    return "Msg Clear Market"
```

Same shape for `should_continue_social`, `should_continue_news`,
`should_continue_fundamentals`. After tool execution, the analyst is re-invoked
until it stops issuing tool calls.

### Investment debate (Bull ⇄ Bear)

```python
def should_continue_debate(state):
    if state["investment_debate_state"]["count"] >= 2 * self.max_debate_rounds:
        return "Research Manager"          # exit
    if state["investment_debate_state"]["current_response"].startswith("Bull"):
        return "Bear Researcher"           # bear replies
    return "Bull Researcher"               # bull replies
```

Each speaker increments `count` by 1, so a "round" = 2 turns. With the default
`max_debate_rounds=1` the loop runs exactly one Bull → one Bear → exit.

### Risk debate (3-way round-robin)

```python
def should_continue_risk_analysis(state):
    if state["risk_debate_state"]["count"] >= 3 * self.max_risk_discuss_rounds:
        return "Portfolio Manager"
    speaker = state["risk_debate_state"]["latest_speaker"]
    if speaker.startswith("Aggressive"):
        return "Conservative Analyst"
    if speaker.startswith("Conservative"):
        return "Neutral Analyst"
    return "Aggressive Analyst"
```

The cycle is `Aggressive → Conservative → Neutral → Aggressive → ...`. Each speaker
increments `count` by 1, so a "round" = 3 turns. Default `max_risk_discuss_rounds=1`
runs the cycle exactly once.

## Propagator

File: [`tradingagents/graph/propagation.py`](../tradingagents/graph/propagation.py)

Builds the initial `AgentState` dict (see [doc 04](04-state-and-schemas.md))
and the LangGraph invocation kwargs:

```python
{
    "stream_mode": "values",
    "config": {"recursion_limit": self.max_recur_limit},
}
```

When checkpointing is on, `trading_graph.py` injects
`config["configurable"]["thread_id"] = sha256(f"{TICKER}:{date}")[:16]`.

## Signal Processor

File: [`tradingagents/graph/signal_processing.py`](../tradingagents/graph/signal_processing.py)

The Portfolio Manager already returns a typed `PortfolioDecision` rendered as
markdown with a `**Rating**: X` header. `SignalProcessor.process_signal` simply
delegates to `parse_rating` ([`agents/utils/rating.py`](../tradingagents/agents/utils/rating.py)),
a 50-line regex+token heuristic — no LLM call. Returns one of `Buy`,
`Overweight`, `Hold`, `Underweight`, `Sell`.

## Reflector

File: [`tradingagents/graph/reflection.py`](../tradingagents/graph/reflection.py)

**Not part of the runtime DAG.** Called by `_resolve_pending_entries(ticker)` at
the *start* of the next same-ticker run. See [doc 08](08-memory-and-reflection.md).

## Why LangGraph (and not LangChain agents)?

* Explicit DAG: every transition is in code, easy to audit.
* Streaming: `stream_mode="values"` lets the CLI live-render each analyst report as it lands.
* Checkpointer: `langgraph-checkpoint-sqlite` gives free per-step persistence keyed
  by `thread_id`, used to resume crashed runs ([doc 09](09-checkpointing.md)).
* Tool nodes: `langgraph.prebuilt.ToolNode` integrates the four data tool buckets
  cleanly without rolling a custom executor.

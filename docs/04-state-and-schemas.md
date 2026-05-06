# 04 — State and Schemas

## `AgentState`

File: [`tradingagents/agents/utils/agent_states.py`](../tradingagents/agents/utils/agent_states.py)

`AgentState` extends `langgraph.graph.MessagesState` and is the single dict that
flows between every node. LangGraph **merges** updates rather than replacing, so
each node returns only the fields it changes.

| Field | Type | Set by |
|-------|------|--------|
| `messages` | `list[BaseMessage]` (from `MessagesState`) | LangGraph + every analyst |
| `company_of_interest` | `str` | `Propagator.create_initial_state` |
| `trade_date` | `str` (`YYYY-MM-DD`) | `Propagator.create_initial_state` |
| `sender` | `str` | `Trader` |
| `market_report` | `str` (markdown) | Market Analyst |
| `sentiment_report` | `str` | Social Analyst |
| `news_report` | `str` | News Analyst |
| `fundamentals_report` | `str` | Fundamentals Analyst |
| `investment_debate_state` | `InvestDebateState` (TypedDict) | Bull, Bear, Research Manager |
| `investment_plan` | `str` (markdown of `ResearchPlan`) | Research Manager |
| `trader_investment_plan` | `str` (markdown of `TraderProposal`) | Trader |
| `risk_debate_state` | `RiskDebateState` (TypedDict) | 3 risk debaters, PM |
| `final_trade_decision` | `str` (markdown of `PortfolioDecision`) | Portfolio Manager |
| `past_context` | `str` | `Propagator.create_initial_state` (from memory log) |

## `InvestDebateState`

```python
class InvestDebateState(TypedDict):
    bull_history:    str   # cumulative Bull-Analyst utterances
    bear_history:    str   # cumulative Bear-Analyst utterances
    history:         str   # interleaved transcript
    current_response: str  # last speaker's full text
    judge_decision:  str   # Research Manager's investment plan (markdown)
    count:           int   # incremented by 1 per Bull/Bear turn
```

Exit condition: `count >= 2 * max_debate_rounds`.

## `RiskDebateState`

```python
class RiskDebateState(TypedDict):
    aggressive_history:           str
    conservative_history:         str
    neutral_history:              str
    history:                      str
    latest_speaker:               str   # routing key: "Aggressive" | "Conservative" | "Neutral" | "Judge"
    current_aggressive_response:  str
    current_conservative_response: str
    current_neutral_response:     str
    judge_decision:               str   # Portfolio Manager's final markdown
    count:                        int
```

Exit condition: `count >= 3 * max_risk_discuss_rounds`.

---

## Pydantic structured-output schemas

File: [`tradingagents/agents/schemas.py`](../tradingagents/agents/schemas.py)

Three of the eleven agents (Research Manager, Trader, Portfolio Manager) use
typed `with_structured_output` calls. The plumbing lives in
[`agents/utils/structured.py`](../tradingagents/agents/utils/structured.py):

```python
def bind_structured(llm, schema, agent_name):
    try:                                  return llm.with_structured_output(schema)
    except (NotImplementedError, ...):    return None     # falls back to free-text

def invoke_structured_or_freetext(structured_llm, plain_llm, prompt, render, name):
    if structured_llm:
        try:                              return render(structured_llm.invoke(prompt))
        except Exception:                 ...             # log and fall through
    return plain_llm.invoke(prompt).content
```

### Shared rating enums

```python
class PortfolioRating(str, Enum):
    BUY="Buy"  OVERWEIGHT="Overweight"  HOLD="Hold"  UNDERWEIGHT="Underweight"  SELL="Sell"

class TraderAction(str, Enum):
    BUY="Buy"  HOLD="Hold"  SELL="Sell"
```

### `ResearchPlan` (Research Manager)

```python
class ResearchPlan(BaseModel):
    recommendation:    PortfolioRating
    rationale:         str    # "Conversational summary of both sides..."
    strategic_actions: str    # "Concrete steps for the trader..."
```

Rendered to markdown via `render_research_plan()`:

```
**Recommendation**: <Buy|Overweight|Hold|Underweight|Sell>

**Rationale**: ...

**Strategic Actions**: ...
```

### `TraderProposal` (Trader)

```python
class TraderProposal(BaseModel):
    action:           TraderAction        # Buy | Hold | Sell only
    reasoning:        str                 # 2–4 sentences
    entry_price:      Optional[float]
    stop_loss:        Optional[float]
    position_sizing:  Optional[str]       # e.g. "5% of portfolio"
```

Rendered with a trailing `FINAL TRANSACTION PROPOSAL: **<ACTION>**` line for
back-compat with the analyst stop-signal text.

### `PortfolioDecision` (Portfolio Manager)

```python
class PortfolioDecision(BaseModel):
    rating:            PortfolioRating
    executive_summary: str    # 2–4 sentences: entry, sizing, key risks, horizon
    investment_thesis: str    # detailed reasoning, may reference past_context lessons
    price_target:      Optional[float]
    time_horizon:      Optional[str]      # e.g. "3-6 months"
```

Rendered to markdown that the **memory log, CLI display, and saved reports all
read with the same parser**:

```
**Rating**: <Buy|Overweight|Hold|Underweight|Sell>

**Executive Summary**: ...

**Investment Thesis**: ...

**Price Target**: 250.0           # only if non-null
**Time Horizon**: 3-6 months      # only if non-null
```

## Rating parser

File: [`tradingagents/agents/utils/rating.py`](../tradingagents/agents/utils/rating.py)

A deterministic two-pass heuristic:

1. Look for `Rating: X` / `Rating - X` / `**Rating**: X` (regex,
   tolerant of markdown bold).
2. Fall back to the first occurrence of any of `Buy / Overweight / Hold /
   Underweight / Sell` in the text.

Default if nothing matches: `"Hold"`. Used by the signal processor and the
memory-log entry tagger.

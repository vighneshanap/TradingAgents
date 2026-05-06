# 14 — Brokers, Execution, and ML

This file exists to be **explicit about what is *not* in the codebase**, since
the project name and the README's "Portfolio Manager approves and the order is
sent to the simulated exchange" language can mislead.

## Brokers — none

There is **zero broker integration** in the repo. Specifically:

| Broker / API | Present? |
|--------------|---------|
| Alpaca | ❌ |
| Interactive Brokers (`ib_insync` / TWS API) | ❌ |
| TD Ameritrade / Schwab | ❌ |
| Tradier | ❌ |
| Robinhood (unofficial) | ❌ |
| Binance / Coinbase / Kraken (crypto) | ❌ |
| MetaTrader / FIX gateways | ❌ |

A repo-wide search for `alpaca`, `ib_insync`, `interactive-brokers`, `broker`,
`order`, `execute_trade`, `paper_trade` returns no module-level integrations.
The only matches are prose in agent prompts ("the order will be sent…") and
the README's conceptual description.

## Execution — none

There is **no order management or execution path**:

* The `Trader` agent produces a `TraderProposal` (`Buy / Hold / Sell`) with
  optional entry price, stop-loss, and position sizing — but these are
  free-form strings in markdown, not order objects.
* The `Portfolio Manager` produces a `PortfolioDecision` rendered as markdown.
* Nothing downstream consumes that markdown to place an order.
* `backtrader` is a transitive dependency (`pyproject.toml`) — it appears to
  be vestigial / planned. **No `backtrader` engine, strategy, broker, or
  cerebro is instantiated anywhere in `tradingagents/` or `cli/`.**

## Paper trading — none

* No paper-trading sandbox.
* No simulated order book.
* No P&L tracking beyond the post-hoc `_fetch_returns` α-vs-SPY computation
  used for the reflection step (which is for *learning from past decisions*,
  not for trading).

## What the framework actually outputs

For each `propagate(ticker, date)`:

1. A 5-tier rating: `Buy / Overweight / Hold / Underweight / Sell`.
2. A markdown `final_trade_decision` with thesis, exec summary, optional
   target / horizon.
3. Markdown sub-reports (market, sentiment, news, fundamentals) and the
   trader proposal (with optional entry/stop/sizing).
4. A persisted decision in the memory log; on the next same-ticker run,
   realised α-vs-SPY over a 5-day holding window is appended.

To turn that into actual trades, **you wire your own execution layer**.

## ML / forecasting models — none

| Model class | Present? |
|-------------|----------|
| scikit-learn | ❌ (not in `pyproject.toml`) |
| PyTorch | ❌ |
| TensorFlow / Keras | ❌ |
| XGBoost / LightGBM / CatBoost | ❌ |
| Prophet / statsmodels / neuralforecast | ❌ |
| Sentiment-classification model (HuggingFace) | ❌ |

All "analysis" is **LLM reasoning over text/CSV**. The Social Analyst does
not score sentiment with a classifier — it reads news prose and asks the LLM
to characterise sentiment. Technical indicators are **deterministic
computations** by `stockstats` over OHLCV; the LLM interprets them.

## What this framework is good for

* Evaluating LLM-driven multi-agent debate as a research methodology.
* Producing structured, auditable, opinionated rating reports per ticker.
* Comparing the same prompt-graph across providers / models.
* Backtesting *the recommendations* against realised α (via the memory log).

## What this framework is *not* good for

* Live trading without you writing the execution layer.
* Anything that requires sub-second latency (typical run is many seconds to
  minutes per ticker depending on provider and depth).
* High-frequency or quant-style signal generation.
* Anything where you need provable consistency / determinism across runs.

## Hooking in your own broker

Pseudo-code if you wanted to add one:

```python
from tradingagents.graph.trading_graph import TradingAgentsGraph
from your_alpaca_wrapper import submit_order

ta = TradingAgentsGraph(config=your_config)
state, rating = ta.propagate("NVDA", "2026-01-15")

# Pull the structured-ish hints out of the markdown:
decision_md = state["final_trade_decision"]   # has **Rating**, target, horizon
proposal_md = state["trader_investment_plan"] # has **Action**, entry, stop

# DIY parsing of the markdown — there is no helper for this today.
if rating == "Buy":
    submit_order(symbol="NVDA", qty=..., side="buy", ...)
```

The framework exposes the rendered markdown but no machine-friendly object on
the public surface — you would parse the markdown or, better, call
`bind_structured(...)` directly to get a `PortfolioDecision` instance.

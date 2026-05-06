# 05 — Data Sources

## Vendors

The framework ships with **two interchangeable market-data vendors**:

| Vendor | API key? | Rate limit | Notes |
|--------|----------|-----------|-------|
| **yfinance** | No | Soft (handled by exponential backoff, max 3 retries, base 2s) | Default. Caches 5-year OHLCV per symbol under `~/.tradingagents/cache/`. |
| **Alpha Vantage** | Yes (`ALPHA_VANTAGE_API_KEY`) | 5 calls/min on free tier | On rate-limit raise `AlphaVantageRateLimitError` → routes to yfinance. |

There are **no other data providers wired up**. Specifically: **no Reddit, no
Finnhub, no Polygon.io, no Tiingo, no IEX Cloud, no Quandl, no Google News API,
no Twitter/X / StockTwits.** The "Social Media Analyst" reads only `get_news`.

## Vendor routing

File: [`tradingagents/dataflows/interface.py`](../tradingagents/dataflows/interface.py)

```python
TOOLS_CATEGORIES = {
    "core_stock_apis":      ["get_stock_data"],
    "technical_indicators": ["get_indicators"],
    "fundamental_data":     ["get_fundamentals", "get_balance_sheet",
                             "get_cashflow",     "get_income_statement"],
    "news_data":            ["get_news", "get_global_news",
                             "get_insider_transactions"],
}

VENDORS = ["yfinance", "alpha_vantage"]
```

**Routing precedence** (highest first):

1. Tool-level override (`config["tool_vendors"]["get_stock_data"] = "alpha_vantage"`)
2. Category-level config (`config["data_vendors"]["core_stock_apis"]`)
3. Hard-coded vendor order in `VENDORS`

`route_to_vendor(method, *args, **kwargs)` calls the chosen vendor; on
`AlphaVantageRateLimitError` it falls back to the next vendor in the chain.
Any other exception propagates.

## yfinance provider

Files:
* [`tradingagents/dataflows/y_finance.py`](../tradingagents/dataflows/y_finance.py)
* [`tradingagents/dataflows/yfinance_news.py`](../tradingagents/dataflows/yfinance_news.py)
* [`tradingagents/dataflows/stockstats_utils.py`](../tradingagents/dataflows/stockstats_utils.py)

| Function | Returns |
|----------|---------|
| `get_YFin_data_online(symbol, start, end)` | OHLCV CSV, with adjusted close |
| `get_stock_stats_indicators_window(symbol, indicator, curr_date, look_back_days)` | One technical indicator's values, computed via `stockstats` on cached OHLCV |
| `get_fundamentals(ticker, curr_date)` | 28-field text snapshot (PE, EPS, beta, margins, ratios, …) |
| `get_balance_sheet / get_cashflow / get_income_statement` | CSV, quarterly or annual, filtered to ≤ `curr_date` (no look-ahead) |
| `get_news_yfinance(ticker, start, end)` | up to 20 article summaries, markdown |
| `get_global_news_yfinance(curr_date, look_back_days, limit)` | macro news (Fed, inflation, global markets), deduped by title |
| `get_insider_transactions(ticker)` | CSV of insider buys/sells |

**Caching:** `load_ohlcv()` keeps a 5-year rolling CSV per symbol; refreshed only
when the requested date is past the cache window.

**Look-ahead protection:** `filter_financials_by_date()` strips rows whose fiscal
period is later than `curr_date` so a 2024 backtest never sees 2025 financials.

## Alpha Vantage provider

Files (modular by category):
* [`alpha_vantage_common.py`](../tradingagents/dataflows/alpha_vantage_common.py) —
  `_make_api_request`, `format_datetime_for_api`, `AlphaVantageRateLimitError`
* [`alpha_vantage_stock.py`](../tradingagents/dataflows/alpha_vantage_stock.py) —
  `TIME_SERIES_DAILY_ADJUSTED` with auto compact/full sizing
* [`alpha_vantage_indicator.py`](../tradingagents/dataflows/alpha_vantage_indicator.py) —
  SMA / EMA / MACD / RSI / BBANDS / ATR (no native VWMA — returns info-only message)
* [`alpha_vantage_fundamentals.py`](../tradingagents/dataflows/alpha_vantage_fundamentals.py) —
  OVERVIEW / BALANCE_SHEET / CASH_FLOW / INCOME_STATEMENT
* [`alpha_vantage_news.py`](../tradingagents/dataflows/alpha_vantage_news.py) —
  `NEWS_SENTIMENT` (per-ticker and macro topic-filtered) + `INSIDER_TRANSACTIONS`

Every request adds `apikey={ALPHA_VANTAGE_API_KEY}&source=trading_agents`.

## Technical indicator catalog

Available across both vendors (VWMA is yfinance-only):

| Symbol | Description |
|--------|-------------|
| `close_50_sma` | 50-period Simple Moving Average |
| `close_200_sma` | 200-period Simple Moving Average |
| `close_10_ema` | 10-period Exponential Moving Average |
| `macd` / `macds` / `macdh` | MACD line / signal line / histogram |
| `rsi` | Relative Strength Index (14) |
| `boll` / `boll_ub` / `boll_lb` | Bollinger middle / upper / lower (20, 2σ) |
| `atr` | Average True Range |
| `vwma` | Volume-Weighted Moving Average (yfinance only) |
| `mfi` | Money Flow Index (yfinance only, in stockstats) |

The Market Analyst's system prompt embeds usage tips for each one (see [doc 02](02-agents-and-system-prompts.md)).

## Ticker safety

File: [`tradingagents/dataflows/utils.py`](../tradingagents/dataflows/utils.py) —
`safe_ticker_component(value, max_len=32)`.

Validates that the ticker matches `[A-Za-z0-9._\-\^]+` (uppercase letters, digits,
dot, dash, underscore, caret). Used wherever the ticker is interpolated into a
filesystem path (`<TICKER>.db` checkpoint, results dir) to block path traversal.
Tested by [`tests/test_safe_ticker_component.py`](../tests/test_safe_ticker_component.py)
and [`tests/test_ticker_symbol_handling.py`](../tests/test_ticker_symbol_handling.py).
Fix shipped in [`#618`](https://github.com/TauricResearch/TradingAgents/pull/618).

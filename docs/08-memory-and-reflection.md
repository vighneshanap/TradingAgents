# 08 — Memory and Reflection

> **There is no vector DB here.** Memory is an **append-only markdown file**
> parsed by regex. No ChromaDB, no embeddings, no semantic retrieval. The
> design is intentional: every stored artefact is human-readable and
> diff-friendly.

## File layout

Default location: `~/.tradingagents/memory/trading_memory.md`
(override with env var `TRADINGAGENTS_MEMORY_LOG_PATH`).

Each entry is a block separated by an HTML-comment delimiter:

```
[2026-01-15 | NVDA | Buy | pending]

DECISION:
**Rating**: Buy
...

<!-- ENTRY_END -->

[2026-01-08 | NVDA | Overweight | +3.4% | +1.1% | 5d]

DECISION:
**Rating**: Overweight
...

REFLECTION:
The directional call was correct (alpha +1.1%). The bull thesis on data-center
demand held; the bear concern about pricing pressure missed Hopper-class supply
constraints. Lesson: weight supply-constraint signals more heavily for AI
infrastructure names.

<!-- ENTRY_END -->
```

The tag line is the source of truth:

| Field count | Shape | Meaning |
|-------------|-------|---------|
| 4 | `[date \| ticker \| rating \| pending]` | Pending — outcome not yet resolved |
| 6 | `[date \| ticker \| rating \| ±X.Y% \| ±X.Y% \| Nd]` | Resolved — `raw_return / alpha_return / holding_days` |

## Two-phase write

File: [`tradingagents/agents/utils/memory.py`](../tradingagents/agents/utils/memory.py)
(`TradingMemoryLog`).

### Phase A — `store_decision()` (end of every `propagate()`)

* Called from `_run_graph` after the PM produces `final_trade_decision`.
* Idempotency guard: if a tag with the same `(date, ticker, pending)` already
  exists, skip.
* Parses the rating with `parse_rating()` and appends the block.
* **No LLM call** in Phase A.

### Phase B — `_resolve_pending_entries(ticker)` (start of next same-ticker run)

* Called from `propagate()` *before* the new graph runs.
* For each `pending` entry matching `ticker`:
  1. `_fetch_returns(ticker, date, holding_days=5)` calls `yfinance` for the
     ticker and `SPY` over `start..start+holding_days+7d` (the +7 is a
     weekend/holiday buffer).
  2. Computes `raw_return = (close[5] - close[0]) / close[0]`,
     `alpha_return = raw_return - spy_return`.
  3. Skips if data isn't ready (too recent, delisted, network error) — will
     retry next run.
  4. `Reflector.reflect_on_final_decision(decision, raw, alpha)` → 2–4 sentence
     prose reflection (one quick-tier LLM call per entry).
* All updates flushed in **one atomic `batch_update_with_outcomes()`**:
  read → rewrite → temp file → `os.replace()` (crash-safe).

### Rotation

If `config["memory_log_max_entries"]` is set (default `None` = no rotation),
oldest *resolved* entries are pruned once their count exceeds the cap. Pending
entries are *never* pruned — they represent unprocessed work.

## Read path

### `get_past_context(ticker, n_same=5, n_cross=3)`

Walks resolved entries in reverse chronological order:

* Take up to **5 same-ticker** entries (full DECISION + REFLECTION blocks).
* Take up to **3 cross-ticker** entries (REFLECTION only — or first 300 chars
  of DECISION if no reflection yet).

Result is the `past_context` string that lands in `AgentState.past_context`.

### Where `past_context` is consumed

Currently only the **Portfolio Manager** prompt receives `past_context`
(see [doc 02](02-agents-and-system-prompts.md)). Format:

```
- Lessons from prior decisions and outcomes:
{past_context}
```

The Research Manager and analysts do not see memory directly today; they get it
only through the PM context (and indirectly through the trader plan when the PM
later relies on it).

## Why no vector DB?

* Markdown is auditable: a portfolio manager can `cat` the file.
* Decision corpora stay small: even 1000 entries is < 1 MB.
* The retrieval question is not "find similar past decisions" — it is
  "what did I just say about *this* ticker, and what cross-ticker lessons
  recently fired" — i.e. recency-windowed, not semantic.

## Test coverage

* [`tests/test_memory_log.py`](../tests/test_memory_log.py) covers:
  parse round-trip, pending → resolved transition, atomic batch update,
  rotation behaviour, idempotency on duplicate `store_decision`.

## Caveats

* If `holding_days=5` is shorter than the position you'd actually take, alpha
  is noisier than long-horizon performance attribution. The 5-day window is
  hard-coded in `_fetch_returns`.
* SPY is the only benchmark. International tickers compute alpha against US
  SPY, which is wrong for non-US markets but sticks for now.
* If `yfinance` is offline at reflection time, the entry stays `pending` —
  the next same-ticker run will try again.

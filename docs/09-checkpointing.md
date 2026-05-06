# 09 — Checkpointing & Resume

Checkpointing is opt-in. When enabled, LangGraph writes state after **every**
node into a per-ticker SQLite database, so a crashed run resumes from the last
successful node instead of starting over.

## Files

* [`tradingagents/graph/checkpointer.py`](../tradingagents/graph/checkpointer.py)
* `langgraph.checkpoint.sqlite.SqliteSaver` (from `langgraph-checkpoint-sqlite`)

## Storage layout

```
<data_cache_dir>/checkpoints/<TICKER>.db
```

* `data_cache_dir` defaults to `~/.tradingagents/cache/`
  (override: `TRADINGAGENTS_CACHE_DIR`).
* Ticker is sanitised through `safe_ticker_component()` to block
  path traversal (e.g. `../etc/passwd`).
* One database per ticker → no contention between tickers running in parallel.

## Thread ID

```python
def thread_id(ticker, date) -> str:
    return hashlib.sha256(f"{ticker.upper()}:{date}".encode()).hexdigest()[:16]
```

* Same `(TICKER, date)` ⇒ same 16-char hex ID ⇒ resumes the same run.
* Different date ⇒ different ID ⇒ a fresh run from scratch (even on the same
  ticker), so backtesting multiple historical dates does not collide.

## Enable / disable

| Trigger | Effect |
|---------|--------|
| CLI: `tradingagents analyze --checkpoint` | Sets `config["checkpoint_enabled"] = True` for this run |
| CLI: `tradingagents analyze --clear-checkpoints` | Wipes the entire `checkpoints/` directory before starting |
| Programmatic: `config["checkpoint_enabled"] = True` | Same as `--checkpoint` |

## Run lifecycle (with checkpointing on)

```
propagate(ticker, date)
    │
    ├── _resolve_pending_entries(ticker)        # not checkpointed
    │
    ├── get_checkpointer(cache_dir, ticker)     # context manager
    │       │
    │       └── opens <cache_dir>/checkpoints/<TICKER>.db
    │
    ├── self.workflow.compile(checkpointer=saver)  # recompile graph with saver
    │
    ├── checkpoint_step(cache_dir, ticker, date)
    │       └── if a checkpoint exists for this thread:
    │               logger.info("Resuming from step N for TICKER on DATE")
    │           else:
    │               logger.info("Starting fresh for TICKER on DATE")
    │
    ├── thread_id(ticker, date)
    │   inject into config["configurable"]["thread_id"]
    │
    ├── self.graph.invoke(...) or self.graph.stream(...)
    │       └── LangGraph automatically resumes from the latest persisted state
    │           for that thread_id (if any) and saves after every node
    │
    ├── On success:
    │       clear_checkpoint(cache_dir, ticker, date)
    │           # deletes only this thread's rows from the DB
    │
    └── Always (finally):
            self._checkpointer_ctx.__exit__()
            self.graph = self.workflow.compile()   # rebind without saver
```

## What is persisted

Everything LangGraph sees as `state`. That is the entire `AgentState` dict
([doc 04](04-state-and-schemas.md)) including:

* All four analyst markdown reports.
* The full `messages` history at the time of the checkpoint.
* Both debate states (bull/bear and the 3-way risk debate) with running
  counters and histories.
* `investment_plan`, `trader_investment_plan`, `final_trade_decision`,
  `past_context`.
* Metadata: `company_of_interest`, `trade_date`, `sender`.

## What is *not* persisted

* The append to `trading_memory.md` (Phase A) only happens at the end of a
  successful run, so a crash leaves no `pending` entry behind for that date.
  That's the right behaviour: only completed runs become memory.
* Tool result caches inside `dataflows` (yfinance OHLCV cache) live in their
  own files under `data_cache_dir` and are unrelated to the LangGraph
  checkpoint DB.

## Failure modes & guarantees

* **Crash mid-node:** the *previous* node's checkpoint is intact; on resume
  LangGraph re-runs the crashed node from scratch. Idempotency depends on the
  node — analyst nodes are non-deterministic LLM calls, so resume reproduces
  *a* successful completion, not the exact original tokens.
* **Crash at `clear_checkpoint`:** harmless. Next call to `propagate(ticker,
  date)` would resume from the very last (END) checkpoint, find no work to do,
  and clear cleanly.
* **Concurrent same-ticker, same-date runs:** would compete for the same
  thread_id and likely thrash. Don't do this.
* **Concurrent same-ticker, different-date runs:** safe — different thread_ids
  in the same DB.
* **Concurrent different-ticker runs:** safe — different DB files.

## Test coverage

[`tests/test_checkpoint_resume.py`](../tests/test_checkpoint_resume.py) covers
save / restore round-trip and the `clear_checkpoint` semantics.

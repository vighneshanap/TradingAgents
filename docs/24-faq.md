# 24 — FAQ

Common questions, answered against the v0.2.4 codebase.

## "Will it actually trade for me?"

No. There is no broker integration anywhere in the repo. The output is a
markdown decision (Buy / Overweight / Hold / Underweight / Sell). To execute
trades, you'd write your own broker glue. See [doc 14](14-brokers-execution-ml.md).

## "Does it work without paid API keys?"

Yes. Default config uses **yfinance** (free, no key) for all data and you can
point `llm_provider` to **Ollama** for fully local LLMs. You can run the
entire pipeline offline with a local model.

## "Which LLM provider should I pick?"

For accuracy on the deep tier (Research Manager + Portfolio Manager): try
`gpt-5.4`, `claude-opus-4-6`, or `gemini-3.1-pro-preview`. For cost: `gpt-5.4-mini`,
`claude-haiku-4-5`, or local Ollama. The framework is provider-agnostic — pick
based on your latency / cost / quality preference. Mix is fine: deep tier on
a strong model, quick tier on a cheap one.

## "Why is the Social Media Analyst not actually using social media?"

The agent reads only `get_news` and reasons about sentiment from prose. There
is **no Reddit, Twitter/X, StockTwits API** in the repo despite the name.
This is a gap, not a feature. See [doc 05](05-data-sources.md).

## "Where is the memory? I don't see ChromaDB anywhere."

Removed in v0.2.4. The previous BM25 / per-agent ChromaDB memory
(`FinancialSituationMemory`) was replaced with a plain markdown decision log
at `~/.tradingagents/memory/trading_memory.md`. See [doc 08](08-memory-and-reflection.md).

## "Why does the same prompt produce different decisions across runs?"

LLM non-determinism. The framework deliberately doesn't pin temperature or
seeds. You can pass them through via `config["openai_reasoning_effort"]` /
`config["anthropic_effort"]` / `config["google_thinking_level"]`, or pass
extra LLM kwargs by overriding the client constructor.

## "Does it support streaming output to my own UI?"

The graph runs with `stream_mode="values"` so you get full-state chunks per
node completion. To consume them programmatically, replicate
`run_analysis`'s streaming loop in [`cli/main.py`](../cli/main.py): call
`graph.graph.stream(init_state, **args)` and process each chunk.

## "Why are the Bull/Bear/Risk debaters not using structured output?"

Because their job is to argue. Their utterances are accumulated as plain
prose into the `*_history` strings, which the next debater (or the manager)
reads. Forcing structured output here would discard the natural-language
back-and-forth that the design is built around.

## "Why are there separate quick and deep LLMs?"

Cost. The "deep" tier runs only on the Research Manager and Portfolio Manager
— ~2 calls per run. Everyone else (analysts loop with tool calls, debaters,
trader, risk debaters, reflector) runs on the cheaper "quick" tier — ~14+
calls per run. This is roughly an 8× cost reduction for the same overall
quality target.

## "How long does a run take?"

Depends entirely on provider latency and depth. Rough orders:

* **Shallow** (1 round) on Anthropic Haiku/Gemini Flash: 1–3 minutes.
* **Medium** (3 rounds) on GPT-5.4 Mini / Claude Sonnet: 3–8 minutes.
* **Deep** (5 rounds) on GPT-5.4 / Claude Opus: 10–30+ minutes.

Per-LLM call latency dominates. Tool calls (yfinance / Alpha Vantage HTTP)
are usually < 1s.

## "What's the cost ballpark?"

Not measured by the framework. Estimate yourself: ~16 LLM calls per run
(~14 quick + 2 deep) plus 1–4 reflection calls per pending memory entry.
Average tokens per call: 5k–20k input, 1k–3k output. Multiply by your
provider's per-token rate.

## "Does it leak data look-ahead?"

The data layer applies `filter_financials_by_date()` on financial statements
and slices OHLCV to `≤ curr_date` before returning. News fetchers also clip
by `curr_date`. So a backtest at `2024-01-15` should not see Q2 2024 data.
If you write a custom data tool, replicate this guard.

## "Can I run multiple tickers in parallel?"

Different tickers? Yes — each gets its own checkpoint DB and results dir.
Same ticker, different dates? Yes, same DB but different `thread_id`s. Same
ticker AND same date? Don't — they will collide on the thread_id and on the
memory-log idempotency check.

## "What happens if a run crashes?"

Without `--checkpoint`: nothing was persisted to the memory log (Phase A
write happens at the end of `propagate`), so the next attempt starts fresh.
The full-state JSON is written only on success. Per-section markdown files
are written *as* they stream, so partial reports survive.

With `--checkpoint`: state is saved after every node. Re-run with the same
ticker and date and `--checkpoint` to resume from the last successful node.
On success, the checkpoint is cleared.

## "How do I add cost tracking?"

There's no built-in cost tracking. Two options:

1. Wrap `StatsCallbackHandler` to also multiply tokens by your per-1k rate.
2. Enable LangSmith via env vars — it shows cost per call out of the box.

See [doc 12](12-logging-and-observability.md).

## "Can I have a human approve before the trade decision?"

Not out of the box. LangGraph supports `interrupt_before=[node_name]` on
`compile`, which would pause execution before a chosen node. You'd have to
edit `setup.py` and the CLI loop to surface the pause to a user. See
[doc 21](21-extending-the-framework.md).

## "Is the per-PR / per-CHANGELOG version 0.2.4 stable?"

Pre-1.0, but the public API
(`TradingAgentsGraph(config=...).propagate(ticker, date)`) has been stable
since 0.2.0. Breaking changes between 0.x versions are called out in the
CHANGELOG. The biggest recent break was 0.2.4 removing `FinancialSituationMemory`
and `reflect_and_remember()`.

## "Why do I see warnings about 'Model X is not in the known model list'?"

The model catalog (`MODEL_OPTIONS`) is hand-maintained per provider. New
provider releases (e.g. a new GPT version) won't validate until the catalog
is updated. The warning is just informational; the run continues.

## "Can I use a custom prompt for an agent?"

Not via config — prompts are hard-coded in each agent factory. Either fork
the factory or monkey-patch the `system_message` string at import time.
There's no "prompt overrides" mechanism in the codebase.

## "Why does the Trader output include `FINAL TRANSACTION PROPOSAL: **BUY**`?"

Back-compat. The earlier (pre-structured-output) version used that string as
a sentinel for the analyst stop-signal. The render still emits the line so
external consumers that grep for it keep working. The structured `action`
field is the source of truth.

## "Is there a public Docker image?"

No. The README's instructions are `docker compose run`, which builds locally
from the `Dockerfile`. There is no published image on Docker Hub or GHCR.

## "Where do I report bugs / suggest features?"

GitHub: <https://github.com/TauricResearch/TradingAgents/issues>

## "Where's the academic paper?"

[arXiv:2412.20138](https://arxiv.org/abs/2412.20138). Note: the paper
predates the v0.2.4 architectural changes (5-tier rating, structured output,
memory log redesign), so the implementation has moved on in places. These
docs describe the *current* code, not the paper's reference design.

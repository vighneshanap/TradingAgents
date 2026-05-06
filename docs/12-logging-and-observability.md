# 12 — Logging, Tracing, and Observability

> **TL;DR.** There is **no external tracing back-end wired in.** No LangSmith,
> Langfuse, OpenTelemetry, Phoenix/Arize, Helicone, Honeycomb, Datadog,
> Prometheus, or any APM. Observability is limited to in-process counters
> rendered in the CLI footer and per-run files on disk.

## What you get

| Surface | Source | Where |
|---------|--------|-------|
| Markdown reports per agent | CLI `run_analysis` writer | `<results_dir>/<TICKER>/<DATE>/reports/*.md` |
| Consolidated report | same | `<results_dir>/<TICKER>/<DATE>/complete_report.md` |
| Full state JSON | `TradingAgentsGraph._log_state` | `<results_dir>/<TICKER>/TradingAgentsStrategy_logs/full_states_log_<date>.json` |
| Live message/tool log | CLI live display | `<results_dir>/<TICKER>/<DATE>/message_tool.log` |
| Decision history | `TradingMemoryLog` | `<memory_log_path>` (default `~/.tradingagents/memory/trading_memory.md`) |
| Python `logging` events | `logger = logging.getLogger(__name__)` (graph + utils) | stdout (no FileHandler configured) |
| Counter footer | `cli/stats_handler.StatsCallbackHandler` | TUI only, ephemeral |

## Python `logging`

The codebase uses `logging.getLogger(__name__)` in:

* `tradingagents/graph/trading_graph.py`
* `tradingagents/agents/utils/structured.py`
* `tradingagents/llm_clients/base_client.py` (warnings via `warnings`)

**Nothing configures a handler / formatter / level by default.** The CLI does
not call `logging.basicConfig`. Whatever the host environment configures
applies. To capture to a file, configure a handler before importing.

Notable INFO logs:
* `Resuming from step N for <TICKER> on <date>` (checkpoint resume)
* `Starting fresh for <TICKER> on <date>`
* `Could not resolve outcome for <TICKER> on <date> (will retry next run): ...`

Notable WARNINGS:
* `<Agent>: provider does not support with_structured_output (...); falling back
  to free-text generation`
* `<Agent>: structured-output invocation failed (...); retrying once as free text`
* `Model 'X' is not in the known model list for provider 'Y'. Continuing anyway.`

## Callback-based stats

File: [`cli/stats_handler.py`](../cli/stats_handler.py)

`StatsCallbackHandler(BaseCallbackHandler)` accumulates a thread-safe dict:

```python
{
    "llm_calls":  int,    # increments on on_llm_start / on_chat_model_start
    "tool_calls": int,    # increments on on_tool_start
    "tokens_in":  int,    # from response.usage_metadata.input_tokens
    "tokens_out": int,    # from response.usage_metadata.output_tokens
}
```

The CLI passes this handler into `TradingAgentsGraph(callbacks=[handler])`,
which forwards it into every LLM client constructor. The numbers are read by
`update_display()` to render the live footer (e.g. `LLM 23 | Tools 8 | ↑12.4k ↓3.1k | 02:17`).

These counters are **process-local and never persisted**.

## What is *not* observable

* **Per-call latency.** Not measured.
* **Per-agent token spend.** Total across the run only — no per-agent breakdown.
* **Cost.** Not computed.
* **Tool input/output payloads at scale.** Captured into the run's
  `message_tool.log` as truncated lines (newlines collapsed to spaces).
* **Distributed tracing.** No span propagation; LangGraph does not emit OTel
  spans; nothing instruments HTTP clients.
* **Metrics push.** No Prometheus exporter, no StatsD client.

## If you want tracing

Easiest paths the codebase doesn't fight you on:

1. **LangSmith** — set `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY=...`
   before launching. LangChain/LangGraph honour those env vars without code
   changes. Spans appear at the LCEL invocation level, not per-agent.
2. **Custom callback** — write your own `BaseCallbackHandler` and pass it in
   via `TradingAgentsGraph(callbacks=[my_handler])`. You'll see every LLM and
   tool call.
3. **OpenTelemetry** — would require either OpenLLMetry's auto-instrumentation
   or manual span wiring around `propagate()`. Not present today.

## Audit trail

`message_tool.log` plus the per-run JSON dump constitute the "audit trail"
today. There is no signing, no immutability layer, no append-only enforcement
beyond filesystem permissions. See [doc 13](13-governance-and-security.md) for
governance posture.

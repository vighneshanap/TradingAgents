# 16 — Development and Testing

## Layout for development

```
TradingAgents/
├─ tradingagents/         # the package
├─ cli/                   # the Rich-based CLI
├─ tests/                 # pytest suite
├─ scripts/               # smoke scripts
├─ main.py                # programmatic example
├─ test.py                # programmatic smoke
├─ pyproject.toml         # version 0.2.4, deps, entry points, pytest config
├─ uv.lock                # uv lockfile (use `uv` or `pip install .` either way)
└─ assets/                # README screenshots
```

## Install

```bash
git clone https://github.com/TauricResearch/TradingAgents.git
cd TradingAgents
conda create -n tradingagents python=3.13
conda activate tradingagents
pip install .
```

`requires-python = ">=3.10"` per `pyproject.toml`.

## Tests

Run all:
```bash
pytest
```

Run only fast:
```bash
pytest -m unit
```

Pytest config (`pyproject.toml`):
```toml
[tool.pytest.ini_options]
testpaths      = ["tests"]
addopts        = "-ra --strict-markers"
markers        = ["unit", "integration", "smoke"]
filterwarnings = ["ignore::DeprecationWarning"]
```

### Test modules

| File | Focus |
|------|-------|
| [`conftest.py`](../tests/conftest.py) | Pytest fixtures, dummy API key injection so CI doesn't hang on real provider lookups |
| [`test_structured_agents.py`](../tests/test_structured_agents.py) | `ResearchPlan` / `TraderProposal` / `PortfolioDecision` + render functions; structured-output round-trip and free-text fallback |
| [`test_memory_log.py`](../tests/test_memory_log.py) | Append, parse, pending → resolved transition, atomic batch update, rotation |
| [`test_checkpoint_resume.py`](../tests/test_checkpoint_resume.py) | LangGraph checkpoint save → restore round-trip, `clear_checkpoint` |
| [`test_signal_processing.py`](../tests/test_signal_processing.py) | `parse_rating` heuristic over markdown; 5-tier behaviour |
| [`test_model_validation.py`](../tests/test_model_validation.py) | `validators.validate_model` over the model catalog |
| [`test_google_api_key.py`](../tests/test_google_api_key.py) | Google client api_key vs google_api_key kwarg unification |
| [`test_deepseek_reasoning.py`](../tests/test_deepseek_reasoning.py) | DeepSeek thinking-mode round-trip and `deepseek-reasoner` structured-output rejection |
| [`test_ticker_symbol_handling.py`](../tests/test_ticker_symbol_handling.py) | Exchange-suffix preservation across the agent prompts |
| [`test_safe_ticker_component.py`](../tests/test_safe_ticker_component.py) | Path-traversal rejection in `safe_ticker_component` |

### Smoke script

[`scripts/smoke_structured_output.py`](../scripts/smoke_structured_output.py) is
an end-to-end script that exercises the structured-output path against a real
provider — useful as a CI smoke when API keys are present.

## Coding patterns to know

### Lazy provider imports

`llm_clients/factory.py` imports each client module **inside** the branch that
needs it. That keeps the package importable for tests / tooling even when a
specific provider's SDK is missing or its API key is absent.

### Subclassing LangChain ChatModel

`NormalizedChatOpenAI`, `NormalizedChatAnthropic`,
`NormalizedChatGoogleGenerativeAI`, `NormalizedAzureChatOpenAI`,
`DeepSeekChatOpenAI` all subclass the LangChain base class and override
`invoke`/`with_structured_output`/`_get_request_payload`/`_create_chat_result`
*just enough* to fix provider quirks (typed-block content, function-calling
default for OpenAI, DeepSeek `reasoning_content` round-trip).

### Structured-output fallback

Every decision agent uses
[`agents/utils/structured.py`](../tradingagents/agents/utils/structured.py)'s
`bind_structured` + `invoke_structured_or_freetext` pair so a single provider
quirk never blocks the pipeline.

### Idempotent + atomic writes

`TradingMemoryLog` checks for existing pending tags before writing, and uses
temp-file + `os.replace()` for any rewrite. Adopt the same pattern when
adding new persistent log paths.

## Conventions

* Type hints everywhere; runtime validation is via Pydantic only at agent
  output boundaries.
* `from __future__ import annotations` is used in newer modules.
* Indentation is 4 spaces, line length largely free-form (no `black` config
  in repo; PEP 8 informally).
* Logging: `logger = logging.getLogger(__name__)` at module top.

## Common dev tasks

* **Add a new analyst:** create `tradingagents/agents/analysts/<name>_analyst.py`
  exporting `create_<name>_analyst(llm)`, register it in `agents/__init__.py`,
  add tool-node + edges in `graph/setup.py`, add a `should_continue_<name>` in
  `graph/conditional_logic.py`, add an `<name>_report` field to `AgentState`,
  add it to the CLI's analyst checkbox.
* **Add a new LLM provider:** add a `*_client.py` subclassing `BaseLLMClient`,
  add a branch to `factory.create_llm_client`, add to `model_catalog.py`,
  add to `validators.VALID_MODELS` (or skip for "any model accepted"
  providers like Ollama/OpenRouter).
* **Add a new data source:** add a module to `tradingagents/dataflows/`,
  expose category-level methods, register in `interface.py`'s
  `VENDORS` and the `route_to_vendor` chain, add a tool wrapper if needed.

## CHANGELOG

[`CHANGELOG.md`](../CHANGELOG.md) tracks releases. v0.2.4 (current) shipped
structured-output agents, LangGraph checkpoint resume, persistent decision log,
DeepSeek/Qwen/GLM/Azure provider support, the Windows UTF-8 encoding fix, and
ticker-component hardening.

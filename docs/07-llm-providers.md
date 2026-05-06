# 07 — LLM Providers

## Architecture

```
trading_graph.py
    │
    ▼
llm_clients.factory.create_llm_client(provider, model, base_url, **kwargs)
    │
    ├── openai / xai / deepseek / qwen / glm / openrouter / ollama  → OpenAIClient
    ├── anthropic                                                   → AnthropicClient
    ├── google                                                      → GoogleClient
    └── azure                                                       → AzureOpenAIClient
                                                                          │
                                                                          ▼
                                              langchain_openai / langchain_anthropic /
                                              langchain_google_genai
```

* No LiteLLM, no proxy layer. Each provider wraps the vendor's official LangChain
  integration directly.
* `BaseLLMClient` (file: [`base_client.py`](../tradingagents/llm_clients/base_client.py))
  defines `get_llm()` and `validate_model()`.

## Supported providers (10)

| Provider key | Backend | API key env | Default base URL | Notes |
|--------------|---------|-------------|------------------|-------|
| `openai` | OpenAI Responses API (`/v1/responses`) | `OPENAI_API_KEY` | api.openai.com | Uses `use_responses_api=True` so `reasoning_effort` works with tool use across GPT-4.1/GPT-5 |
| `anthropic` | Anthropic Messages API | `ANTHROPIC_API_KEY` | api.anthropic.com | Supports `effort` ("low" / "medium" / "high") |
| `google` | Gemini | `GOOGLE_API_KEY` | generativelanguage.googleapis.com | Maps `thinking_level` ↔ `thinking_budget` for Gemini 2.5 vs 3 |
| `azure` | Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_DEPLOYMENT_NAME` | (per-resource) | Any deployed model name accepted |
| `xai` | Grok (OpenAI-compatible) | `XAI_API_KEY` | https://api.x.ai/v1 | |
| `deepseek` | DeepSeek (OpenAI-compatible) | `DEEPSEEK_API_KEY` | https://api.deepseek.com | Custom subclass for thinking-mode round-trip + structured-output disabling on `deepseek-reasoner` |
| `qwen` | Alibaba DashScope | `DASHSCOPE_API_KEY` | https://dashscope-intl.aliyuncs.com/compatible-mode/v1 | OpenAI-compatible mode |
| `glm` | Zhipu | `ZHIPU_API_KEY` | https://api.z.ai/api/paas/v4/ | OpenAI-compatible mode |
| `openrouter` | OpenRouter | `OPENROUTER_API_KEY` | https://openrouter.ai/api/v1 | Any model accepted; CLI fetches list dynamically |
| `ollama` | Local Ollama daemon | (none, sends `"ollama"` literal) | http://localhost:11434/v1 | Use for offline runs |

The OpenAI-compatible cluster — `openai, xai, deepseek, qwen, glm, ollama,
openrouter` — all share `OpenAIClient` ([`openai_client.py`](../tradingagents/llm_clients/openai_client.py))
with `_PROVIDER_CONFIG` mapping `provider → (default_base_url, env_var)`.

## Model catalog

File: [`tradingagents/llm_clients/model_catalog.py`](../tradingagents/llm_clients/model_catalog.py)

`MODEL_OPTIONS[provider][mode]` returns `(label, model_id)` pairs for the CLI's
quick / deep selector. Notable entries:

* **OpenAI:** `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.4-pro`, `gpt-5.2`, `gpt-4.1`
* **Anthropic:** `claude-opus-4-6`, `claude-opus-4-5`, `claude-sonnet-4-6`, `claude-sonnet-4-5`, `claude-haiku-4-5`
* **Google:** `gemini-3-flash-preview`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
* **xAI:** `grok-4-0709`, `grok-4-1-fast-reasoning`, `grok-4-1-fast-non-reasoning`, `grok-4-fast-reasoning`, `grok-4-fast-non-reasoning`
* **DeepSeek:** `deepseek-v4-pro`, `deepseek-v4-flash`, `deepseek-chat`, `deepseek-reasoner`, plus a `custom` slot
* **Qwen:** `qwen3.6-plus`, `qwen3.5-plus`, `qwen3.5-flash`, `qwen3-max`, `qwen-plus`, `custom`
* **GLM:** `glm-5.1`, `glm-5`, `glm-4.7`, `custom`
* **Ollama:** `qwen3:latest`, `gpt-oss:latest`, `glm-4.7-flash:latest`

`validators.validate_model(provider, model)` accepts anything for `ollama` and
`openrouter`; for the rest it must appear in the catalog (otherwise emits a
`RuntimeWarning` but still proceeds).

## Defaults out of the box

From [`tradingagents/default_config.py`](../tradingagents/default_config.py):

```python
"llm_provider":   "openai"
"deep_think_llm": "gpt-5.4"        # used by Research Manager, Portfolio Manager, Reflector
"quick_think_llm":"gpt-5.4-mini"   # used by analysts, debaters, trader
"backend_url":    None             # let provider client pick its default
```

Switching providers is a single config change — see [doc 11](11-configuration.md).

## Provider-specific quirks

### OpenAI

* Uses **Responses API** (`use_responses_api=True`) by default so `reasoning_effort`
  works alongside function tools across the GPT-4.1 / GPT-5 families.
* `reasoning_effort` ∈ `low | medium | high`, sourced from
  `config["openai_reasoning_effort"]`.

### Anthropic

* Optional `effort` kwarg ∈ `low | medium | high`, sourced from
  `config["anthropic_effort"]`. Maps to extended-thinking depth.

### Google Gemini

* `thinking_level` from config:
  * Gemini 3.x: passed through directly (with Pro silently coercing `minimal → low`).
  * Gemini 2.5: mapped to legacy `thinking_budget` (`-1` for high, `0` for off).

### DeepSeek (custom subclass `DeepSeekChatOpenAI`)

Two quirks the codebase explicitly handles:

1. **Thinking-mode round-trip.** When `deepseek-reasoner` returns a
   `reasoning_content` block, that field must be echoed back on the next turn or
   the API throws HTTP 400. The subclass overrides `_create_chat_result` (capture
   on receive) and `_get_request_payload` (re-attach on send). Tested by
   [`tests/test_deepseek_reasoning.py`](../tests/test_deepseek_reasoning.py).
2. **`deepseek-reasoner` rejects `tool_choice`,** so it cannot do
   structured-output via function calling. The subclass raises `NotImplementedError`,
   which `bind_structured` catches and degrades gracefully to free-text generation.

### Azure OpenAI

* Requires four env vars: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`,
  `AZURE_OPENAI_DEPLOYMENT_NAME`, `OPENAI_API_VERSION`.
* `validate_model` always returns `True` (deployments may have arbitrary names).
* Wired via `langchain_openai.AzureChatOpenAI`.

## Content normalisation

`base_client.normalize_content(response)` collapses provider-returned content
*lists* (e.g. Gemini-3 / OpenAI Responses API typed blocks: `reasoning`, `text`,
…) into a single string by concatenating `text` blocks and dropping the rest.
This is wrapped into every provider's `invoke()`. Reasoning content is
preserved separately on `additional_kwargs["reasoning_content"]` for the
DeepSeek round-trip case.

## What is *not* here

* **No LiteLLM**, OpenLLM, vLLM client, Bedrock client, Cohere, Mistral, AWS,
  GCP Vertex, Together, Fireworks, Groq, Replicate, or any local-inference layer
  beyond Ollama.
* **No prompt caching configuration.** Anthropic prompt caching is not
  configured anywhere in the repo.
* **No custom retry / circuit breaker layer.** Retries fall through to the
  underlying SDK defaults (`max_retries` is forwarded as a kwarg if set).

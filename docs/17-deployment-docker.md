# 17 — Deployment and Docker

## Dockerfile

[`Dockerfile`](../Dockerfile) is a small multi-stage build:

```dockerfile
FROM python:3.12-slim AS builder
ENV PYTHONDONTWRITEBYTECODE=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
WORKDIR /build
COPY . .
RUN pip install --no-cache-dir .

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN useradd --create-home appuser
USER appuser
WORKDIR /home/appuser/app
COPY --from=builder --chown=appuser:appuser /build .
ENTRYPOINT ["tradingagents"]
```

* Python 3.12 slim base.
* Builder + runtime stage; final image carries only the venv and the source.
* Runs as `appuser` (uid created at build).
* `ENTRYPOINT ["tradingagents"]` — the same Typer CLI the local install ships.

## docker-compose.yml

[`docker-compose.yml`](../docker-compose.yml) defines three services:

| Service | Profile | Purpose |
|---------|---------|---------|
| `tradingagents` | default | The CLI, reads `.env`, persistent volume at `/home/appuser/.tradingagents` |
| `ollama` | `ollama` profile | Stock `ollama/ollama:latest`, persistent volume `ollama_data` |
| `tradingagents-ollama` | `ollama` profile | The CLI wired to talk to the `ollama` service via `LLM_PROVIDER=ollama` |

> Note: `LLM_PROVIDER` is set as an environment variable in compose, but the
> framework reads `llm_provider` from `config`. If you intend to default the
> CLI to Ollama via env, you'll need to either pre-populate the questionnaire
> or pass `config["llm_provider"]="ollama"` from a wrapper. The CLI's
> interactive prompt will ask regardless.

### Run

```bash
cp .env.example .env       # fill in API keys
docker compose run --rm tradingagents
```

Local-models flavour:

```bash
docker compose --profile ollama run --rm tradingagents-ollama
```

The `tradingagents_data` named volume persists:
* `/home/appuser/.tradingagents/cache/`  (OHLCV + checkpoint DBs)
* `/home/appuser/.tradingagents/logs/`   (run outputs)
* `/home/appuser/.tradingagents/memory/` (decision log)

## Env files

* [`.env.example`](../.env.example) — provider keys (OpenAI, Google,
  Anthropic, xAI, DeepSeek, DashScope/Qwen, ZhipuGLM, OpenRouter).
* [`.env.enterprise.example`](../.env.enterprise.example) — Azure OpenAI
  variables (`AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`,
  `AZURE_OPENAI_DEPLOYMENT_NAME`, `OPENAI_API_VERSION`).

`load_dotenv()` is called in `main.py` and at CLI startup, so a `.env` file in
the working directory is read automatically.

## Image size

The slim Python 3.12 base + the dependency tree
(`langchain-*`, `langgraph`, `pandas`, `yfinance`, `stockstats`, `rich`,
`typer`, `redis`, `backtrader`, `parsel`) lands the runtime image at the
several-hundred-MB scale. There is no GPU layer or CUDA dep; everything is
pure-Python over HTTP to provider APIs. Backtrader is in the dep tree but
unused at runtime (see [doc 14](14-brokers-execution-ml.md)).

## `.dockerignore`

[`.dockerignore`](../.dockerignore) keeps the build context lean (excludes
typical noise like `.git/`, `__pycache__/`, `.pytest_cache/`, the local cache
under `~/.tradingagents/`).

## Operational notes

* The CLI is interactive — running headless (`docker compose run -d`) won't
  work without scripting the questionnaire. For automation, prefer the
  programmatic `TradingAgentsGraph().propagate(...)` entry inside a custom
  wrapper script.
* The container runs as a non-root user; mounted volumes must be writable by
  uid `appuser` (or use Compose-managed named volumes as the file does).
* No healthcheck is defined; processes are short-lived per-run.
* No Helm chart, no Kubernetes manifests, no Terraform — deployment is
  intentionally minimal.

## Beyond Docker

There is no published Docker image (the README says "build with `docker
compose run`"). PyPI: the package is not present on PyPI as `tradingagents`
under the official org at time of writing — install is `pip install .`
from the repo.

# TradingAgents Web UI

Bloomberg-themed dark terminal frontend for the TradingAgents framework.

## Stack

* **Vite 5** + **React 18** + **TypeScript**
* **Tailwind CSS 3** with `@tailwindcss/typography`
* **TanStack Query** for REST data
* Native **EventSource** for SSE run streaming
* **Recharts** for the α-vs-SPY chart
* **react-markdown** + **remark-gfm** for analyst markdown
* **lucide-react** icons

## Dev

The frontend talks to the FastAPI backend (see `webserver/` at the repo root).

```bash
# 1. Start the backend (in another terminal, from the repo root)
pip install -e .[web]
tradingagents serve --port 8000

# 2. Start the frontend dev server
cd webui
npm install
npm run dev
# → http://localhost:5173 (Vite proxies /api to :8000)
```

## Production build

```bash
cd webui
npm run build
# → produces webui/dist
tradingagents serve --static-dir webui/dist --host 0.0.0.0 --port 8000
# → http://localhost:8000 serves both UI and API
```

## Routes

| Path | Page |
|------|------|
| `/` | Dashboard (latest decisions, in-flight runs, stats) |
| `/runs/new` | New-run wizard |
| `/runs` | All runs (in-memory, refreshes every 2s) |
| `/runs/:id/overview` | Live status board + most-recent output |
| `/runs/:id/analysts` | Tabbed analyst reports |
| `/runs/:id/debate` | Bull/Bear + 3-way risk transcripts |
| `/runs/:id/decision` | PM decision card |
| `/runs/:id/raw` | Full state JSON |
| `/memory` | Decision log (filterable) |
| `/memory/:ticker` | Per-ticker history with α-vs-SPY chart |
| `/settings` | Bearer token, provider key status, default config |

## Theme

The "Bloomberg dark terminal" palette lives in `tailwind.config.ts` and
`src/styles/globals.css`. Change colors there in one place; everything is
built on Tailwind utility classes referencing the design tokens.

"""FastAPI app factory.

Usage:
    from webserver.main import build_app
    app = build_app(static_dir=Path("webui/dist"))
    # then: uvicorn.run(app, ...)
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from webserver.api import router


def build_app(static_dir: Optional[Path] = None) -> FastAPI:
    app = FastAPI(
        title="TradingAgents Web",
        version="0.2.4",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )

    # CORS for local dev — Vite runs on :5173, FastAPI on :8000.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)

    if static_dir is not None:
        static_path = Path(static_dir).resolve()
        if static_path.exists():
            app.mount(
                "/assets",
                StaticFiles(directory=static_path / "assets"),
                name="assets",
            )
            index_html = static_path / "index.html"

            @app.get("/{full_path:path}", include_in_schema=False)
            async def spa_fallback(full_path: str):  # noqa: ARG001 — path captured
                # API routes are handled by the router (registered first)
                return FileResponse(index_html)

    return app


# Default app for `uvicorn webserver.main:app`
app = build_app()

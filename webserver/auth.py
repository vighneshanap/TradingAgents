"""Optional bearer-token auth.

If the env var ``TRADINGAGENTS_WEB_TOKEN`` is set, every request must carry
``Authorization: Bearer <token>``. Otherwise auth is bypassed (single-user
local dev mode).
"""

from __future__ import annotations

import os
from typing import Optional

from fastapi import Header, HTTPException, status


def require_token(authorization: Optional[str] = Header(default=None)) -> None:
    expected = os.environ.get("TRADINGAGENTS_WEB_TOKEN")
    if not expected:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    if authorization.removeprefix("Bearer ").strip() != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid token")

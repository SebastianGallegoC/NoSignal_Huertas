"""Middleware: request id para correlacionar logs y cabeceras útiles (p. ej. CORS / Origin)."""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("nosignal.request")

_EXCLUDED_PATHS = frozenset({"/health", "/favicon.ico"})


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        rid = str(uuid.uuid4())
        request.state.request_id = rid
        path = request.url.path
        origin = request.headers.get("origin") or request.headers.get("Origin") or ""
        referer = (request.headers.get("referer") or "")[:200]

        if path not in _EXCLUDED_PATHS:
            logger.info(
                "http_request_start id=%s method=%s path=%s origin=%r referer_prefix=%r",
                rid,
                request.method,
                path,
                origin,
                referer,
            )

        t0 = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "http_request_unhandled id=%s method=%s path=%s origin=%r",
                rid,
                request.method,
                path,
                origin,
            )
            raise

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        if path not in _EXCLUDED_PATHS:
            acao = response.headers.get("access-control-allow-origin")
            logger.info(
                "http_request_end id=%s method=%s path=%s status=%s elapsed_ms=%.1f "
                "access_control_allow_origin=%r",
                rid,
                request.method,
                path,
                response.status_code,
                elapsed_ms,
                acao,
            )
        return response

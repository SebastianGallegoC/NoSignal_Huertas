import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette import status

from .api.v1.router import api_router
from .core.config import settings
from .core.database import Base, engine


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Crea extensión PostGIS y tablas si no existen (el proyecto no usa Alembic aún)."""
    from .models import FormRecord  # noqa: F401 — registra metadatos en Base

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(Base.metadata.create_all)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.exception_handler(RequestValidationError)
    async def request_validation_exception_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        """422: deja el detalle en logs del servidor (Uvicorn no lo imprime por defecto)."""
        logging.warning("422 validation: %s", jsonable_encoder(exc.errors()))
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": jsonable_encoder(exc.errors())},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, _exc: Exception) -> JSONResponse:
        # Evita respuestas vacías/HTML en errores internos y facilita diagnóstico desde frontend.
        return JSONResponse(status_code=500, content={"detail": "internal_server_error"})

    @app.get("/health", tags=["health"])
    async def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()

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

logger = logging.getLogger(__name__)

_FORMS_FECHA_ACTUALIZACION_SQL = text(
    """
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'forms'
      AND column_name = 'fecha_actualizacion'
    LIMIT 1
    """
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Inicializa requisitos mínimos; migraciones formales se manejan con Alembic."""
    from .models import FormRecord  # noqa: F401 — registra metadatos en Base

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        if settings.auto_create_schema:
            logger.warning(
                "AUTO_CREATE_SCHEMA=true: creando tablas automáticamente. "
                "No usar este modo en producción; ejecutar 'alembic upgrade head'."
            )
            await conn.run_sync(Base.metadata.create_all)
        else:
            chk = await conn.execute(_FORMS_FECHA_ACTUALIZACION_SQL)
            if chk.first() is None:
                logger.error(
                    "Esquema desactualizado: falta la columna public.forms.fecha_actualizacion. "
                    "GET /api/v1/forms/ fallará con 500 hasta aplicar migraciones. "
                    "Ejecutá: docker compose exec backend python -m alembic upgrade head"
                )
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
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        # Evita respuestas vacías/HTML en errores internos y deja traza útil en logs.
        logger.exception(
            "Unhandled exception on %s %s from %s",
            request.method,
            request.url.path,
            request.client.host if request.client else "unknown",
            exc_info=exc,
        )
        return JSONResponse(status_code=500, content={"detail": "internal_server_error"})

    @app.get("/health", tags=["health"])
    async def health() -> dict:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            chk = await conn.execute(_FORMS_FECHA_ACTUALIZACION_SQL)
            schema_forms_ok = chk is not None and chk.first() is not None
        out: dict = {"status": "ok", "db": "ok", "schema_forms_fecha_actualizacion": schema_forms_ok}
        if not schema_forms_ok:
            out["detail"] = "Falta columna forms.fecha_actualizacion — ejecutar alembic upgrade head"
        return out

    return app


app = create_app()

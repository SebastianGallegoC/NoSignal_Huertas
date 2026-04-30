import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_session
from app.repository.forms import get_form_fotos_paths_by_id, list_forms_for_read
from app.schemas.form_payload import FormPayload
from app.schemas.form_read import FormListResponse
from app.services.forms import persist_form
from app.services.storage import media_type_for_image, validated_photo_path

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=FormListResponse)
async def list_forms(
    limit: int = Query(200, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
    _current_user: str = Depends(get_current_user),
):
    """Lista formularios guardados en el servidor (todos los dispositivos que sincronizaron)."""
    items = await list_forms_for_read(session, limit)
    return FormListResponse(items=items)


@router.get("/{form_id}/fotos/{photo_index}")
async def get_form_photo(
    form_id: str,
    photo_index: int,
    session: AsyncSession = Depends(get_session),
    _current_user: str = Depends(get_current_user),
):
    """Sirve un archivo de foto guardado en disco (requiere el mismo token que el resto del API)."""
    if photo_index < 0:
        raise HTTPException(status_code=404, detail="photo_not_found")
    paths = await get_form_fotos_paths_by_id(session, form_id)
    if paths is None:
        raise HTTPException(status_code=404, detail="form_not_found")
    if photo_index >= len(paths):
        raise HTTPException(status_code=404, detail="photo_not_found")
    abs_path = validated_photo_path(paths[photo_index])
    if abs_path is None:
        raise HTTPException(status_code=404, detail="file_missing")
    return FileResponse(
        abs_path,
        media_type=media_type_for_image(abs_path),
        headers={"Cache-Control": "private, max-age=604800"},
    )


@router.post("/")
async def create_form(
    payload: FormPayload,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    session: AsyncSession = Depends(get_session),
    _current_user: str = Depends(get_current_user),
):
    if idempotency_key and idempotency_key != payload.id_formulario:
        raise HTTPException(status_code=409, detail="idempotency_key_mismatch")

    try:
        record = await persist_form(session, payload)
    except ValueError as exc:
        # Errores tras validar el JSON (fotos, fecha_hora, etc.); no pasan por RequestValidationError.
        logger.warning("422 persist_form: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"status": "queued", "id_formulario": record.id_formulario}

import json

from geoalchemy2.functions import ST_AsGeoJSON
from sqlalchemy import cast, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.schema_flags import forms_has_fecha_actualizacion
from app.models.form_record import FormRecord
from app.schemas.form_read import FormReadItem
from app.services.storage import (
    fotos_json_for_api_list,
    normalize_stored_foto_paths,
    safe_delete_stored_photos,
)


async def get_form_by_id(session: AsyncSession, form_id: str) -> FormRecord | None:
    result = await session.execute(select(FormRecord).where(FormRecord.id_formulario == form_id))
    return result.scalars().first()


async def get_form_fotos_paths_by_id(session: AsyncSession, form_id: str) -> list[str] | None:
    """Solo la columna `fotos` (evita cargar GPS, datos_formulario, etc. en cada miniatura)."""
    result = await session.execute(select(FormRecord.fotos).where(FormRecord.id_formulario == form_id))
    raw = result.scalar_one_or_none()
    if raw is None:
        return None
    return normalize_stored_foto_paths(raw)


async def create_form(session: AsyncSession, record: FormRecord) -> FormRecord:
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return record


async def delete_form(session: AsyncSession, form_id: str) -> bool:
    """Borra la fila en BD y luego intenta borrar archivos de foto en disco."""
    record = await get_form_by_id(session, form_id)
    if record is None:
        return False
    paths = normalize_stored_foto_paths(record.fotos)
    await session.delete(record)
    await session.commit()
    safe_delete_stored_photos(paths)
    return True


async def list_forms_for_read(session: AsyncSession, limit: int) -> list[FormReadItem]:
    cols = (
        FormRecord.id_formulario,
        FormRecord.id_usuario,
        FormRecord.fecha_hora,
        FormRecord.datos_formulario,
        FormRecord.fotos,
        cast(ST_AsGeoJSON(FormRecord.gps), String).label("geojson"),
    )
    if forms_has_fecha_actualizacion:
        cols = cols + (FormRecord.fecha_actualizacion,)
    stmt = select(*cols).order_by(FormRecord.fecha_hora.desc()).limit(limit)
    result = await session.execute(stmt)
    items: list[FormReadItem] = []
    for row in result.mappings():
        geo = json.loads(row["geojson"])
        if geo.get("type") != "Point" or not isinstance(geo.get("coordinates"), list):
            continue
        coords = geo["coordinates"]
        if len(coords) < 2:
            continue
        lon, lat = float(coords[0]), float(coords[1])
        fh = row["fecha_hora"]
        fa = row.get("fecha_actualizacion") or fh
        fecha_iso = fh.isoformat() if hasattr(fh, "isoformat") else str(fh)
        fecha_actualizacion_iso = (
            fa.isoformat() if hasattr(fa, "isoformat") else str(fa)
        )
        datos = row["datos_formulario"] if isinstance(row["datos_formulario"], dict) else {}
        fotos_list = fotos_json_for_api_list(row["fotos"])
        items.append(
            FormReadItem(
                id_formulario=row["id_formulario"],
                id_usuario=row["id_usuario"],
                fecha_hora=fecha_iso,
                fecha_actualizacion=fecha_actualizacion_iso,
                latitud=lat,
                longitud=lon,
                precision=None,
                datos_formulario=datos,
                fotos=fotos_list,
            ),
        )
    return items

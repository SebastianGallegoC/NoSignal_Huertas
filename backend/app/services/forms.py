from datetime import datetime

from geoalchemy2 import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.form_record import FormRecord
from app.repository.forms import create_form, get_form_by_id
from app.schemas.form_payload import FormPayload
from app.services.storage import normalize_stored_foto_paths, safe_delete_stored_photos, save_photos


def parse_fecha_hora_iso(value: str) -> datetime:
    """ISO 8601 desde el cliente (p. ej. toISOString() con 'Z'); compatible con Python < 3.11."""
    s = value.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


def resolve_fecha_actualizacion_dt(payload: FormPayload) -> datetime:
    """Última modificación coherente con fecha_hora (primer envío); nunca antes por reloj descoordinado."""
    fecha_envio = parse_fecha_hora_iso(payload.fecha_hora)
    if not payload.fecha_actualizacion:
        return fecha_envio
    cand = parse_fecha_hora_iso(payload.fecha_actualizacion)
    return cand if cand >= fecha_envio else fecha_envio


async def persist_form(session: AsyncSession, payload: FormPayload) -> FormRecord:
    fecha_hora = parse_fecha_hora_iso(payload.fecha_hora)
    fecha_act = resolve_fecha_actualizacion_dt(payload)
    gps_point = WKTElement(f"POINT({payload.gps.longitud} {payload.gps.latitud})", srid=4326)

    existing = await get_form_by_id(session, payload.id_formulario)
    if existing:
        # Reenvío con el mismo id (p. ej. edición desde otro dispositivo): actualizar datos en BD.
        old_paths = normalize_stored_foto_paths(existing.fotos)
        if payload.fotos:
            safe_delete_stored_photos(old_paths)
            new_paths = save_photos(
                payload.id_usuario,
                payload.id_formulario,
                payload.fotos,
                fecha_hora,
            )
            existing.fotos = new_paths
        existing.id_usuario = payload.id_usuario
        existing.fecha_actualizacion = fecha_act
        existing.gps = gps_point
        existing.datos_formulario = dict(payload.datos_formulario)
        await session.commit()
        await session.refresh(existing)
        return existing

    fotos = (
        save_photos(payload.id_usuario, payload.id_formulario, payload.fotos, fecha_hora)
        if payload.fotos
        else []
    )

    record = FormRecord(
        id_formulario=payload.id_formulario,
        id_usuario=payload.id_usuario,
        fecha_hora=fecha_hora,
        fecha_actualizacion=fecha_act,
        gps=gps_point,
        datos_formulario=payload.datos_formulario,
        fotos=fotos,
    )

    return await create_form(session, record)

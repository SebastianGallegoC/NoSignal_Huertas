from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.schemas.form_payload import FormPayload, GPSPayload
from app.services.forms import parse_fecha_hora_iso, persist_form, resolve_fecha_actualizacion_dt


@pytest.mark.asyncio
async def test_persist_form_updates_datos_when_id_exists(monkeypatch):
    existing = SimpleNamespace(
        id_formulario="f-upd",
        id_usuario="u-old",
        fecha_hora=datetime(2026, 1, 1, tzinfo=timezone.utc),
        fecha_actualizacion=datetime(2026, 1, 1, tzinfo=timezone.utc),
        gps=None,
        datos_formulario={"nombres_apellidos_beneficiario": "Viejo"},
        fotos=[],
    )

    async def fake_get(_session, form_id):
        return existing if form_id == "f-upd" else None

    monkeypatch.setattr("app.services.forms.get_form_by_id", fake_get)

    session = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()

    payload = FormPayload(
        id_formulario="f-upd",
        id_usuario="u-new",
        fecha_hora="2026-05-04T12:00:00Z",
        gps=GPSPayload(latitud=1.0, longitud=-2.0, precision=5.0),
        datos_formulario={"nombres_apellidos_beneficiario": "Nuevo"},
        fotos=[],
    )

    result = await persist_form(session, payload)

    assert result is existing
    assert existing.datos_formulario["nombres_apellidos_beneficiario"] == "Nuevo"
    assert existing.id_usuario == "u-new"
    assert existing.fecha_hora == datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert existing.fecha_actualizacion == datetime(2026, 5, 4, 12, tzinfo=timezone.utc)
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once()


def test_resolve_fecha_actualizacion_no_baja_de_fecha_hora():
    p = FormPayload(
        id_formulario="f",
        id_usuario="u",
        fecha_hora="2026-05-04T12:00:00Z",
        fecha_actualizacion="2026-01-01T00:00:00Z",
        gps=GPSPayload(latitud=1.0, longitud=-2.0, precision=5.0),
        datos_formulario={},
        fotos=[],
    )
    assert resolve_fecha_actualizacion_dt(p) == parse_fecha_hora_iso("2026-05-04T12:00:00Z")


@pytest.mark.asyncio
async def test_persist_form_update_usa_fecha_actualizacion_explicita(monkeypatch):
    existing = SimpleNamespace(
        id_formulario="f-upd2",
        id_usuario="u-old",
        fecha_hora=datetime(2026, 1, 1, tzinfo=timezone.utc),
        fecha_actualizacion=datetime(2026, 1, 1, tzinfo=timezone.utc),
        gps=None,
        datos_formulario={},
        fotos=[],
    )

    async def fake_get(_session, form_id):
        return existing if form_id == "f-upd2" else None

    monkeypatch.setattr("app.services.forms.get_form_by_id", fake_get)

    session = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()

    payload = FormPayload(
        id_formulario="f-upd2",
        id_usuario="u-new",
        fecha_hora="2026-01-01T00:00:00Z",
        fecha_actualizacion="2026-08-20T15:30:00Z",
        gps=GPSPayload(latitud=1.0, longitud=-2.0, precision=5.0),
        datos_formulario={"k": "v"},
        fotos=[],
    )

    await persist_form(session, payload)

    assert existing.fecha_hora == datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert existing.fecha_actualizacion == datetime(2026, 8, 20, 15, 30, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_persist_form_creates_new_when_id_not_found(monkeypatch):
    """Si no existe fila con ese id, se delega en create_form (alta nueva)."""

    async def fake_get(_session, _form_id):
        return None

    monkeypatch.setattr("app.services.forms.get_form_by_id", fake_get)

    created: list = []

    async def fake_create(_session, record):
        created.append(record)
        return record

    monkeypatch.setattr("app.services.forms.create_form", fake_create)

    session = AsyncMock()
    payload = FormPayload(
        id_formulario="f-nuevo",
        id_usuario="u-nuevo",
        fecha_hora="2026-06-01T10:00:00Z",
        gps=GPSPayload(latitud=4.5, longitud=-74.1, precision=8.0),
        datos_formulario={"entidad_aportante": "ACME"},
        fotos=[],
    )

    result = await persist_form(session, payload)

    assert len(created) == 1
    assert result is created[0]
    rec = created[0]
    assert rec.id_formulario == "f-nuevo"
    assert rec.id_usuario == "u-nuevo"
    assert rec.datos_formulario == {"entidad_aportante": "ACME"}
    assert rec.fotos == []

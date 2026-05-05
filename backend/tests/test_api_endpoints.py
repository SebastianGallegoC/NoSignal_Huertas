from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.database import get_session
from app.main import app
from app.schemas.form_payload import MAX_GPS_ACCURACY_METERS


class _DummyResult:
    def first(self):
        return (1,)


class _DummyConn:
    async def execute(self, _statement):
        return _DummyResult()


class _DummyConnectCtx:
    async def __aenter__(self):
        return _DummyConn()

    async def __aexit__(self, exc_type, exc, tb):
        return False


async def _fake_session():
    yield object()


async def _fake_user():
    return "tester"


def test_login_ok_and_invalid_credentials(monkeypatch):
    from app.core import config as cfg

    monkeypatch.setattr(cfg.settings, "auth_users_json", '{"demo":"demo"}')
    client = TestClient(app)
    ok = client.post("/api/v1/auth/login", json={"username": "demo", "password": "demo"})
    assert ok.status_code == 200
    body = ok.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]

    bad = client.post("/api/v1/auth/login", json={"username": "demo", "password": "wrong"})
    assert bad.status_code == 401
    assert bad.json()["detail"] == "invalid_credentials"


def test_health_returns_ok(monkeypatch):
    from app import main as main_mod

    class _DummyEngine:
        @staticmethod
        def connect():
            return _DummyConnectCtx()

    monkeypatch.setattr(main_mod, "engine", _DummyEngine())
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["db"] == "ok"
    assert body.get("schema_forms_fecha_actualizacion") is True


def test_create_form_returns_queued(monkeypatch):
    from app.api.v1 import forms as forms_mod

    app.dependency_overrides[get_session] = _fake_session
    app.dependency_overrides[get_current_user] = _fake_user

    async def fake_persist_form(_session, payload):
        return SimpleNamespace(id_formulario=payload.id_formulario)

    monkeypatch.setattr(forms_mod, "persist_form", fake_persist_form)
    client = TestClient(app)
    payload = {
        "id_formulario": "f-123",
        "id_usuario": "u-1",
        "fecha_hora": "2026-05-04T12:00:00Z",
        "gps": {"latitud": 1.123, "longitud": -76.55, "precision": float(MAX_GPS_ACCURACY_METERS)},
        "datos_formulario": {"entidad_aportante": "X"},
        "fotos": [],
    }
    resp = client.post("/api/v1/forms/", json=payload)
    assert resp.status_code == 200
    assert resp.json() == {"status": "queued", "id_formulario": "f-123"}
    app.dependency_overrides.clear()


def test_get_form_photo_returns_binary(monkeypatch, tmp_path: Path):
    from app.api.v1 import forms as forms_mod

    app.dependency_overrides[get_session] = _fake_session
    app.dependency_overrides[get_current_user] = _fake_user

    image_path = tmp_path / "foto_1.jpg"
    image_path.write_bytes(b"fake-jpeg-binary")

    async def fake_get_paths(_session, _form_id):
        return ["uploads/2026/05/04/u1/f1/foto_1.jpg"]

    monkeypatch.setattr(forms_mod, "get_form_fotos_paths_by_id", fake_get_paths)
    monkeypatch.setattr(forms_mod, "validated_photo_path", lambda _stored: image_path)
    client = TestClient(app)
    resp = client.get("/api/v1/forms/f1/fotos/0")
    assert resp.status_code == 200
    assert resp.content == b"fake-jpeg-binary"
    assert resp.headers.get("cache-control") == "private, max-age=604800"
    app.dependency_overrides.clear()


def test_delete_form_not_found(monkeypatch):
    from app.api.v1 import forms as forms_mod

    app.dependency_overrides[get_session] = _fake_session
    app.dependency_overrides[get_current_user] = _fake_user

    async def fake_delete(_session, _form_id):
        return False

    monkeypatch.setattr(forms_mod, "delete_form", fake_delete)
    client = TestClient(app)
    resp = client.delete("/api/v1/forms/no-existe")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "form_not_found"
    app.dependency_overrides.clear()


def test_delete_form_returns_204(monkeypatch):
    from app.api.v1 import forms as forms_mod

    app.dependency_overrides[get_session] = _fake_session
    app.dependency_overrides[get_current_user] = _fake_user

    async def fake_delete(_session, form_id):
        return form_id == "f-del"

    monkeypatch.setattr(forms_mod, "delete_form", fake_delete)
    client = TestClient(app)
    resp = client.delete("/api/v1/forms/f-del")
    assert resp.status_code == 204
    assert resp.content == b""
    app.dependency_overrides.clear()

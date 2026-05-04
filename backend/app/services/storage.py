import base64
import json
import logging
import os
from datetime import datetime
from io import BytesIO
from pathlib import Path

from PIL import Image

from app.core.config import settings
from app.schemas.form_payload import PhotoPayload

logger = logging.getLogger(__name__)


def normalize_stored_foto_paths(raw: object) -> list[str]:
    """Convierte el JSON de `forms.fotos` en lista de rutas (str). Acepta list o string JSON."""
    if raw is None:
        return []
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return []
    if not isinstance(raw, list):
        return []
    return [str(p) for p in raw if p]


def validated_photo_path(stored: str) -> Path | None:
    """Ruta absoluta del archivo si existe y queda bajo `upload_root`; si no, None.

    Las rutas en BD vienen de `save_photos` como relativas al cwd (p. ej. `uploads/2026/…/foto_1.jpg`).
    No usar `(upload_root_resuelto / ruta)` en ese caso: duplicaría `uploads` (`…/uploads/uploads/…`).
    """
    try:
        root = Path(settings.upload_root).resolve()
    except OSError:
        return None
    s = stored.strip()
    if not s:
        return None
    try:
        p = Path(s)
        if p.is_absolute():
            candidate = p.resolve()
        else:
            candidate = (Path.cwd() / p).resolve()
    except OSError:
        return None
    try:
        candidate.relative_to(root)
    except ValueError:
        if p.is_absolute():
            return None
        try:
            candidate = (root / p).resolve()
            candidate.relative_to(root)
        except (ValueError, OSError):
            return None
    if not candidate.is_file():
        return None
    return candidate


def safe_delete_stored_photos(paths: list[str]) -> None:
    """Elimina archivos de foto bajo `upload_root` (silencia errores puntuales)."""
    for stored in paths:
        p = validated_photo_path(stored)
        if p is None:
            continue
        try:
            p.unlink()
        except OSError as exc:
            logger.warning("No se pudo borrar archivo de foto %s: %s", p, exc)


def media_type_for_image(path: Path) -> str:
    suf = path.suffix.lower()
    if suf == ".webp":
        return "image/webp"
    return "image/jpeg"


def save_photos(id_usuario: str, id_formulario: str, fotos: list[PhotoPayload], fecha_hora: datetime) -> list[str]:
    date_path = fecha_hora.strftime("%Y/%m/%d")
    base_path = os.path.join(settings.upload_root, date_path, id_usuario, id_formulario)
    os.makedirs(base_path, exist_ok=True)

    saved_files: list[str] = []
    for idx, foto in enumerate(fotos, start=1):
        header, _, data = foto.data.partition("base64,")
        if not data:
            raise ValueError("invalid_photo_payload")

        raw = base64.b64decode(data)
        image = Image.open(BytesIO(raw))
        image.verify()

        extension = "webp" if "webp" in header else "jpg"
        filename = f"foto_{idx}.{extension}"
        file_path = os.path.join(base_path, filename)

        with open(file_path, "wb") as handler:
            handler.write(raw)

        saved_files.append(file_path)

    return saved_files

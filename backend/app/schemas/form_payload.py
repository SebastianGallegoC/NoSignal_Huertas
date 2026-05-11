import re
from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.gps_limits import load_gps_limits

MAX_GPS_ACCURACY_METERS = float(load_gps_limits()["maxGpsAccuracyMeters"])
class GPSPayload(BaseModel):
    latitud: float
    longitud: float
    precision: float = Field(gt=0)

    @field_validator("precision")
    @classmethod
    def validate_precision(cls, value: float) -> float:
        if value > MAX_GPS_ACCURACY_METERS:
            raise ValueError("gps_precision_exceeded")
        return value


class PhotoPayload(BaseModel):
    nombre_archivo: str
    data: str
    visita: Literal[1, 2, 3] | None = None

    @field_validator("data")
    @classmethod
    def validate_data(cls, value: str) -> str:
        """Acepta data URL estándar (cualquier casing) o JPEG en base64 plano sin prefijo."""
        if not isinstance(value, str):
            raise ValueError("invalid_image_payload")
        v = value.strip()
        if re.match(r"(?i)^data:image/", v):
            return v
        compact = "".join(v.split())
        if len(compact) >= 64 and re.fullmatch(r"[A-Za-z0-9+/=]+", compact):
            return f"data:image/jpeg;base64,{compact}"
        raise ValueError("invalid_image_payload")


class FormPayload(BaseModel):
    id_formulario: str
    id_usuario: str = Field(default="sin_usuario", max_length=64)
    fecha_hora: str = Field(
        ...,
        description="Momento del primer registro / envío inicial (en actualizaciones debe conservarse).",
    )
    fecha_actualizacion: str | None = Field(
        default=None,
        description="ISO 8601 del último guardado; si falta se usa fecha_hora (compat. clientes viejos).",
    )
    gps: GPSPayload
    datos_formulario: Dict[str, Any] = Field(default_factory=dict)
    fotos: List[PhotoPayload] = Field(default_factory=list)

    @field_validator("fecha_actualizacion", mode="before")
    @classmethod
    def blank_fecha_actualizacion_to_none(cls, value: object) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            s = value.strip()
            return s if s else None
        return None

    @field_validator("id_usuario")
    @classmethod
    def validate_id_usuario(cls, value: str) -> str:
        """Nombres legibles (espacios, Unicode); se excluyen solo caracteres peligrosos para rutas."""
        v = value.strip() if value is not None else ""
        if not v:
            return "sin_usuario"
        forbidden = '\\/\0<>:"|?*'
        if any(c in forbidden for c in v):
            raise ValueError("invalid_id_usuario")
        if v in (".", ".."):
            raise ValueError("invalid_id_usuario")
        return v

    @field_validator("fotos")
    @classmethod
    def validate_fotos_count(cls, value: List[PhotoPayload]) -> List[PhotoPayload]:
        if len(value) > 15:
            raise ValueError("photos_out_of_range")
        return value


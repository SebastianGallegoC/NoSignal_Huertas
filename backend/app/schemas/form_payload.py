import re
from typing import Any, Dict, List

from pydantic import BaseModel, Field, field_validator

MAX_GPS_ACCURACY_METERS = 5
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
    id_usuario: str = Field(min_length=1, max_length=64)
    fecha_hora: str
    gps: GPSPayload
    datos_formulario: Dict[str, Any]
    fotos: List[PhotoPayload]

    @field_validator("id_usuario")
    @classmethod
    def validate_id_usuario(cls, value: str) -> str:
        """Nombres legibles (espacios, Unicode); se excluyen solo caracteres peligrosos para rutas."""
        v = value.strip()
        if not v:
            raise ValueError("invalid_id_usuario")
        forbidden = '\\/\0<>:"|?*'
        if any(c in forbidden for c in v):
            raise ValueError("invalid_id_usuario")
        if v in (".", ".."):
            raise ValueError("invalid_id_usuario")
        return v


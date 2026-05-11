"""Carga única de límites GPS compartidos con el frontend (`config/gps-limits.json`)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


def gps_limits_file_path() -> Path:
    here = Path(__file__).resolve()
    for base in here.parents:
        candidate = base / "config" / "gps-limits.json"
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(
        "No se encontró config/gps-limits.json; debe existir en la raíz del repositorio "
        "o en WORKDIR del contenedor (p. ej. /app/config/).",
    )


@lru_cache(maxsize=1)
def load_gps_limits() -> dict[str, Any]:
    path = gps_limits_file_path()
    with path.open(encoding="utf-8") as f:
        return json.load(f)

import json

import pytest
from pydantic import ValidationError

from app.schemas.form_payload import MAX_GPS_ACCURACY_METERS, GPSPayload
from app.schemas.gps_limits import gps_limits_file_path, load_gps_limits


def test_gps_limits_json_matches_form_payload_constant() -> None:
    path = gps_limits_file_path()
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert float(raw["maxGpsAccuracyMeters"]) == MAX_GPS_ACCURACY_METERS
    assert load_gps_limits()["maxGpsAccuracyMeters"] == raw["maxGpsAccuracyMeters"]


def test_gps_payload_rejects_precision_above_config() -> None:
    bad = MAX_GPS_ACCURACY_METERS + 1.0
    with pytest.raises(ValidationError) as exc:
        GPSPayload(latitud=4.5, longitud=-74.1, precision=bad)
    assert "gps_precision_exceeded" in str(exc.value)


def test_gps_payload_accepts_precision_at_limit() -> None:
    p = GPSPayload(
        latitud=4.5,
        longitud=-74.1,
        precision=float(MAX_GPS_ACCURACY_METERS),
    )
    assert p.precision == MAX_GPS_ACCURACY_METERS


def test_config_file_is_repo_root_config() -> None:
    path = gps_limits_file_path()
    assert path.name == "gps-limits.json"
    assert path.parent.name == "config"
    assert "gps-limits.json" in str(path)

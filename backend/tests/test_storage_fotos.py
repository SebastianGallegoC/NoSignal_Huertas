from __future__ import annotations

from app.services.storage import fotos_json_for_api_list


def test_fotos_json_for_api_list_includes_visita_4():
    raw = [
        {"path": "uploads/2026/05/19/f1/foto_1.jpg", "visita": 4},
        {"path": "uploads/2026/05/19/f1/foto_2.jpg", "visita": 1},
        "uploads/legacy/foto_3.jpg",
    ]
    assert fotos_json_for_api_list(raw) == [
        {"path": "uploads/2026/05/19/f1/foto_1.jpg", "visita": 4},
        {"path": "uploads/2026/05/19/f1/foto_2.jpg", "visita": 1},
        "uploads/legacy/foto_3.jpg",
    ]

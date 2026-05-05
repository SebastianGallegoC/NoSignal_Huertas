"""Estado de esquema detectado al arranque (p. ej. columnas faltantes hasta correr Alembic)."""

forms_has_fecha_actualizacion: bool = True


def set_forms_has_fecha_actualizacion(value: bool) -> None:
    global forms_has_fecha_actualizacion
    forms_has_fecha_actualizacion = value

"""initial forms table

Revision ID: 20260504_0001
Revises:
Create Date: 2026-05-04 16:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision = "20260504_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table(
        "forms",
        sa.Column("id_formulario", sa.String(), nullable=False),
        sa.Column("id_usuario", sa.String(), nullable=False),
        sa.Column("fecha_hora", sa.DateTime(timezone=True), nullable=False),
        sa.Column("gps", Geometry(geometry_type="POINT", srid=4326), nullable=False),
        sa.Column("datos_formulario", sa.JSON(), nullable=False),
        sa.Column("fotos", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id_formulario"),
    )
    op.create_index(op.f("ix_forms_id_formulario"), "forms", ["id_formulario"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_forms_id_formulario"), table_name="forms")
    op.drop_table("forms")

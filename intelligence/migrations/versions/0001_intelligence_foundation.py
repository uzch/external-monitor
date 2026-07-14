"""Create the autonomous intelligence foundation.

Revision ID: 0001_intelligence_foundation
Revises:
Create Date: 2026-07-14
"""

from alembic import op
from sqlalchemy import text

from connected_monitor_intelligence.models import Base

revision = "0001_intelligence_foundation"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())

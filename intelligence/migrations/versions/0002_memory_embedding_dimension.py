"""Align vector memory with the pinned local embedding model.

Revision ID: 0002_memory_embedding_dimension
Revises: 0001_intelligence_foundation
Create Date: 2026-07-14
"""
from alembic import op

revision = "0002_memory_embedding_dimension"
down_revision = "0001_intelligence_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE intelligence_memory_items ALTER COLUMN embedding TYPE vector(384) USING embedding::vector(384)"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE intelligence_memory_items ALTER COLUMN embedding TYPE vector(1024) USING embedding::vector(1024)"
    )

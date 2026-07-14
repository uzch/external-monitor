"""Add immutable seller feedback revisions.

Revision ID: 0003_versioned_feedback
Revises: 0002_memory_embedding_dimension
Create Date: 2026-07-14
"""

import sqlalchemy as sa
from alembic import op

revision = "0003_versioned_feedback"
down_revision = "0002_memory_embedding_dimension"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("intelligence_feedback_revisions"):
        return
    op.create_table(
        "intelligence_feedback_revisions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("signal_id", sa.String(length=36), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("verdict", sa.String(length=32), nullable=False),
        sa.Column("reasons", sa.JSON(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["run_id"], ["intelligence_research_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["signal_id"], ["intelligence_signals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("signal_id", "revision", name="uq_feedback_revision_signal_revision"),
    )
    op.create_index("ix_feedback_revisions_signal", "intelligence_feedback_revisions", ["signal_id"])
    op.create_index("ix_feedback_revisions_current", "intelligence_feedback_revisions", ["is_current"])
    op.create_index(
        "uq_feedback_revision_current_signal",
        "intelligence_feedback_revisions",
        ["signal_id"],
        unique=True,
        postgresql_where=sa.text("is_current = true"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    if sa.inspect(bind).has_table("intelligence_feedback_revisions"):
        op.drop_table("intelligence_feedback_revisions")

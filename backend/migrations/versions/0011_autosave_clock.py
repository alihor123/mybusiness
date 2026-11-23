"""Track client draft clocks for stale autosave protection."""

import sqlalchemy as sa
from alembic import op

revision = "0011_autosave_clock"
down_revision = "0010_idea_lesson_media"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("diagnostics", sa.Column("saved_at_ms", sa.BigInteger(), nullable=True))
    op.add_column("learning_drafts", sa.Column("saved_at_ms", sa.BigInteger(), nullable=True))
    op.add_column("projects", sa.Column("saved_at_ms", sa.BigInteger(), nullable=True))
    op.add_column("accompaniment_task_drafts", sa.Column("saved_at_ms", sa.BigInteger(), nullable=True))
    op.add_column("accompaniment_task_drafts", sa.Column("file_saved_at_ms", sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column("accompaniment_task_drafts", "file_saved_at_ms")
    op.drop_column("accompaniment_task_drafts", "saved_at_ms")
    op.drop_column("projects", "saved_at_ms")
    op.drop_column("learning_drafts", "saved_at_ms")
    op.drop_column("diagnostics", "saved_at_ms")

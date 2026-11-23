"""Persist diagnostic retries and monotonic diagnostic waivers."""

import sqlalchemy as sa
from alembic import op

revision = "0009_diagnostic_jobs"
down_revision = "0008_email_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "diagnostics",
        sa.Column("check_unavailable", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.create_index("ix_diagnostics_pending_check", "diagnostics", ["status", "check_deadline"])
    op.create_table(
        "diagnostic_credits",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("step_id", sa.String(length=64), nullable=False),
        sa.Column("diagnostic_version", sa.Integer(), nullable=False),
        sa.Column("credited_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["step_id"], ["learning_steps.id"]),
        sa.PrimaryKeyConstraint("user_id", "step_id"),
    )
    # Сохраняет уже выданные по старой диагностике освобождения от упражнений.
    op.execute(
        sa.text(
            """
            INSERT INTO diagnostic_credits (user_id, step_id, diagnostic_version, credited_at)
            SELECT d.user_id, s.id, d.version, now()
            FROM diagnostics d
            JOIN learning_steps s ON s.optional_rank IS NOT NULL
            WHERE d.status = 'completed'
              AND s.track_id IN (SELECT key FROM jsonb_each(d.scores))
              AND s.optional_rank <= GREATEST(COALESCE((d.scores ->> s.track_id)::integer, 0) - 1, 0)
            ON CONFLICT (user_id, step_id) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_diagnostics_pending_check", table_name="diagnostics")
    op.drop_table("diagnostic_credits")
    op.drop_column("diagnostics", "check_unavailable")

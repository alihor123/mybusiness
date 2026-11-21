"""Create diagnostic and learning tables"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_learning"
down_revision = "0002_roles"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "tracks",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("cover_url", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("position"),
    )
    op.create_table(
        "diagnostic_questions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("track_id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("prompt", sa.String(), nullable=False),
        sa.Column(
            "options", postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "answer_key", postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "criteria", postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True
        ),
        sa.ForeignKeyConstraint(
            ["track_id"],
            ["tracks.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version", "position"),
    )
    op.create_table(
        "learning_steps",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("track_id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("blocks", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("prompt", sa.String(), nullable=True),
        sa.Column(
            "options", postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "answer_key", postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "criteria", postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True
        ),
        sa.Column("optional_rank", sa.Integer(), nullable=True),
        sa.CheckConstraint("(position = 10) = (type = 'final')", name="ck_step_final_position"),
        sa.CheckConstraint(
            "optional_rank IS NULL OR (optional_rank IN (1,2) AND type IN ('choice','matching','written'))",
            name="ck_step_optional_exercise",
        ),
        sa.ForeignKeyConstraint(
            ["track_id"],
            ["tracks.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("track_id", "optional_rank"),
        sa.UniqueConstraint("track_id", "position"),
    )
    op.create_index(
        op.f("ix_learning_steps_track_id"), "learning_steps", ["track_id"], unique=False
    )
    op.create_table(
        "diagnostics",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("current_question_id", sa.String(length=64), nullable=True),
        sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "scores", postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True
        ),
        sa.Column("check_id", sa.Uuid(), nullable=True),
        sa.Column("check_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('in_progress','skipped','checking','completed')",
            name="ck_diagnostic_status",
        ),
        sa.ForeignKeyConstraint(
            ["current_question_id"],
            ["diagnostic_questions.id"],
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "first_project_drafts",
        sa.Column("completion_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("prefill", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("completion_id"),
        sa.UniqueConstraint("project_id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_table(
        "learning_attempts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("step_id", sa.String(length=64), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("request_key", sa.String(length=128), nullable=False),
        sa.Column("answer", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("remarks", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("check_id", sa.Uuid(), nullable=True),
        sa.Column("check_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("prefill_status", sa.String(length=16), nullable=True),
        sa.Column(
            "project_prefill",
            postgresql.JSONB(none_as_null=True, astext_type=sa.Text()),
            nullable=True,
        ),
        sa.CheckConstraint(
            "prefill_status IS NULL OR prefill_status IN ('checking','succeeded','failed')",
            name="ck_learning_prefill_status",
        ),
        sa.CheckConstraint(
            "status IN ('checking','check_unavailable','accepted','rejected')",
            name="ck_learning_attempt_status",
        ),
        sa.ForeignKeyConstraint(
            ["step_id"],
            ["learning_steps.id"],
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "step_id", "number"),
        sa.UniqueConstraint("user_id", "step_id", "request_key"),
    )
    op.create_table(
        "learning_completions",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("first_project_id", sa.Uuid(), nullable=False),
        sa.Column("project_prefill", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("id"),
    )
    op.create_table(
        "learning_drafts",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("step_id", sa.String(length=64), nullable=False),
        sa.Column("answer", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(
            ["step_id"],
            ["learning_steps.id"],
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "step_id"),
    )
    op.create_table(
        "learning_positions",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("track_id", sa.String(length=64), nullable=False),
        sa.Column("step_id", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(
            ["step_id"],
            ["learning_steps.id"],
        ),
        sa.ForeignKeyConstraint(
            ["track_id"],
            ["tracks.id"],
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "track_id"),
    )
    op.create_table(
        "learning_credits",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("step_id", sa.String(length=64), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=True),
        sa.Column("credited_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["attempt_id"],
            ["learning_attempts.id"],
        ),
        sa.ForeignKeyConstraint(
            ["step_id"],
            ["learning_steps.id"],
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "step_id"),
    )


def downgrade():
    op.drop_table("learning_credits")
    op.drop_table("learning_positions")
    op.drop_table("learning_drafts")
    op.drop_table("learning_completions")
    op.drop_table("learning_attempts")
    op.drop_table("first_project_drafts")
    op.drop_table("diagnostics")
    op.drop_index(op.f("ix_learning_steps_track_id"), table_name="learning_steps")
    op.drop_table("learning_steps")
    op.drop_table("diagnostic_questions")
    op.drop_table("tracks")

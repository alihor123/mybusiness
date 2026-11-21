"""Create mentor and public event catalogs."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005_catalogs"
down_revision = "0004_content"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "mentors",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("stable_key", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("headline", sa.String(length=300), nullable=False),
        sa.Column("about", sa.String(), nullable=False),
        sa.Column("experience_label", sa.String(length=100), nullable=False),
        sa.Column("experience_anchor_year", sa.Integer(), nullable=False),
        sa.Column("industry_codes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("project_stage_codes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("help_topics", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("meeting_format", sa.String(length=32), nullable=False),
        sa.Column("bio_sources", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("portrait_url", sa.String(length=500), nullable=False),
        sa.Column("contacts", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.Column("accepts_demo_applications", sa.Boolean(), nullable=False),
        sa.Column("showcase_login", sa.Boolean(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stable_key"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_mentors_stable_key", "mentors", ["stable_key"], unique=False)
    op.create_index("ix_mentors_active", "mentors", ["active"], unique=False)
    op.create_table(
        "events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("stable_key", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("location", sa.String(length=300), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stable_key"),
    )
    op.create_index("ix_events_stable_key", "events", ["stable_key"], unique=False)
    op.create_index("ix_events_starts_at", "events", ["starts_at"], unique=False)
    op.create_index("ix_events_active", "events", ["active"], unique=False)


def downgrade():
    op.drop_index("ix_events_active", table_name="events")
    op.drop_index("ix_events_starts_at", table_name="events")
    op.drop_index("ix_events_stable_key", table_name="events")
    op.drop_table("events")
    op.drop_index("ix_mentors_active", table_name="mentors")
    op.drop_index("ix_mentors_stable_key", table_name="mentors")
    op.drop_table("mentors")

"""Add a dedicated demo identity marker."""

import sqlalchemy as sa
from alembic import op

revision = "0018_demo_auth_profile"
down_revision = "0017_video_summaries"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_demo", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.create_index(
        "uq_users_demo", "users", ["is_demo"], unique=True, postgresql_where=sa.text("is_demo")
    )


def downgrade() -> None:
    op.drop_index("uq_users_demo", table_name="users")
    op.drop_column("users", "is_demo")

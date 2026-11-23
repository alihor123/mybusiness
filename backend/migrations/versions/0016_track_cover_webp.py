"""Serve optimized WebP images for learning track covers."""

import sqlalchemy as sa
from alembic import op

revision = "0016_track_cover_webp"
down_revision = "0015_move_mom_test_to_mvp"
branch_labels = None
depends_on = None

COVERS = {
    "idea-validation": ("/media/tracks/idea-validation.png", "/media/tracks/idea-validation.webp"),
    "mvp-launch": ("/media/tracks/mvp-launch.png", "/media/tracks/mvp-launch.webp"),
    "first-sales": ("/media/tracks/first-sales.png", "/media/tracks/first-sales.webp"),
}


def set_covers(index: int) -> None:
    table = sa.table(
        "tracks",
        sa.column("id", sa.String()),
        sa.column("cover_url", sa.String()),
    )
    bind = op.get_bind()
    for track_id, urls in COVERS.items():
        bind.execute(
            table.update().where(table.c.id == track_id).values(cover_url=urls[index])
        )


def upgrade() -> None:
    set_covers(1)


def downgrade() -> None:
    set_covers(0)

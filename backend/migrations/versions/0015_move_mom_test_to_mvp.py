"""Move the Mom Test video to the MVP pilot lesson."""

import json
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0015_move_mom_test_to_mvp"
down_revision = "0014_notebook_lesson_videos"
branch_labels = None
depends_on = None

SEED = Path(__file__).resolve().parents[1] / "seed_data"
PREVIOUS = SEED / "lessons_before_0015.json"


def apply_lessons(lessons: dict) -> None:
    table = sa.table(
        "learning_steps",
        sa.column("id", sa.String()),
        sa.column("title", sa.String()),
        sa.column("blocks", JSONB()),
    )
    bind = op.get_bind()
    for step_id, lesson in lessons.items():
        bind.execute(table.update().where(table.c.id == step_id).values(**lesson))


def upgrade() -> None:
    content = json.loads((SEED / "tracks.json").read_text(encoding="utf-8"))
    previous = json.loads(PREVIOUS.read_text(encoding="utf-8"))
    updated = {
        step["id"]: {"title": step["title"], "blocks": step["blocks"]}
        for track in content["tracks"]
        for step in track["steps"]
        if step["id"] in previous
    }
    apply_lessons(updated)


def downgrade() -> None:
    apply_lessons(json.loads(PREVIOUS.read_text(encoding="utf-8")))

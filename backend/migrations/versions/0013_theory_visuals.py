"""Refresh the nine theory lessons with case-led content and illustrations."""

import json
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0013_theory_visuals"
down_revision = "0012_lesson_case_content"
branch_labels = None
depends_on = None

SEED = Path(__file__).resolve().parents[1] / "seed_data"
PREVIOUS = SEED / "theory_before_0013.json"


def previous_blocks() -> dict:
    return json.loads(PREVIOUS.read_text(encoding="utf-8"))


def apply_blocks(rows: dict) -> None:
    table = sa.table(
        "learning_steps",
        sa.column("id", sa.String()),
        sa.column("blocks", JSONB()),
    )
    bind = op.get_bind()
    for step_id, blocks in rows.items():
        bind.execute(
            table.update().where(table.c.id == step_id).values(blocks=blocks)
        )


def upgrade() -> None:
    content = json.loads((SEED / "tracks.json").read_text(encoding="utf-8"))
    previous = previous_blocks()
    rows = {
        step["id"]: step["blocks"]
        for track in content["tracks"]
        for step in track["steps"]
        if step["id"] in previous
    }
    apply_blocks(rows)


def downgrade() -> None:
    apply_blocks(previous_blocks())

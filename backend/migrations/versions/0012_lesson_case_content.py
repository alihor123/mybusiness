"""Refresh applied lesson and diagnostic task wording."""

import json
from pathlib import Path

import sqlalchemy as sa
from alembic import op

revision = "0012_lesson_case_content"
down_revision = "0011_autosave_clock"
branch_labels = None
depends_on = None

SEED = Path(__file__).resolve().parents[1] / "seed_data"


def upgrade() -> None:
    bind = op.get_bind()
    steps = sa.table(
        "learning_steps",
        sa.column("id", sa.String()),
        sa.column("prompt", sa.String()),
    )
    tracks = json.loads((SEED / "tracks.json").read_text(encoding="utf-8"))
    for track in tracks["tracks"]:
        for step in track["steps"]:
            if step.get("prompt"):
                bind.execute(
                    steps.update().where(steps.c.id == step["id"]).values(prompt=step["prompt"])
                )

    questions = sa.table(
        "diagnostic_questions",
        sa.column("id", sa.String()),
        sa.column("prompt", sa.String()),
    )
    diagnostic = json.loads((SEED / "diagnostic.json").read_text(encoding="utf-8"))
    for question in diagnostic["questions"]:
        if question["type"] == "free":
            bind.execute(
                questions.update()
                .where(questions.c.id == question["id"])
                .values(prompt=question["prompt"])
            )


def downgrade() -> None:
    # Content-only migration: prior wording is retained in the preceding release.
    pass

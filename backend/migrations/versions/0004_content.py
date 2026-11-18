"""Load the pinned diagnostic and learning content."""

import json
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0004_content"
down_revision = "0003_learning"
branch_labels = None
depends_on = None

SEED = Path(__file__).resolve().parents[1] / "seed_data"


def load(name):
    return json.loads((SEED / name).read_text(encoding="utf-8"))


tracks = sa.table(
    "tracks",
    sa.column("id", sa.String()),
    sa.column("position", sa.Integer()),
    sa.column("title", sa.String()),
    sa.column("description", sa.String()),
    sa.column("cover_url", sa.String()),
)
steps = sa.table(
    "learning_steps",
    sa.column("id", sa.String()),
    sa.column("track_id", sa.String()),
    sa.column("position", sa.Integer()),
    sa.column("title", sa.String()),
    sa.column("type", sa.String()),
    sa.column("blocks", JSONB()),
    sa.column("prompt", sa.String()),
    sa.column("options", JSONB(none_as_null=True)),
    sa.column("answer_key", JSONB(none_as_null=True)),
    sa.column("criteria", JSONB(none_as_null=True)),
    sa.column("optional_rank", sa.Integer()),
)
questions = sa.table(
    "diagnostic_questions",
    sa.column("id", sa.String()),
    sa.column("version", sa.Integer()),
    sa.column("track_id", sa.String()),
    sa.column("position", sa.Integer()),
    sa.column("type", sa.String()),
    sa.column("prompt", sa.String()),
    sa.column("options", JSONB(none_as_null=True)),
    sa.column("answer_key", JSONB(none_as_null=True)),
    sa.column("criteria", JSONB(none_as_null=True)),
)


def insert_rows(table, rows):
    if not rows:
        return
    if op.get_context().as_sql:
        for row in rows:
            values = {
                column.name: (
                    sa.cast(
                        op.inline_literal(json.dumps(row[column.name], ensure_ascii=False)), JSONB
                    )
                    if isinstance(column.type, JSONB) and row.get(column.name) is not None
                    else op.inline_literal(row.get(column.name))
                )
                for column in table.columns
            }
            op.execute(table.insert().values(**values))
    else:
        op.bulk_insert(
            table, [{column.name: row.get(column.name) for column in table.columns} for row in rows]
        )


def upgrade():
    content = load("tracks.json")["tracks"]
    insert_rows(tracks, content)
    insert_rows(
        steps, [{**step, "track_id": track["id"]} for track in content for step in track["steps"]]
    )
    diagnostic = load("diagnostic.json")
    insert_rows(
        questions,
        [{**question, "version": diagnostic["version"]} for question in diagnostic["questions"]],
    )


def downgrade():
    content = load("tracks.json")["tracks"]
    diagnostic = load("diagnostic.json")
    op.execute(
        questions.delete().where(
            questions.c.id.in_([question["id"] for question in diagnostic["questions"]])
        )
    )
    op.execute(
        steps.delete().where(
            steps.c.id.in_([step["id"] for track in content for step in track["steps"]])
        )
    )
    op.execute(tracks.delete().where(tracks.c.id.in_([track["id"] for track in content])))

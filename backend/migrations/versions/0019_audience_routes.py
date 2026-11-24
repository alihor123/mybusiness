"""Store profile and project audiences and install their learning routes."""

import json
from importlib import import_module
from pathlib import Path

import sqlalchemy as sa
from alembic import op

revision = "0019_audience_routes"
down_revision = "0018_demo_auth_profile"
branch_labels = None
depends_on = None

SEED = Path(__file__).resolve().parents[1] / "seed_data"
AUDIENCE_COLUMNS = (
    ("users", "audience"),
    ("tracks", "audience"),
    ("learning_completions", "audience"),
    ("projects", "project_audience"),
)


def load(name):
    return json.loads((SEED / name).read_text(encoding="utf-8"))


def upgrade():
    for table, column in AUDIENCE_COLUMNS:
        op.add_column(
            table, sa.Column(column, sa.String(32), server_default="student", nullable=False)
        )
        op.create_check_constraint(
            f"ck_{table}_{column}", table, f"{column} IN ('student', 'self_employed', 'startup')"
        )

    op.drop_constraint("diagnostics_pkey", "diagnostics", type_="primary")
    op.create_primary_key("diagnostics_pkey", "diagnostics", ["user_id", "version"])
    op.drop_constraint("learning_completions_pkey", "learning_completions", type_="primary")
    op.create_primary_key(
        "learning_completions_pkey", "learning_completions", ["user_id", "audience"]
    )
    op.drop_constraint("first_project_drafts_user_id_key", "first_project_drafts", type_="unique")

    seed_format = import_module("migrations.versions.0004_content")
    tracks = load("tracks_by_audience.json")["tracks"]
    track_table = sa.table(
        "tracks",
        *(sa.column(column.name, column.type) for column in seed_format.tracks.columns),
        sa.column("audience", sa.String(32)),
    )
    seed_format.insert_rows(track_table, tracks)
    seed_format.insert_rows(
        seed_format.steps,
        [{**step, "track_id": track["id"]} for track in tracks for step in track["steps"]],
    )
    assessments = load("diagnostics_by_audience.json")["assessments"]
    seed_format.insert_rows(
        seed_format.questions,
        [
            {**question, "version": assessment["version"]}
            for assessment in assessments
            for question in assessment["questions"]
        ],
    )


def downgrade():
    op.execute("""
        DELETE FROM first_project_drafts
        WHERE completion_id IN (
            SELECT id FROM learning_completions WHERE audience <> 'student'
        )
    """)
    op.execute("DELETE FROM learning_completions WHERE audience <> 'student'")
    op.execute("DELETE FROM diagnostics WHERE version IN (2, 3)")
    op.execute("DELETE FROM diagnostic_questions WHERE version IN (2, 3)")
    for table in (
        "learning_positions", "learning_drafts", "learning_credits",
        "diagnostic_credits", "learning_attempts",
    ):
        op.execute(f"""
            DELETE FROM {table} WHERE step_id IN (
                SELECT s.id FROM learning_steps s JOIN tracks t ON t.id = s.track_id
                WHERE t.audience <> 'student'
            )
        """)
    op.execute("""
        DELETE FROM learning_steps WHERE track_id IN (
            SELECT id FROM tracks WHERE audience <> 'student'
        )
    """)
    op.execute("DELETE FROM tracks WHERE audience <> 'student'")

    op.create_unique_constraint(
        "first_project_drafts_user_id_key", "first_project_drafts", ["user_id"]
    )
    op.drop_constraint("learning_completions_pkey", "learning_completions", type_="primary")
    op.create_primary_key("learning_completions_pkey", "learning_completions", ["user_id"])
    op.drop_constraint("diagnostics_pkey", "diagnostics", type_="primary")
    op.create_primary_key("diagnostics_pkey", "diagnostics", ["user_id"])
    for table, column in reversed(AUDIENCE_COLUMNS):
        op.drop_constraint(f"ck_{table}_{column}", table, type_="check")
        op.drop_column(table, column)

"""Заменить иллюстрацию и деморолик в первых уроках проверки идеи."""

import sqlalchemy as sa
from alembic import op

revision = "0010_idea_lesson_media"
down_revision = "0009_diagnostic_jobs"
branch_labels = None
depends_on = None

VIDEO = "https://rutube.ru/play/embed/12dfc9e5815904e500b2a3ab8125544e/"
IMAGE = "/media/lessons/customer-interview.webp"
OLD_IMAGE = "/media/lessons/lesson-coffee.svg"
OLD_VIDEO = "/media/lessons/demo.mp4"


def replace_media(step_id: str, original_url: str, fields: dict, caption: str | None = None) -> None:
    """Обновляет только исходный демонстрационный блок, если его ещё не заменили."""
    bind = op.get_bind()
    query = sa.text("SELECT blocks FROM learning_steps WHERE id = :step_id")
    blocks = bind.execute(query, {"step_id": step_id}).scalar_one_or_none()
    if blocks is None:
        return
    for block in blocks:
        if block.get("url") != original_url:
            continue
        block.update(fields)
        if caption:
            block["caption"] = caption
        else:
            block.pop("caption", None)
    update = sa.table("learning_steps", sa.column("id"), sa.column("blocks", sa.JSON()))
    bind.execute(update.update().where(update.c.id == step_id).values(blocks=blocks))


def upgrade() -> None:
    replace_media(
        "idea-validation-01", OLD_IMAGE,
        {"url": IMAGE, "alt": "Предпринимательница расспрашивает покупателя о его опыте"},
    )
    replace_media("idea-validation-02", OLD_VIDEO, {"url": VIDEO, "poster_url": None})


def downgrade() -> None:
    replace_media(
        "idea-validation-01", IMAGE,
        {"url": OLD_IMAGE, "alt": "Студенты покупают кофе в университетском буфете"},
        "Учебный пример «Кофе между парами»",
    )
    replace_media("idea-validation-02", VIDEO, {"url": OLD_VIDEO, "poster_url": OLD_IMAGE})

"""Add collapsible summaries to the three video lessons."""

import json
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0017_video_summaries"
down_revision = "0016_track_cover_webp"
branch_labels = None
depends_on = None

TRACKS = Path(__file__).resolve().parents[1] / "seed_data" / "tracks.json"
PREVIOUS = {
    "idea-validation-02": (
        "Попросите клиента вспомнить последний случай. Узнайте, что он пытался сделать, "
        "как справился и сколько времени или денег потратил. В упражнении после видео "
        "выберите вопрос, который помогает узнать о реальном поведении."
    ),
    "mvp-launch-02": None,
    "first-sales-02": (
        "Начните с одного заказа. Например, напиток продаётся за 150 ₽, а ингредиенты, стакан "
        "и комиссия стоят 85 ₽. Остаётся 65 ₽ до расходов на привлечение и постоянных расходов. "
        "В следующем задании выберите, где проверить предложение с небольшими затратами."
    ),
}


def set_summaries(summaries: dict[str, dict | None]) -> None:
    steps = sa.table(
        "learning_steps",
        sa.column("id", sa.String()),
        sa.column("blocks", JSONB()),
    )
    bind = op.get_bind()
    for step_id, summary in summaries.items():
        blocks = bind.execute(sa.select(steps.c.blocks).where(steps.c.id == step_id)).scalar_one()
        # Keep the original video and any separate instructions for the exercise.
        materials = [
            block for block in blocks
            if not (block["type"] == "text" and block.get("title") == "Конспект")
        ]
        if summary is not None:
            video_index = next(index for index, block in enumerate(materials) if block["type"] == "video")
            materials.insert(video_index + 1, summary)
        bind.execute(steps.update().where(steps.c.id == step_id).values(blocks=materials))


def upgrade() -> None:
    tracks = json.loads(TRACKS.read_text(encoding="utf-8"))["tracks"]
    summaries = {
        step["id"]: next(block for block in step["blocks"] if block.get("is_video_summary"))
        for track in tracks
        for step in track["steps"]
        if step["id"] in PREVIOUS
    }
    set_summaries(summaries)


def downgrade() -> None:
    set_summaries({
        step_id: {"type": "text", "title": "Конспект", "text": previous} if previous else None
        for step_id, previous in PREVIOUS.items()
    })

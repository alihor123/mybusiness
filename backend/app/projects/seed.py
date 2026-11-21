import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.accompaniment.models import ProjectMeeting
from app.accompaniment.service import create_plan
from app.mentors.models import Mentor
from app.projects.models import Project

SEED = Path(__file__).resolve().parents[2] / "seed_data" / "demo" / "projects.json"


async def seed_projects(db: AsyncSession, user_id: UUID) -> None:
    rows = json.loads(SEED.read_text(encoding="utf-8"))
    for row in rows:
        fields = dict(row)
        slug = fields.pop("mentor_slug", None)
        mentor_id = None
        if slug is not None:
            mentor_id = await db.scalar(
                select(Mentor.id).where(Mentor.stable_key == f"demo-mentor-{slug}")
            )
            if mentor_id is None:
                raise ValueError(f"Missing demo mentor: {slug}")
        created = await db.scalar(
            insert(Project)
            .values(**fields, user_id=user_id, mentor_id=mentor_id)
            .on_conflict_do_nothing(index_elements=[Project.id])
            .returning(Project.id)
        )
        if created is not None and mentor_id is not None:
            await create_plan(db, created)
            db.add(
                ProjectMeeting(
                    project_id=created,
                    title="Подготовка пробного дня",
                    starts_at=datetime.now(timezone.utc) + timedelta(days=7),
                    url="https://demo.example/meeting",
                    updated_at=datetime.now(timezone.utc),
                )
            )

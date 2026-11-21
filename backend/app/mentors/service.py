from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import api_error
from app.mentors.models import Mentor


async def list_mentors(db: AsyncSession) -> list[Mentor]:
    return list(
        await db.scalars(
            select(Mentor).where(Mentor.active.is_(True)).order_by(Mentor.name, Mentor.id)
        )
    )


async def get_mentor(db: AsyncSession, mentor_id: UUID) -> Mentor:
    mentor = await db.scalar(select(Mentor).where(Mentor.id == mentor_id, Mentor.active.is_(True)))
    if mentor is None:
        raise api_error(404, "MENTOR_NOT_FOUND", "Наставник не найден")
    return mentor

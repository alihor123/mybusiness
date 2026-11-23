from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import api_error
from app.mentors.models import Mentor


async def list_mentors(db: AsyncSession) -> list[Mentor]:
    return list(
        await db.scalars(
            select(Mentor).where(Mentor.active.is_(True)).order_by(Mentor.name, Mentor.id)
        )
    )


async def search_mentors(
    db: AsyncSession, *, query: str, industry: str, offset: int, limit: int
) -> tuple[list[Mentor], int | None]:
    statement = select(Mentor).where(Mentor.active.is_(True))
    if query:
        statement = statement.where(
            or_(
                Mentor.name.icontains(query, autoescape=True),
                Mentor.headline.icontains(query, autoescape=True),
                Mentor.about.icontains(query, autoescape=True),
            )
        )
    if industry:
        statement = statement.where(Mentor.industry_codes.contains([industry]))
    statement = statement.order_by(Mentor.name, Mentor.stable_key)
    rows = list(await db.scalars(statement.offset(offset).limit(limit + 1)))
    return rows[:limit], offset + limit if len(rows) > limit else None


async def get_mentor(db: AsyncSession, mentor_id: UUID) -> Mentor:
    mentor = await db.scalar(select(Mentor).where(Mentor.id == mentor_id, Mentor.active.is_(True)))
    if mentor is None:
        raise api_error(404, "MENTOR_NOT_FOUND", "Наставник не найден")
    return mentor

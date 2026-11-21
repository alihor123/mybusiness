from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.models import Event


async def list_events(db: AsyncSession) -> list[Event]:
    return list(
        await db.scalars(
            select(Event)
            .where(Event.active.is_(True), Event.starts_at >= datetime.now(timezone.utc))
            .order_by(Event.starts_at, Event.id)
        )
    )

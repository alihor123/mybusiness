from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.events import service
from app.events.schemas import EventOut

router = APIRouter(prefix="/events", tags=["events"])
Database = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=list[EventOut])
async def list_events(db: Database) -> list[EventOut]:
    return await service.list_events(db)

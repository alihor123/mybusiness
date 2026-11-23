from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.mentors import service
from app.mentors.schemas import MentorOut, MentorPage

router = APIRouter(prefix="/mentors", tags=["mentors"])
Database = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=list[MentorOut])
async def list_mentors(db: Database) -> list[MentorOut]:
    return await service.list_mentors(db)


@router.get("/search", response_model=MentorPage)
async def search_mentors(
    db: Database,
    q: str = Query(default="", max_length=200),
    industry: str = "",
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=12, ge=1, le=100),
) -> MentorPage:
    items, next_offset = await service.search_mentors(
        db, query=q.strip(), industry=industry, offset=offset, limit=limit
    )
    return MentorPage(items=items, next_offset=next_offset)


@router.get("/{mentor_id}", response_model=MentorOut)
async def get_mentor(mentor_id: UUID, db: Database) -> MentorOut:
    return await service.get_mentor(db, mentor_id)

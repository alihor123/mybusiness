from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.mentors import service
from app.mentors.schemas import MentorOut

router = APIRouter(prefix="/mentors", tags=["mentors"])
Database = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=list[MentorOut])
async def list_mentors(db: Database) -> list[MentorOut]:
    return await service.list_mentors(db)


@router.get("/{mentor_id}", response_model=MentorOut)
async def get_mentor(mentor_id: UUID, db: Database) -> MentorOut:
    return await service.get_mentor(db, mentor_id)

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.applications import service
from app.applications.schemas import (
    ApplicationDetail,
    ApplicationIn,
    ApplicationInboxItem,
    ApplicationOut,
    DecisionIn,
)
from app.auth.dependencies import require_permission
from app.auth.schemas import Actor
from app.database import get_db

router = APIRouter(tags=["applications"])
Db = Annotated[AsyncSession, Depends(get_db)]
Student = Annotated[Actor, Depends(require_permission("projects:manage"))]
Teacher = Annotated[Actor, Depends(require_permission("projects:mentor"))]
Participant = Annotated[Actor, Depends(require_permission("projects:read"))]


@router.get("/projects/{id}/applications", response_model=list[ApplicationOut])
async def list_project(id: UUID, actor: Student, db: Db):
    return await service.list_project(id, actor, db)


@router.post("/projects/{id}/applications", status_code=201, response_model=ApplicationOut)
async def apply(id: UUID, data: ApplicationIn, actor: Student, db: Db):
    return await service.apply(id, data, actor, db)


@router.get("/mentor/applications", response_model=list[ApplicationInboxItem])
async def inbox(actor: Teacher, db: Db):
    return await service.inbox(actor, db)


@router.get("/applications/{id}", response_model=ApplicationDetail)
async def detail(id: UUID, actor: Participant, db: Db):
    return await service.detail(id, actor, db)


@router.post("/applications/{id}/decision", response_model=ApplicationOut)
async def decide(id: UUID, data: DecisionIn, actor: Teacher, db: Db):
    return await service.decide(id, data, actor, db)


@router.post("/applications/{id}/withdraw", response_model=ApplicationOut)
async def withdraw(id: UUID, actor: Student, db: Db):
    return await service.withdraw(id, actor, db)

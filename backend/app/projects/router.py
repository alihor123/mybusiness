from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import DeepSeekClient, get_deepseek
from app.auth.dependencies import require_permission
from app.auth.schemas import Actor
from app.database import get_db
from app.projects import service
from app.projects.schemas import ProjectOut, Questionnaire, Recommendations

router = APIRouter(prefix="/projects", tags=["projects"])
Db = Annotated[AsyncSession, Depends(get_db)]
Student = Annotated[Actor, Depends(require_permission("projects:manage"))]
Participant = Annotated[Actor, Depends(require_permission("projects:read"))]


@router.get("", response_model=list[ProjectOut])
async def list_projects(actor: Participant, db: Db):
    return await service.list_projects(actor, db)


@router.post("", status_code=201, response_model=ProjectOut)
async def create(actor: Student, db: Db):
    return await service.create(actor, db)


@router.get("/{id}", response_model=ProjectOut)
async def get(id: UUID, actor: Participant, db: Db):
    return await service.get(id, actor, db)


@router.patch("/{id}", response_model=ProjectOut)
async def edit(id: UUID, data: Questionnaire, actor: Student, db: Db):
    return await service.edit(id, data, actor, db)


@router.delete("/{id}", status_code=204)
async def delete(id: UUID, actor: Student, db: Db):
    return await service.delete(id, actor, db)


@router.post("/{id}/archive", response_model=ProjectOut)
async def archive(id: UUID, actor: Student, db: Db):
    return await service.archive(id, actor, db)


@router.post("/{id}/mentor-recommendations", response_model=Recommendations)
async def recommend(
    id: UUID,
    data: Questionnaire,
    actor: Student,
    db: Db,
    ai: Annotated[DeepSeekClient, Depends(get_deepseek)],
):
    return await service.recommend(id, data, actor, db, ai)

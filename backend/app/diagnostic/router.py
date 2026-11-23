from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.auth.schemas import Actor
from app.database import get_db
from app.diagnostic import service
from app.diagnostic.schemas import DiagnosticOut, Draft, Submit

router = APIRouter(prefix="/diagnostic", tags=["diagnostic"])
Student = Annotated[Actor, Depends(require_permission("diagnostic:use"))]
Database = Annotated[AsyncSession, Depends(get_db)]


@router.get("")
async def get_diagnostic(actor: Student, db: Database) -> DiagnosticOut:
    return await service.get_diagnostic(db, actor.user_id)


@router.put("/draft")
async def save_draft(data: Draft, actor: Student, db: Database) -> DiagnosticOut:
    return await service.save_draft(db, actor.user_id, data)


@router.post("/skip")
async def skip(actor: Student, db: Database, data: Draft | None = None) -> DiagnosticOut:
    return await service.skip(db, actor.user_id, data)


@router.post("/restart")
async def restart(actor: Student, db: Database) -> DiagnosticOut:
    return await service.restart(db, actor.user_id)


@router.post(
    "/submit",
    status_code=202,
    responses={
        409: {"description": "Проверка выполняется или изменился снимок ответа"},
    },
)
async def submit(data: Submit, actor: Student, db: Database) -> DiagnosticOut:
    return await service.submit(db, actor.user_id, data)

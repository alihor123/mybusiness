from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import DeepSeekClient, get_deepseek
from app.auth.dependencies import require_permission
from app.auth.schemas import Actor
from app.database import get_db
from app.learning import service
from app.learning.progress import get_progress
from app.learning.schemas import (
    CompletionIn,
    DraftIn,
    HelpIn,
    Hint,
    Progress,
    StepOut,
    SubmissionIn,
    SubmissionOut,
    TrackDetail,
    TrackOut,
)

router = APIRouter(tags=["learning"])
Student = Annotated[Actor, Depends(require_permission("learning:use"))]
Database = Annotated[AsyncSession, Depends(get_db)]
AI = Annotated[DeepSeekClient, Depends(get_deepseek)]


@router.get("/tracks")
async def tracks(actor: Student, db: Database) -> list[TrackOut]:
    return await service.tracks(db, actor.user_id)


@router.get("/tracks/{track_id}")
async def track(track_id: str, actor: Student, db: Database) -> TrackDetail:
    return await service.track_detail(db, actor.user_id, track_id)


@router.get("/learning/steps/{step_id}")
async def step(step_id: str, actor: Student, db: Database) -> StepOut:
    return await service.step_out(db, actor.user_id, await service.get_step(db, step_id))


@router.put("/learning/steps/{step_id}/draft")
async def draft(step_id: str, data: DraftIn, actor: Student, db: Database) -> StepOut:
    return await service.save_draft(db, actor.user_id, step_id, data)


@router.post(
    "/learning/steps/{step_id}/complete", responses={409: {"description": "Шаг вне очереди"}}
)
async def complete(step_id: str, data: CompletionIn, actor: Student, db: Database) -> Progress:
    return await service.complete(db, actor.user_id, step_id, data)


@router.post(
    "/learning/steps/{step_id}/submissions",
    responses={
        503: {"description": "CHECK_UNAVAILABLE"},
    },
)
async def submit(
    step_id: str, data: SubmissionIn, actor: Student, db: Database, ai: AI
) -> SubmissionOut:
    return await service.submit(db, ai, actor.user_id, step_id, data)


@router.post(
    "/learning/steps/{step_id}/help", responses={503: {"description": "CHECK_UNAVAILABLE"}}
)
async def help_with_step(step_id: str, data: HelpIn, actor: Student, ai: AI, db: Database) -> Hint:
    return await service.help_with_step(db, ai, step_id, data)


@router.get("/learning/progress")
async def progress(actor: Student, db: Database) -> Progress:
    return await get_progress(db, actor.user_id)

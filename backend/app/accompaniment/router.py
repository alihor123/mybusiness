import json
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.accompaniment import service
from app.accompaniment.models import (
    AccompanimentAttachment,
    ProjectMeeting,
    TaskDraft,
    TaskSubmission,
)
from app.accompaniment.schemas import (
    DecisionIn,
    DecisionOut,
    MeetingIn,
    MeetingOut,
    PlanOut,
    PreviewIn,
    PreviewOut,
    TaskOut,
)
from app.ai.client import CheckUnavailable, DeepSeekClient, get_deepseek
from app.auth.dependencies import require_permission
from app.auth.schemas import Actor
from app.database import get_db
from app.errors import api_error, check_unavailable

router = APIRouter(tags=["accompaniment"])
ActorDep = Annotated[Actor, Depends(require_permission("projects:read"))]
Database = Annotated[AsyncSession, Depends(get_db)]
AI = Annotated[DeepSeekClient, Depends(get_deepseek)]


@router.get("/projects/{project_id}/tasks", response_model=PlanOut)
async def tasks(project_id: UUID, actor: ActorDep, db: Database):
    async with db.begin():
        project = await service.get_project(db, actor, project_id)
        return await service.plan_out(db, project.id, owner=actor.role == "student")


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def task(task_id: UUID, actor: ActorDep, db: Database):
    async with db.begin():
        item = await service.get_task(db, task_id)
        project = await service.task_project(db, item)
        await service.get_project(db, actor, project.id)
        plan = await service.plan_out(db, project.id, owner=actor.role == "student")
        return next(row for row in plan["tasks"] if row["id"] == task_id)


@router.put("/tasks/{task_id}/draft", response_model=TaskOut)
async def save_draft(
    task_id: UUID,
    actor: ActorDep,
    db: Database,
    text: Annotated[str, Form(max_length=10_000)] = "",
    saved_at_ms: Annotated[int | None, Form(ge=0)] = None,
    file_only: Annotated[bool, Form()] = False,
    file_action: Annotated[str, Form()] = "keep",
    file: Annotated[UploadFile | None, File()] = None,
):
    async with db.begin():
        item = await service.get_task(db, task_id, lock=True)
        project = await service.task_project(db, item)
        await service.get_project(db, actor, project.id, lock=True)
        if actor.role != "student":
            raise api_error(403, "FORBIDDEN", "Черновик доступен только владельцу проекта")
        service.require_mutable(project)
        if item.status not in {"todo", "revision_requested"}:
            raise api_error(
                409,
                "TASK_NOT_EDITABLE",
                "Отправленная или принятая работа недоступна для изменения",
            )
        await service.replace_draft(
            db, item, text_value=None if file_only else text,
            file_action=file_action, upload=file, saved_at_ms=saved_at_ms,
        )
        plan = await service.plan_out(db, project.id, owner=True)
        return next(row for row in plan["tasks"] if row["id"] == task_id)


@router.post("/tasks/{task_id}/preview-check", response_model=PreviewOut)
async def preview_check(task_id: UUID, data: PreviewIn, actor: ActorDep, db: Database, ai: AI):
    async with db.begin():
        item = await service.get_task(db, task_id)
        project = await service.task_project(db, item)
        await service.get_project(db, actor, project.id)
        if actor.role != "student":
            raise api_error(403, "FORBIDDEN", "Проверка доступна владельцу проекта")
        service.require_mutable(project)
        condition, criteria = item.condition, item.criteria
    from pydantic import BaseModel, Field

    class Remarks(BaseModel):
        remarks: list[str] = Field(default_factory=list, max_length=8)

    try:
        result = await ai.complete(
            "Дай краткие конкретные замечания к тексту относительно условия и критериев. "
            "Не меняй статус работы и не требуй обязательного выполнения.",
            json.dumps(
                {"condition": condition, "criteria": criteria, "text": data.text},
                ensure_ascii=False,
            ),
            Remarks,
        )
    except CheckUnavailable as exc:
        raise check_unavailable() from exc
    return PreviewOut(remarks=result.remarks)


@router.post("/tasks/{task_id}/submissions", response_model=TaskOut)
async def submit(
    task_id: UUID,
    actor: ActorDep,
    db: Database,
    text: Annotated[str, Form(max_length=10_000)],
    request_key: Annotated[str, Form(min_length=1, max_length=128)],
    saved_at_ms: Annotated[int | None, Form(ge=0)] = None,
    file_action: Annotated[str, Form()] = "keep",
    file: Annotated[UploadFile | None, File()] = None,
):
    async with db.begin():
        item = await service.get_task(db, task_id, lock=True)
        project = await service.task_project(db, item)
        await service.get_project(db, actor, project.id, lock=True)
        if actor.role != "student":
            raise api_error(403, "FORBIDDEN", "Отправка доступна только владельцу проекта")
        service.require_mutable(project)
        await service.submit_task(
            db,
            item,
            text_value=text,
            request_key=request_key,
            file_action=file_action,
            upload=file,
            saved_at_ms=saved_at_ms,
        )
        plan = await service.plan_out(db, project.id, owner=True)
        return next(row for row in plan["tasks"] if row["id"] == task_id)


@router.post("/submissions/{submission_id}/decision", response_model=DecisionOut)
async def decide(submission_id: UUID, data: DecisionIn, actor: ActorDep, db: Database):
    async with db.begin():
        submission, status, count = await service.decide_submission(
            db,
            actor,
            submission_id,
            data.decision,
            data.comment,
        )
        item = await service.get_task(db, submission.task_id)
        project = await service.task_project(db, item)
        service.require_mutable(project)
        return DecisionOut(
            submission=await service.submission_out(db, submission),
            task_status=status,
            accepted_count=count,
            plan_completed=count == 5,
        )


@router.get("/attachments/{attachment_id}")
async def download_attachment(attachment_id: UUID, actor: ActorDep, db: Database):
    async with db.begin():
        attachment = await db.get(AccompanimentAttachment, attachment_id)
        if attachment is None:
            raise api_error(404, "ATTACHMENT_NOT_FOUND", "Файл не найден")
        submission = await db.scalar(
            select(TaskSubmission).where(TaskSubmission.attachment_id == attachment_id).limit(1)
        )
        draft = await db.scalar(
            select(TaskDraft).where(TaskDraft.attachment_id == attachment_id).limit(1)
        )
        task_id = (
            submission.task_id
            if submission is not None
            else draft.task_id
            if draft is not None
            else None
        )
        if task_id is None:
            raise api_error(404, "ATTACHMENT_NOT_FOUND", "Файл не найден")
        item = await service.get_task(db, task_id)
        project = await service.task_project(db, item)
        await service.get_project(db, actor, project.id)
        if actor.role == "teacher" and submission is None:
            raise api_error(404, "ATTACHMENT_NOT_FOUND", "Файл не найден")
        if draft is not None and submission is None and actor.role != "student":
            raise api_error(404, "ATTACHMENT_NOT_FOUND", "Файл не найден")
        path = service.file_path(attachment)
        filename, content_type = attachment.filename, attachment.content_type
    if not path.is_file():
        raise api_error(404, "ATTACHMENT_NOT_FOUND", "Файл не найден")
    return FileResponse(
        path,
        media_type=content_type,
        filename=filename,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/projects/{project_id}/meeting", response_model=MeetingOut | None)
async def meeting(project_id: UUID, actor: ActorDep, db: Database):
    async with db.begin():
        await service.get_project(db, actor, project_id)
        row = await db.get(ProjectMeeting, project_id)
        if row is None:
            return None
        return MeetingOut(
            project_id=row.project_id, title=row.title, starts_at=row.starts_at, url=row.url
        )


@router.put("/projects/{project_id}/meeting", response_model=MeetingOut)
async def set_meeting(project_id: UUID, data: MeetingIn, actor: ActorDep, db: Database):
    async with db.begin():
        project = await service.get_project(db, actor, project_id, lock=True)
        if actor.role != "teacher" or project.mentor_id is None:
            raise api_error(403, "FORBIDDEN", "Встречу назначает закреплённый наставник")
        service.require_mutable(project)
        if data.starts_at.tzinfo is None or data.starts_at.utcoffset() is None:
            raise api_error(422, "TIMEZONE_REQUIRED", "Укажите часовой пояс встречи")
        row = await db.get(ProjectMeeting, project_id)
        if row is None:
            row = ProjectMeeting(
                project_id=project_id,
                title=data.title,
                starts_at=data.starts_at,
                url=str(data.url),
                updated_at=service.datetime.now(service.timezone.utc),
            )
            db.add(row)
        else:
            row.title, row.starts_at, row.url = data.title, data.starts_at, str(data.url)
            row.updated_at = service.datetime.now(service.timezone.utc)
        await db.flush()
        return MeetingOut(
            project_id=project_id, title=row.title, starts_at=row.starts_at, url=row.url
        )

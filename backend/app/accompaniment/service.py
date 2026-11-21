from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.accompaniment.models import (
    AccompanimentAttachment,
    AccompanimentPlan,
    AccompanimentTask,
    TaskDraft,
    TaskSubmission,
)
from app.auth.schemas import Actor
from app.config import get_settings
from app.errors import api_error
from app.mentors.models import Mentor
from app.projects.models import Project

TASKS = [
    (
        "Определить целевую аудиторию",
        "Опишите конкретную группу людей, для которой решаете проблему.",
        ["Сегмент аудитории определён", "Указаны потребность и контекст"],
    ),
    (
        "Провести интервью",
        "Поговорите с представителями аудитории и зафиксируйте выводы.",
        ["Проведены интервью", "Выводы подтверждены цитатами или наблюдениями"],
    ),
    (
        "Подготовить минимальное предложение",
        "Сформулируйте минимальный вариант продукта или услуги.",
        ["Предложение описано", "Понятна ценность для клиента"],
    ),
    (
        "Проверить MVP",
        "Проверьте минимальную версию решения на аудитории.",
        ["Проверка проведена", "Результаты и изменения зафиксированы"],
    ),
    (
        "Получить первые обращения",
        "Проверьте спрос и получите первые обращения потенциальных клиентов.",
        ["Канал привлечения описан", "Результат проверки спроса зафиксирован"],
    ),
]


async def create_plan(db: AsyncSession, project_id: UUID) -> AccompanimentPlan:
    """Create the project plan inside the caller-owned transaction; never commits."""
    plan = await db.scalar(
        select(AccompanimentPlan).where(AccompanimentPlan.project_id == project_id)
    )
    if plan is not None:
        return plan
    plan = AccompanimentPlan(project_id=project_id, created_at=datetime.now(timezone.utc))
    db.add(plan)
    await db.flush()
    db.add_all(
        [
            AccompanimentTask(
                plan_id=plan.id,
                position=index,
                title=title,
                condition=condition,
                criteria=criteria,
                status="todo",
            )
            for index, (title, condition, criteria) in enumerate(TASKS, start=1)
        ]
    )
    await db.flush()
    return plan


async def get_project(
    db: AsyncSession, actor: Actor, project_id: UUID, *, lock: bool = False
) -> Project:
    stmt = select(Project).where(Project.id == project_id)
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    project = await db.scalar(stmt)
    if project is None:
        raise api_error(404, "PROJECT_NOT_FOUND", "Проект не найден")
    if actor.role == "student" and project.user_id == actor.user_id:
        return project
    if actor.role == "teacher" and project.mentor_id is not None:
        mentor_user = await db.scalar(select(Mentor.user_id).where(Mentor.id == project.mentor_id))
        if mentor_user == actor.user_id:
            return project
    raise api_error(404, "PROJECT_NOT_FOUND", "Проект не найден")


def require_mutable(project: Project) -> None:
    if project.archived_at is not None:
        raise api_error(409, "PROJECT_ARCHIVED", "Проект находится в архиве")


async def get_task(db: AsyncSession, task_id: UUID, *, lock: bool = False) -> AccompanimentTask:
    stmt = select(AccompanimentTask).where(AccompanimentTask.id == task_id)
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    task = await db.scalar(stmt)
    if task is None:
        raise api_error(404, "TASK_NOT_FOUND", "Задача не найдена")
    return task


async def task_project(db: AsyncSession, task: AccompanimentTask) -> Project:
    plan = await db.get(AccompanimentPlan, task.plan_id)
    if plan is None:
        raise api_error(404, "TASK_NOT_FOUND", "Задача не найдена")
    return await db.get(Project, plan.project_id)


async def attachment_out(db: AsyncSession, attachment_id: UUID | None):
    if attachment_id is None:
        return None
    attachment = await db.get(AccompanimentAttachment, attachment_id)
    if attachment is None:
        return None
    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "content_type": attachment.content_type,
        "size": attachment.size,
    }


async def submission_out(db: AsyncSession, submission: TaskSubmission):
    return {
        "id": submission.id,
        "number": submission.number,
        "request_key": submission.request_key,
        "text": submission.text,
        "status": submission.status,
        "decision_comment": submission.decision_comment,
        "created_at": submission.created_at,
        "attachment": await attachment_out(db, submission.attachment_id),
    }


async def plan_out(db: AsyncSession, project_id: UUID, *, owner: bool):
    plan = await db.scalar(
        select(AccompanimentPlan).where(AccompanimentPlan.project_id == project_id)
    )
    if plan is None:
        return {
            "project_id": project_id,
            "tasks": [],
            "next_task_id": None,
            "accepted_count": 0,
            "plan_completed": False,
        }
    tasks = list(
        (
            await db.scalars(
                select(AccompanimentTask)
                .where(AccompanimentTask.plan_id == plan.id)
                .order_by(AccompanimentTask.position)
            )
        ).all()
    )
    project = await db.get(Project, project_id)
    data = []
    for task in tasks:
        draft = await db.get(TaskDraft, task.id) if owner else None
        submissions = list(
            (
                await db.scalars(
                    select(TaskSubmission)
                    .where(TaskSubmission.task_id == task.id)
                    .order_by(TaskSubmission.number)
                )
            ).all()
        )
        allowed_actions = []
        if project.archived_at is None:
            if owner and task.status in {"todo", "revision_requested"}:
                allowed_actions = ["save_draft", "preview_check", "submit"]
            elif not owner and task.status == "submitted":
                allowed_actions = ["accept", "request_revision"]
        data.append(
            {
                "id": task.id,
                "position": task.position,
                "title": task.title,
                "condition": task.condition,
                "criteria": task.criteria,
                "status": task.status,
                "allowed_actions": allowed_actions,
                "draft_text": draft.text if draft else None,
                "draft_attachment": await attachment_out(db, draft.attachment_id)
                if draft
                else None,
                "submissions": [await submission_out(db, submission) for submission in submissions],
            }
        )
    mentor = await db.scalar(
        select(Mentor).join(Project, Project.mentor_id == Mentor.id).where(Project.id == project_id)
    )
    accepted = sum(task.status == "accepted" for task in tasks)
    next_task = next((task.id for task in tasks if task.status != "accepted"), None)
    return {
        "mentor": {"id": mentor.id, "name": mentor.name, "contacts": mentor.contacts}
        if mentor
        else None,
        "project_id": project_id,
        "tasks": data,
        "next_task_id": next_task,
        "accepted_count": accepted,
        "plan_completed": accepted == 5,
    }


async def write_upload(db: AsyncSession, upload, *, max_bytes: int = 10 * 1024 * 1024):
    if upload is None:
        return None
    suffix = Path(upload.filename or "").suffix.lower()
    types = {
        ".pdf": ("application/pdf", b"%PDF-"),
        ".jpg": ("image/jpeg", b"\xff\xd8\xff"),
        ".jpeg": ("image/jpeg", b"\xff\xd8\xff"),
        ".png": ("image/png", b"\x89PNG\r\n\x1a\n"),
    }
    if suffix not in types:
        raise api_error(422, "INVALID_ATTACHMENT_TYPE", "Разрешены только PDF, JPG и PNG")
    content = await upload.read(max_bytes + 1)
    if not content or len(content) > max_bytes or not content.startswith(types[suffix][1]):
        raise api_error(
            422, "INVALID_ATTACHMENT", "Файл пуст, превышает 10 МБ или имеет неверный формат"
        )
    identifier = uuid4()
    storage_key = identifier.hex
    root = Path(get_settings().private_upload_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    (root / storage_key).write_bytes(content)
    attachment = AccompanimentAttachment(
        id=identifier,
        filename=Path(upload.filename or "attachment").name[:255],
        content_type=types[suffix][0],
        size=len(content),
        storage_key=storage_key,
        created_at=datetime.now(timezone.utc),
    )
    db.add(attachment)
    await db.flush()
    return attachment


def file_path(attachment: AccompanimentAttachment) -> Path:
    root = Path(get_settings().private_upload_dir).resolve()
    path = (root / attachment.storage_key).resolve()
    if path.parent != root:
        raise api_error(404, "ATTACHMENT_NOT_FOUND", "Файл не найден")
    return path


async def replace_draft(
    db: AsyncSession,
    task: AccompanimentTask,
    *,
    text_value: str,
    file_action: str,
    upload,
):
    if file_action not in {"keep", "replace", "remove"}:
        raise api_error(422, "INVALID_FILE_ACTION", "Недопустимое действие с файлом")
    draft = await db.get(TaskDraft, task.id)
    if draft is None:
        draft = TaskDraft(task_id=task.id, text="", updated_at=datetime.now(timezone.utc))
        db.add(draft)
    if file_action == "replace":
        if upload is None:
            raise api_error(422, "FILE_REQUIRED", "Для replace требуется файл")
        attachment = await write_upload(db, upload)
        draft.attachment_id = attachment.id
    elif file_action == "remove":
        if upload is not None:
            raise api_error(422, "UNEXPECTED_FILE", "При remove файл передавать нельзя")
        draft.attachment_id = None
    elif upload is not None:
        raise api_error(422, "UNEXPECTED_FILE", "Для нового файла используйте replace")
    draft.text = text_value
    draft.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return draft


async def submit_task(
    db: AsyncSession,
    task: AccompanimentTask,
    *,
    text_value: str,
    request_key: str,
    file_action: str,
    upload,
):
    prior = await db.scalar(
        select(TaskSubmission).where(
            TaskSubmission.task_id == task.id,
            TaskSubmission.request_key == request_key,
        )
    )
    if prior is not None:
        if prior.text != text_value:
            raise api_error(
                409, "REQUEST_KEY_REUSED", "Ключ запроса уже использован для другой работы"
            )
        return prior
    if task.status not in {"todo", "revision_requested"}:
        raise api_error(409, "TASK_NOT_SUBMITTABLE", "Задача сейчас не принимает отправку")
    if not text_value.strip():
        raise api_error(422, "TEXT_REQUIRED", "Перед отправкой добавьте текст")
    draft = await db.get(TaskDraft, task.id)
    inherited_id = draft.attachment_id if draft else None
    if file_action == "replace":
        if upload is None:
            raise api_error(422, "FILE_REQUIRED", "Для replace требуется файл")
        attachment = await write_upload(db, upload)
        inherited_id = attachment.id
    elif file_action == "remove":
        if upload is not None:
            raise api_error(422, "UNEXPECTED_FILE", "При remove файл передавать нельзя")
        inherited_id = None
    elif file_action != "keep" or upload is not None:
        raise api_error(422, "INVALID_FILE_ACTION", "Недопустимое действие с файлом")
    number = (
        int(
            await db.scalar(
                select(func.max(TaskSubmission.number)).where(
                    TaskSubmission.task_id == task.id,
                )
            )
            or 0
        )
        + 1
    )
    submission = TaskSubmission(
        task_id=task.id,
        number=number,
        request_key=request_key,
        text=text_value.strip(),
        attachment_id=inherited_id,
        status="submitted",
        created_at=datetime.now(timezone.utc),
    )
    db.add(submission)
    await db.flush()
    task.current_submission_id = submission.id
    task.status = "submitted"
    if draft is None:
        draft = TaskDraft(task_id=task.id, text="", updated_at=datetime.now(timezone.utc))
        db.add(draft)
    draft.text = ""
    draft.attachment_id = None
    draft.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return submission


async def decide_submission(
    db: AsyncSession, actor: Actor, submission_id: UUID, decision: str, comment: str | None
):
    submission = await db.scalar(
        select(TaskSubmission).where(TaskSubmission.id == submission_id).with_for_update()
    )
    if submission is None:
        raise api_error(404, "SUBMISSION_NOT_FOUND", "Сдача не найдена")
    task = await get_task(db, submission.task_id, lock=True)
    project = await task_project(db, task)
    await get_project(db, actor, project.id, lock=True)
    require_mutable(project)
    if actor.role != "teacher" or project.mentor_id is None:
        raise api_error(403, "FORBIDDEN", "Решение доступно только закреплённому наставнику")
    if (
        task.current_submission_id != submission.id
        or task.status != "submitted"
        or submission.status != "submitted"
    ):
        raise api_error(409, "STALE_SUBMISSION", "Эта сдача уже не является текущей")
    if decision == "revision_requested" and not (comment or "").strip():
        raise api_error(422, "COMMENT_REQUIRED", "При возврате нужен комментарий")
    if decision == "accept":
        task.status = submission.status = "accepted"
        submission.decision_comment = comment.strip() if comment and comment.strip() else None
    else:
        task.status = submission.status = "revision_requested"
        submission.decision_comment = comment.strip()
        draft = await db.get(TaskDraft, task.id)
        if draft is None:
            draft = TaskDraft(
                task_id=task.id,
                text=submission.text,
                attachment_id=submission.attachment_id,
                updated_at=datetime.now(timezone.utc),
            )
            db.add(draft)
        else:
            draft.text = submission.text
            draft.attachment_id = submission.attachment_id
            draft.updated_at = datetime.now(timezone.utc)
    submission.decided_at = datetime.now(timezone.utc)
    await db.flush()
    count = int(
        await db.scalar(
            select(func.count())
            .select_from(AccompanimentTask)
            .join(AccompanimentPlan, AccompanimentTask.plan_id == AccompanimentPlan.id)
            .where(
                AccompanimentPlan.project_id == project.id, AccompanimentTask.status == "accepted"
            )
        )
        or 0
    )
    return submission, task.status, count

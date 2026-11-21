import json
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import CheckUnavailable, DeepSeekClient
from app.auth.schemas import Actor
from app.auth.service import lock_user
from app.auth.tokens import utcnow
from app.errors import api_error, check_unavailable
from app.mentors.models import Mentor
from app.projects.bootstrap import ProjectPrefill
from app.projects.bootstrap import ensure_first_project as reserve_first_project
from app.projects.models import Project
from app.projects.schemas import ProjectOut, Questionnaire, Recommendations


def missing() -> HTTPException:
    return api_error(404, "PROJECT_NOT_FOUND", "Проект не найден")


def require_mutable(project: Project) -> None:
    if project.archived_at is not None:
        raise api_error(409, "PROJECT_ARCHIVED", "Проект в архиве")


async def get_owned(
    db: AsyncSession, project_id: UUID, user_id: UUID, *, lock: bool = False
) -> Project:
    statement = select(Project).where(Project.id == project_id, Project.user_id == user_id)
    if lock:
        statement = statement.with_for_update()
    project = await db.scalar(statement)
    if project is None:
        raise missing()
    return project


def visible_query(actor: Actor):
    if actor.role == "student":
        return select(Project).where(Project.user_id == actor.user_id)
    return (
        select(Project)
        .join(Mentor, Project.mentor_id == Mentor.id)
        .where(Mentor.user_id == actor.user_id)
    )


async def as_output(db: AsyncSession, project: Project) -> ProjectOut:
    from app.applications.models import Application

    status = "draft"
    if project.archived_at is not None:
        status = "archived"
    elif project.mentor_id is not None:
        status = "accompaniment"
    elif await db.scalar(
        select(Application.id)
        .where(Application.project_id == project.id, Application.status == "pending")
        .limit(1)
    ):
        status = "waiting_mentor"
    fields = {name: getattr(project, name) for name in Questionnaire.model_fields}
    return ProjectOut(
        **fields,
        id=project.id,
        user_id=project.user_id,
        mentor_id=project.mentor_id,
        questionnaire_version=project.questionnaire_version,
        archived_at=project.archived_at,
        status=status,
    )


def update(project: Project, questionnaire: Questionnaire) -> None:
    fields = questionnaire.model_dump(exclude_unset=True)
    changes = {name: value for name, value in fields.items() if getattr(project, name) != value}
    for name, value in changes.items():
        setattr(project, name, value)
    if changes:
        project.questionnaire_version += 1


async def ensure_first_project(
    db: AsyncSession,
    *,
    user_id: UUID,
    completion_id: UUID,
    project_prefill: ProjectPrefill,
) -> UUID:
    from app.projects.bootstrap import FirstProjectDraft

    await lock_user(db, user_id)
    existing = await db.get(FirstProjectDraft, completion_id)
    project_id = await reserve_first_project(
        db, user_id=user_id, completion_id=completion_id, project_prefill=project_prefill
    )
    if existing is None:
        data = project_prefill.model_dump(
            include={"title", "industry", "stage", "audience", "problem"}
        )
        await db.execute(
            insert(Project)
            .values(
                **data,
                id=project_id,
                user_id=user_id,
                solution_benefit=project_prefill.solution_benefit or project_prefill.solution,
                mentor_request=project_prefill.mentor_request,
            )
            .on_conflict_do_nothing(index_elements=[Project.id])
        )
    return project_id


def require_complete(project: Project) -> None:
    if not all(getattr(project, name) for name in Questionnaire.model_fields):
        raise api_error(422, "INCOMPLETE_QUESTIONNAIRE", "Заполните семь полей анкеты")


async def list_projects(actor: Actor, db: AsyncSession):
    query = visible_query(actor)
    return [await as_output(db, row) for row in await db.scalars(query.order_by(Project.id))]


async def create(actor: Actor, db: AsyncSession):
    from app.learning.progress import get_learning_outcome

    async with db.begin():
        if not (await get_learning_outcome(db, actor.user_id)).can_create_project:
            raise api_error(409, "LEARNING_INCOMPLETE", "Завершите обучение")
        project = Project(user_id=actor.user_id)
        db.add(project)
        await db.flush()
        return await as_output(db, project)


async def get(id: UUID, actor: Actor, db: AsyncSession):
    query = visible_query(actor)
    project = await db.scalar(query.where(Project.id == id))
    if project is None:
        raise missing()
    return await as_output(db, project)


async def edit(id: UUID, data: Questionnaire, actor: Actor, db: AsyncSession):
    async with db.begin():
        project = await get_owned(db, id, actor.user_id, lock=True)
        require_mutable(project)
        update(project, data)
        return await as_output(db, project)


async def delete(id: UUID, actor: Actor, db: AsyncSession):
    async with db.begin():
        project = await get_owned(db, id, actor.user_id, lock=True)
        require_mutable(project)
        state = await as_output(db, project)
        if state.status != "draft":
            raise api_error(409, "PROJECT_NOT_DRAFT", "Можно удалить только черновик без заявок")
        await db.delete(project)


async def archive(id: UUID, actor: Actor, db: AsyncSession):
    async with db.begin():
        project = await get_owned(db, id, actor.user_id, lock=True)
        if project.mentor_id is None:
            raise api_error(409, "MENTOR_NOT_ASSIGNED", "У проекта пока нет наставника")
        if project.archived_at is None:
            project.archived_at = utcnow()
        return await as_output(db, project)


async def recommend(
    id: UUID,
    data: Questionnaire,
    actor: Actor,
    db: AsyncSession,
    ai: DeepSeekClient,
):
    async with db.begin():
        project = await get_owned(db, id, actor.user_id, lock=True)
        require_mutable(project)
        update(project, data)
        require_complete(project)
        questionnaire = {name: getattr(project, name) for name in Questionnaire.model_fields}
        active = list(await db.scalars(select(Mentor).where(Mentor.active).order_by(Mentor.id)))
        profiles = [mentor_profile(mentor) for mentor in active]

    if not profiles:
        return Recommendations(recommendations=[])
    try:
        result = await ai.complete(
            "Порекомендуй до трёх наставников из списка. Обоснуй каждый выбор по-русски.",
            json.dumps({"project": questionnaire, "mentors": profiles}, ensure_ascii=False),
            Recommendations,
        )
    except CheckUnavailable as exc:
        raise check_unavailable() from exc
    ids = {mentor.id for mentor in active}
    filtered = {}
    for item in result.recommendations:
        if item.mentor_id in ids:
            filtered.setdefault(item.mentor_id, item)
    return Recommendations(recommendations=list(filtered.values())[:3])


def mentor_profile(mentor: Mentor) -> dict:
    result = {"mentor_id": str(mentor.id)}
    for name in ("name", "headline", "industry_codes", "project_stage_codes", "help_topics"):
        result[name] = getattr(mentor, name, None)
    return result

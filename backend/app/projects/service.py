import json
import re
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import CheckUnavailable, DeepSeekClient
from app.audience import Audience
from app.auth.models import User
from app.auth.schemas import Actor
from app.auth.service import lock_user
from app.auth.tokens import utcnow
from app.errors import api_error, check_unavailable
from app.mentors.models import Mentor
from app.projects.bootstrap import ProjectPrefill
from app.projects.bootstrap import ensure_first_project as reserve_first_project
from app.projects.models import Project
from app.projects.schemas import ProjectOut, Questionnaire, Recommendations

QUESTIONNAIRE_FIELDS = (
    "title", "industry", "stage", "project_audience", "audience", "problem",
    "solution_benefit", "mentor_request"
)


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
    fields = {name: getattr(project, name) for name in QUESTIONNAIRE_FIELDS}
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
    fields = questionnaire.model_dump(exclude_unset=True, exclude={"saved_at_ms"})
    changes = {name: value for name, value in fields.items() if getattr(project, name) != value}
    if project.mentor_id is not None and "project_audience" in changes:
        raise api_error(
            409,
            "PROJECT_AUDIENCE_LOCKED",
            "Аудиторию проекта нельзя изменить после начала работы с наставником.",
        )
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
    audience: Audience = Audience.STUDENT,
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
                project_audience=audience.value,
                solution_benefit=project_prefill.solution_benefit or project_prefill.solution,
                mentor_request=project_prefill.mentor_request,
            )
            .on_conflict_do_nothing(index_elements=[Project.id])
        )
    return project_id


def require_complete(project: Project) -> None:
    if not all(getattr(project, name) for name in QUESTIONNAIRE_FIELDS):
        raise api_error(422, "INCOMPLETE_QUESTIONNAIRE", "Заполните семь полей анкеты")


async def list_projects(actor: Actor, db: AsyncSession):
    query = visible_query(actor)
    return [await as_output(db, row) for row in await db.scalars(query.order_by(Project.id))]


async def create(actor: Actor, db: AsyncSession):
    from app.learning.progress import get_learning_outcome

    async with db.begin():
        user = await db.scalar(
            select(User).where(User.id == actor.user_id).with_for_update()
        )
        if user is None:
            raise missing()
        if not (await get_learning_outcome(db, actor.user_id)).can_create_project:
            raise api_error(409, "LEARNING_INCOMPLETE", "Завершите обучение")
        project = Project(
            user_id=actor.user_id,
            project_audience=user.audience or Audience.STUDENT.value,
        )
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
        if data.saved_at_ms is not None and project.saved_at_ms is not None and data.saved_at_ms <= project.saved_at_ms:
            return await as_output(db, project)
        update(project, data)
        if data.saved_at_ms is not None:
            project.saved_at_ms = data.saved_at_ms
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
        questionnaire = {name: getattr(project, name) for name in QUESTIONNAIRE_FIELDS}
        active = list(await db.scalars(select(Mentor).where(Mentor.active).order_by(Mentor.id)))
        active.sort(
            key=lambda mentor: (
                -mentor_match_score(mentor, questionnaire),
                mentor.name.casefold(),
                str(mentor.id),
            )
        )
        profiles = [mentor_profile(mentor) for mentor in active]

    if not profiles:
        return Recommendations(recommendations=[])
    try:
        result = await ai.complete(
            "Recommend mentors by considering the project audience category, target customers, "
            "industry, stage, problem, solution, and mentor request. Treat student, self_employed, "
            "or startup as a primary matching signal. Return concise reasons in Russian.",
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


def mentor_match_score(mentor: Mentor, project: dict) -> int:
    """Put mentors with relevant project experience first for AI and demo ranking."""
    score = 0
    if project.get("industry") in (mentor.industry_codes or []):
        score += 8
    if project.get("stage") in (mentor.project_stage_codes or []):
        score += 6

    category = project.get("project_audience")
    if isinstance(category, Audience):
        category = category.value
    category_terms = {
        Audience.STUDENT.value: (
            "student", "education", "campus", "university", "студент", "обуч"
        ),
        Audience.SELF_EMPLOYED.value: (
            "self-employed", "freelance", "services", "мастер", "услуг", "фриланс"
        ),
        Audience.STARTUP.value: (
            "startup", "mvp", "product", "продукт", "стартап", "технолог"
        ),
    }
    profile_text = " ".join(
        [mentor.headline or "", mentor.about or "", *(mentor.help_topics or [])]
    ).casefold()
    if any(term in profile_text for term in category_terms.get(category, ())):
        score += 4

    request_text = " ".join(
        str(project.get(field) or "")
        for field in ("mentor_request", "problem", "solution_benefit")
    ).casefold()
    request_terms = {term for term in re.findall(r"[\w-]+", request_text) if len(term) >= 4}
    expertise_text = " ".join([mentor.headline or "", *(mentor.help_topics or [])]).casefold()
    score += min(6, sum(term in expertise_text for term in request_terms))
    return score

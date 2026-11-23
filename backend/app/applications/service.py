from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.accompaniment.service import create_plan
from app.applications.models import Application
from app.applications.schemas import (
    ApplicationDetail,
    ApplicationIn,
    ApplicationInboxItem,
    ApplicationOut,
    DecisionIn,
)
from app.auth.models import User
from app.auth.schemas import Actor
from app.auth.tokens import utcnow
from app.errors import api_error
from app.mentors.models import Mentor
from app.projects.models import Project
from app.projects.service import as_output, get_owned, require_complete, require_mutable


async def mentor_id(db: AsyncSession, actor: Actor) -> UUID | None:
    return await db.scalar(select(Mentor.id).where(Mentor.user_id == actor.user_id))


def missing():
    return api_error(404, "APPLICATION_NOT_FOUND", "Заявка не найдена")


def pending(application: Application) -> None:
    if application.status != "pending":
        raise api_error(409, "APPLICATION_CLOSED", "Заявка уже закрыта")


async def list_project(id: UUID, actor: Actor, db: AsyncSession):
    await get_owned(db, id, actor.user_id)
    return list(
        await db.scalars(
            select(Application)
            .where(Application.project_id == id)
            .order_by(Application.created_at, Application.id)
        )
    )


async def apply(id: UUID, data: ApplicationIn, actor: Actor, db: AsyncSession):
    async with db.begin():
        project = await get_owned(db, id, actor.user_id, lock=True)
        require_mutable(project)
        if project.mentor_id is not None:
            raise api_error(409, "MENTOR_ASSIGNED", "Наставник уже назначен")
        require_complete(project)
        mentor = await db.get(Mentor, data.mentor_id)
        if mentor is None or not mentor.active:
            raise api_error(404, "MENTOR_NOT_FOUND", "Наставник недоступен")
        duplicate = await db.scalar(
            select(Application.id).where(
                Application.project_id == id,
                Application.mentor_id == mentor.id,
                Application.status == "pending",
            )
        )
        if duplicate is not None:
            raise api_error(409, "APPLICATION_EXISTS", "Заявка уже отправлена")
        application = Application(
            project_id=id, mentor_id=mentor.id, status="pending", created_at=utcnow()
        )
        db.add(application)
        await db.flush()
    return application


async def inbox(actor: Actor, db: AsyncSession) -> list[ApplicationInboxItem]:
    own = await mentor_id(db, actor)
    if own is None:
        return []
    rows = await db.execute(
        select(Application, Project, User)
        .join(Project, Project.id == Application.project_id)
        .join(User, User.id == Project.user_id)
        .where(Application.mentor_id == own)
        .order_by(Application.created_at, Application.id)
    )
    items = []
    for application, project, applicant in rows:
        item = ApplicationInboxItem.model_validate(application)
        if application.status == "pending" or project.mentor_id == own:
            item.project_title = project.title
            item.applicant_name = " ".join(filter(None, (applicant.first_name, applicant.last_name)))
            item.applicant_name = item.applicant_name or applicant.email
            item.industry = project.industry
            item.stage = project.stage
            item.mentor_request = project.mentor_request
        items.append(item)
    return items


async def detail(id: UUID, actor: Actor, db: AsyncSession):
    application = await db.get(Application, id)
    if application is None:
        raise missing()
    project = await db.get(Project, application.project_id)
    if project is None:
        raise missing()
    if actor.role == "student":
        allowed = project.user_id == actor.user_id
    else:
        own = await mentor_id(db, actor)
        allowed = (
            own is not None
            and application.mentor_id == own
            and (application.status == "pending" or project.mentor_id == own)
        )
    if not allowed:
        raise missing()
    return ApplicationDetail(
        **ApplicationOut.model_validate(application).model_dump(),
        project=await as_output(db, project),
    )


async def decide(id: UUID, data: DecisionIn, actor: Actor, db: AsyncSession):
    async with db.begin():
        own = await mentor_id(db, actor)
        source = await db.scalar(
            select(Application.project_id).where(Application.id == id, Application.mentor_id == own)
        )
        if source is None:
            raise missing()
        project = await db.scalar(select(Project).where(Project.id == source).with_for_update())
        application = await db.get(Application, id, populate_existing=True)
        if project is None or application is None:
            raise missing()
        require_mutable(project)
        pending(application)
        if data.questionnaire_version != project.questionnaire_version:
            raise api_error(409, "STALE_QUESTIONNAIRE", "Откройте актуальную анкету")
        now = utcnow()
        application.decided_at = now
        if data.decision == "reject":
            application.status = "rejected"
        else:
            if project.mentor_id is not None:
                raise api_error(409, "MENTOR_ASSIGNED", "Наставник уже назначен")
            application.status = "accepted"
            project.mentor_id = own
            await create_plan(db, project.id)
            await db.execute(
                update(Application)
                .where(
                    Application.project_id == project.id,
                    Application.id != id,
                    Application.status == "pending",
                )
                .values(
                    status="closed_selected_other", decided_at=now, reason="Выбран другой наставник"
                )
            )
        await db.flush()
    return application


async def withdraw(id: UUID, actor: Actor, db: AsyncSession):
    async with db.begin():
        source = await db.scalar(select(Application.project_id).where(Application.id == id))
        if source is None:
            raise missing()
        project = await get_owned(db, source, actor.user_id, lock=True)
        require_mutable(project)
        application = await db.get(Application, id, populate_existing=True)
        if application is None:
            raise missing()
        pending(application)
        application.status = "withdrawn"
        application.decided_at = utcnow()
    return application

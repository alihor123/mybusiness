"""Create the Ivan Ivanov PRODA showcase account without resetting its progress."""

import asyncio
import json
import secrets
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.accompaniment.models import (
    AccompanimentPlan,
    AccompanimentTask,
    TaskDraft,
    TaskSubmission,
)
from app.accompaniment.service import create_plan
from app.audience import Audience
from app.auth.models import Role, User
from app.auth.service import hash_password, lock_user
from app.auth.tokens import utcnow
from app.database import get_session_factory
from app.learning.models import Attempt, Completion, Credit, Draft, Step, Track
from app.mentors.models import Mentor
from app.projects.models import Project

USER_ID = UUID("00000000-0000-4000-8000-000000000004")
USER_EMAIL = "demo-student-ivan@example.com"
ACCOMPANIMENT_PROJECT_ID = UUID("00000000-0000-4000-8000-000000000022")
DRAFT_PROJECT_ID = UUID("00000000-0000-4000-8000-000000000023")
PROJECTS_FILE = Path(__file__).resolve().parents[1] / "seed_data" / "demo" / "proda_projects.json"
LEARNING_ANSWERS_FILE = Path(__file__).resolve().parents[1] / "seed_data" / "demo" / "proda_learning_answers.json"


async def create_user(db: AsyncSession, password_hash: str) -> None:
    role_id = await db.scalar(select(Role.id).where(Role.code == "student"))
    if role_id is None:
        raise RuntimeError("Student role is missing. Apply the role migrations first.")
    await db.execute(
        insert(User)
        .values(
            id=USER_ID,
            email=USER_EMAIL,
            password_hash=password_hash,
            role_id=role_id,
            first_name="Иван",
            last_name="Иванов",
            is_demo=True,
        )
        .on_conflict_do_nothing(index_elements=[User.id])
    )
    user = await db.get(User, USER_ID)
    if user is None or user.email != USER_EMAIL or user.role_id != role_id or not user.is_demo:
        raise RuntimeError(f"PRODA demo identity conflicts with an existing user: {USER_EMAIL}")


async def seed_projects(db: AsyncSession) -> None:
    projects = json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))
    for row in projects:
        fields = dict(row)
        mentor_slug = fields.pop("mentor_slug", None)
        mentor_id = None
        if mentor_slug:
            mentor_id = await db.scalar(
                select(Mentor.id).where(Mentor.stable_key == f"demo-mentor-{mentor_slug}")
            )
            if mentor_id is None:
                raise RuntimeError(
                    f"Required mentor demo-mentor-{mentor_slug} is missing. "
                    "Run the catalog seed before the PRODA seed."
                )
        project_id = UUID(fields["id"])
        await db.execute(
            insert(Project)
            .values(**fields, user_id=USER_ID, mentor_id=mentor_id)
            .on_conflict_do_nothing(index_elements=[Project.id])
        )
        project = await db.get(Project, project_id)
        if project is None or project.user_id != USER_ID:
            raise RuntimeError(f"PRODA project ID conflicts with another account: {project_id}")
        if mentor_id is not None:
            plan = await create_plan(db, project_id)
            tasks = list(
                await db.scalars(
                    select(AccompanimentTask).where(AccompanimentTask.plan_id == plan.id)
                )
            )
            if not tasks:
                raise RuntimeError("PRODA mentor accompaniment tasks are missing.")
            await seed_accompaniment_showcase(db, tasks)


async def seed_accompaniment_showcase(db: AsyncSession, tasks: list[AccompanimentTask]) -> None:
    """Fill a clean demo plan with examples for all requested task states once."""
    task_ids = [task.id for task in tasks]
    tasks = list(
        await db.scalars(
            select(AccompanimentTask)
            .where(AccompanimentTask.id.in_(task_ids))
            .order_by(AccompanimentTask.position)
            .with_for_update()
        )
    )
    if len(tasks) != 5:
        raise RuntimeError("PRODA demo accompaniment must contain five tasks.")
    if any(task.status != "todo" for task in tasks):
        return
    existing = await db.scalar(
        select(TaskSubmission.id)
        .where(TaskSubmission.task_id.in_([task.id for task in tasks]))
        .limit(1)
    )
    draft = await db.scalar(
        select(TaskDraft.task_id)
        .where(TaskDraft.task_id.in_([task.id for task in tasks]))
        .limit(1)
    )
    if existing is not None or draft is not None:
        return

    now = utcnow()
    examples = {
        1: (
            "Наш проект «Кофе без очереди» помогает студентам заранее заказать напиток в буфете "
            "рядом с кампусом. В часы пик очередь занимает почти всю перемену. Мы начнём с "
            "предзаказа двух напитков в одном университетском буфете.",
            "Вы ясно описали конкретную проблему и ограничили первый запуск одним буфетом. "
            "Хорошая основа для проверки спроса. Засчитываю.",
            "accepted",
        ),
        2: (
            "Я поговорил с двумя одногруппниками. Оба сказали, что в часы пик не успевают купить "
            "кофе между парами. Пока не спрашивал, стали бы они оформлять заказ заранее.",
            "Добавьте ещё три интервью и задавайте вопросы о последней покупке кофе и времени "
            "ожидания. Пока в ответах мало данных о готовности пользоваться предзаказом.",
            "revision_requested",
        ),
        3: (
            "На ближайшие две недели планирую узнать правила буфета, поговорить ещё с тремя "
            "студентами, выбрать два напитка и нарисовать экран предзаказа. За разговоры отвечаю я, "
            "за макет поможет одногруппница. Затем покажем экран студентам и соберём замечания.",
            None,
            "submitted",
        ),
    }
    for position, (answer, comment, status) in examples.items():
        task = tasks[position - 1]
        task.status = status
        submission = TaskSubmission(
            task_id=task.id,
            number=1,
            request_key=f"proda-showcase-task-{position}",
            text=answer,
            status=status,
            decision_comment=comment,
            decided_at=now if status != "submitted" else None,
            created_at=now,
        )
        db.add(submission)
        await db.flush()
        task.current_submission_id = submission.id
        if status == "revision_requested":
            db.add(TaskDraft(task_id=task.id, text=answer, updated_at=now))
    await db.flush()


async def seed_existing_showcase_if_present(db: AsyncSession) -> None:
    """Backfill the showcase plan without recreating a deleted project."""
    project = await db.get(Project, ACCOMPANIMENT_PROJECT_ID)
    if project is None or project.mentor_id is None:
        return
    plan = await db.scalar(
        select(AccompanimentPlan).where(
            AccompanimentPlan.project_id == ACCOMPANIMENT_PROJECT_ID
        )
    )
    if plan is None:
        plan = await create_plan(db, ACCOMPANIMENT_PROJECT_ID)
    tasks = list(
        await db.scalars(
            select(AccompanimentTask)
            .where(AccompanimentTask.plan_id == plan.id)
            .order_by(AccompanimentTask.position)
        )
    )
    if tasks:
        await seed_accompaniment_showcase(db, tasks)


async def seed_learning(db: AsyncSession) -> None:
    await lock_user(db, USER_ID)
    if await db.get(Completion, (USER_ID, Audience.STUDENT.value)) is not None:
        return
    steps = list(
        await db.scalars(
            select(Step)
            .join(Track, Step.track_id == Track.id)
            .where(Track.audience == Audience.STUDENT.value)
            .order_by(Step.track_id, Step.position)
        )
    )
    if not steps:
        raise RuntimeError("Learning content is missing. Apply the content migrations first.")
    for step in steps:
        await db.execute(
            insert(Credit)
            .values(user_id=USER_ID, step_id=step.id, attempt_id=None, credited_at=utcnow())
            .on_conflict_do_nothing(index_elements=[Credit.user_id, Credit.step_id])
        )
    draft = await db.get(Project, DRAFT_PROJECT_ID)
    if draft is None or draft.user_id != USER_ID:
        raise RuntimeError("The PRODA project draft is missing.")
    db.add(
        Completion(
            user_id=USER_ID,
            audience=Audience.STUDENT.value,
            first_project_id=DRAFT_PROJECT_ID,
            project_prefill={
                "title": draft.title,
                "industry": draft.industry,
                "stage": draft.stage,
                "audience": draft.audience,
                "problem": draft.problem,
                "solution_benefit": draft.solution_benefit,
                "mentor_request": draft.mentor_request,
            },
            completed_at=utcnow(),
        )
    )


async def seed_completed_attempts(db: AsyncSession) -> None:
    """Backfill only empty practice steps so existing demo edits remain untouched."""
    await lock_user(db, USER_ID)
    answers = json.loads(LEARNING_ANSWERS_FILE.read_text(encoding="utf-8"))
    completion = await db.get(Completion, (USER_ID, Audience.STUDENT.value))
    for step_id, answer in answers.items():
        step = await db.get(Step, step_id)
        if step is None:
            raise RuntimeError(f"Learning step is missing: {step_id}")
        existing_attempt = await db.scalar(
            select(Attempt.id)
            .where(Attempt.user_id == USER_ID, Attempt.step_id == step_id)
            .limit(1)
        )
        if existing_attempt is not None or await db.get(Draft, (USER_ID, step_id)) is not None:
            continue
        attempt = Attempt(
            user_id=USER_ID,
            step_id=step_id,
            number=1,
            request_key=f"proda-seed-{step_id}",
            answer=answer,
            status="accepted",
            remarks=[],
        )
        if step.type == "final":
            attempt.prefill_status = "succeeded"
            attempt.project_prefill = completion.project_prefill if completion else {}
        db.add(attempt)


async def main() -> None:
    hashed = await hash_password(secrets.token_urlsafe(48))
    async with get_session_factory()() as db, db.begin():
        await create_user(db, hashed)
        # Completion marks a successful first seed. Leave deleted or edited demo
        # projects alone on later deploys instead of recreating them.
        if await db.get(Completion, (USER_ID, Audience.STUDENT.value)) is None:
            await seed_projects(db)
            await seed_learning(db)
        else:
            await seed_existing_showcase_if_present(db)
        await seed_completed_attempts(db)
    print(f"PRODA demo account ready: {USER_EMAIL}")


if __name__ == "__main__":
    asyncio.run(main())

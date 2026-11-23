"""Create the Ivan Ivanov PRODA showcase account without resetting its progress."""

import asyncio
import json
import secrets
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.accompaniment.models import AccompanimentPlan, AccompanimentTask
from app.accompaniment.service import create_plan
from app.auth.models import Role, User
from app.auth.service import hash_password, lock_user
from app.auth.tokens import utcnow
from app.database import get_session_factory
from app.learning.models import Completion, Credit, Step
from app.mentors.models import Mentor
from app.projects.models import Project

USER_ID = UUID("00000000-0000-4000-8000-000000000004")
USER_EMAIL = "demo-student-ivan@example.com"
ACCOMPANIMENT_PROJECT_ID = UUID("00000000-0000-4000-8000-000000000022")
DRAFT_PROJECT_ID = UUID("00000000-0000-4000-8000-000000000023")
PROJECTS_FILE = Path(__file__).resolve().parents[1] / "seed_data" / "demo" / "proda_projects.json"


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
            if not tasks or any(task.status != "todo" for task in tasks):
                raise RuntimeError("PRODA mentor tasks must all start in todo status.")


async def seed_learning(db: AsyncSession) -> None:
    await lock_user(db, USER_ID)
    if await db.get(Completion, USER_ID) is not None:
        return
    steps = list(await db.scalars(select(Step).order_by(Step.track_id, Step.position)))
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


async def main() -> None:
    hashed = await hash_password(secrets.token_urlsafe(48))
    async with get_session_factory()() as db, db.begin():
        await create_user(db, hashed)
        # Completion marks a successful first seed. Leave deleted or edited demo
        # projects alone on later deploys instead of recreating them.
        if await db.get(Completion, USER_ID) is None:
            await seed_projects(db)
            await seed_learning(db)
    print(f"PRODA demo account ready: {USER_EMAIL}")


if __name__ == "__main__":
    asyncio.run(main())

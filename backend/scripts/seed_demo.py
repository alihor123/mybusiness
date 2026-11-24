"""Load demo-only accounts without resetting existing work."""

import asyncio
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.audience import Audience
from app.auth.models import Role, User
from app.auth.service import hash_password, lock_user
from app.auth.tokens import utcnow
from app.config import get_settings
from app.database import get_session_factory
from app.events.seed import import_demo_events
from app.learning.models import Attempt, Completion, Credit, Step, Track
from app.learning.progress import finish_if_ready
from app.mentors.models import Mentor
from app.mentors.seed import import_demo_mentors
from app.projects.bootstrap import ProjectPrefill
from app.projects.seed import seed_projects

START_ID = UUID("00000000-0000-4000-8000-000000000001")
COMPLETE_ID = UUID("00000000-0000-4000-8000-000000000002")
TEACHER_ID = UUID("00000000-0000-4000-8000-000000000003")
SHOWCASE_EMAILS = {
    "demo-mentor-gordon-ramsay": "demo-mentor-food@example.com",
    "demo-mentor-lisa-su": "demo-mentor-it@example.com",
}
PREFILL = ProjectPrefill(
    title="Кофе между парами",
    audience="Студенты, покупающие кофе на короткой перемене",
    problem="Очередь занимает большую часть перемены",
    solution="Предзаказ напитка к началу перемены и быстрая выдача",
    completed_actions="План бесед со студентами и пробного дня с кофейней",
)


async def create_user(
    db: AsyncSession,
    user_id: UUID,
    email: str,
    role_code: str,
    display_name: str,
    hashed: str,
    previous_email: str | None = None,
) -> None:
    role_id = (await db.scalars(select(Role.id).where(Role.code == role_code))).one()
    first_name, _, last_name = display_name.partition(" ")
    await db.execute(
        insert(User)
        .values(
            id=user_id,
            email=email,
            password_hash=hashed,
            role_id=role_id,
            first_name=first_name,
            last_name=last_name or None,
        )
        .on_conflict_do_nothing(index_elements=[User.id])
    )
    user = await db.get(User, user_id)
    if user is not None and user.role_id == role_id and user.email == previous_email:
        user.email = email
        user.first_name = first_name
        user.last_name = last_name or None
    if user is None or user.email != email or user.role_id != role_id:
        raise RuntimeError(f"Demo identity conflicts with an existing user: {email}")


async def complete_demo(db: AsyncSession) -> None:
    await lock_user(db, COMPLETE_ID)
    if await db.get(Completion, (COMPLETE_ID, Audience.STUDENT.value)) is not None:
        return
    steps = await db.scalars(
        select(Step)
        .join(Track, Step.track_id == Track.id)
        .where(Track.audience == Audience.STUDENT.value)
        .order_by(Step.track_id, Step.position)
    )
    for step in steps:
        if await db.get(Credit, (COMPLETE_ID, step.id)) is not None:
            continue
        attempt_id = None
        if step.type not in {"theory", "video"}:
            attempt = Attempt(
                user_id=COMPLETE_ID,
                step_id=step.id,
                number=1,
                request_key=f"demo-{step.id}",
                answer=step.answer_key or PREFILL.model_dump_json(exclude_none=True),
                status="accepted",
                remarks=[],
            )
            if step.type == "final":
                attempt.prefill_status = "succeeded"
                attempt.project_prefill = PREFILL.model_dump(exclude_none=True)
            db.add(attempt)
            await db.flush()
            attempt_id = attempt.id
        db.add(
            Credit(
                user_id=COMPLETE_ID,
                step_id=step.id,
                attempt_id=attempt_id,
                credited_at=utcnow(),
            )
        )
    await db.flush()
    await finish_if_ready(db, COMPLETE_ID, Audience.STUDENT)
    if await db.get(Completion, (COMPLETE_ID, Audience.STUDENT.value)) is None:
        raise RuntimeError("Expected completed demo learning. Apply the content migrations first.")


async def main() -> None:
    settings = get_settings()
    password = settings.demo_password.get_secret_value()
    if len(password) < 8 and not (settings.local_demo_mode or settings.simplified_registration):
        raise SystemExit("Short demo passwords are allowed only with LOCAL_DEMO_MODE or SIMPLIFIED_REGISTRATION.")
    if not 5 <= len(password) <= 256:
        raise SystemExit("Set DEMO_PASSWORD to 5–256 characters in the demo environment.")
    hashed = await hash_password(password)
    async with get_session_factory()() as db, db.begin():
        await create_user(db, START_ID, "demo-student-start@example.com", "student", "Алексей Миронов", hashed)
        await create_user(db, COMPLETE_ID, "demo-student-complete@example.com", "student", "Мария Соколова", hashed)
        await create_user(db, TEACHER_ID, "demo-teacher@example.com", "teacher", "Ирина Белова", hashed)
        await complete_demo(db)
        await import_demo_mentors(db)
        for mentor in await db.scalars(select(Mentor).where(Mentor.showcase_login)):
            previous_email = f"{mentor.stable_key}@example.com"
            email = SHOWCASE_EMAILS.get(mentor.stable_key, previous_email)
            user_id = uuid5(NAMESPACE_URL, f"mybusiness:teacher:{mentor.stable_key}")
            await create_user(db, user_id, email, "teacher", mentor.name, hashed, previous_email)
            mentor.user_id = user_id
        await import_demo_events(db)
        await seed_projects(db, COMPLETE_ID)

    print(
        "Demo accounts ready: demo-student-start@example.com, demo-student-complete@example.com, "
        "demo-teacher@example.com, demo-mentor-food@example.com, demo-mentor-it@example.com"
    )


if __name__ == "__main__":
    asyncio.run(main())

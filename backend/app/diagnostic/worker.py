import asyncio
import logging
from datetime import timedelta
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.ai.client import CheckUnavailable, get_deepseek
from app.auth.service import lock_user
from app.auth.tokens import utcnow
from app.database import get_session_factory
from app.diagnostic.models import Diagnostic
from app.diagnostic.service import get_questions, score_answers
from app.learning.models import DiagnosticCredit, Step
from app.learning.progress import finish_if_ready

logger = logging.getLogger(__name__)
CHECK_LEASE_SECONDS = 120


async def process_diagnostic(
    user_id: UUID,
    db_factory: async_sessionmaker[AsyncSession],
    ai_client=None,
) -> bool:
    """Захватывает и завершает одно сохранённое диагностическое задание."""
    async with db_factory() as db, db.begin():
        await lock_user(db, user_id)
        attempt = await db.get(Diagnostic, user_id, populate_existing=True)
        if (
            attempt is None
            or attempt.status != "checking"
            or attempt.check_deadline is None
            or attempt.check_deadline > utcnow()
        ):
            return False
        check_id = uuid4()
        attempt.check_id = check_id
        attempt.check_deadline = utcnow() + timedelta(seconds=CHECK_LEASE_SECONDS)
        answers = dict(attempt.answers)
        questions = await get_questions(db, attempt.version)

    try:
        scores = await score_answers(ai_client or get_deepseek(), questions, answers)
    except CheckUnavailable:
        await release_check(user_id, db_factory, check_id)
        return True
    except asyncio.CancelledError:
        await release_check(user_id, db_factory, check_id, requeue=True)
        raise
    except Exception:
        await release_check(user_id, db_factory, check_id)
        logger.exception("Diagnostic check failed for user %s", user_id)
        return False

    async with db_factory() as db, db.begin():
        await lock_user(db, user_id)
        attempt = await db.get(Diagnostic, user_id, populate_existing=True)
        if attempt is None or attempt.check_id != check_id or attempt.status != "checking":
            return False
        attempt.scores = scores
        attempt.status = "completed"
        attempt.check_id = None
        attempt.check_deadline = None
        attempt.check_unavailable = False
        await db.flush()
        for track_id, score in scores.items():
            optional_step_ids = await db.scalars(
                select(Step.id).where(
                    Step.track_id == track_id,
                    Step.optional_rank <= max(0, score - 1),
                )
            )
            for step_id in optional_step_ids:
                await db.execute(
                    insert(DiagnosticCredit)
                    .values(
                        user_id=user_id,
                        step_id=step_id,
                        diagnostic_version=attempt.version,
                        credited_at=utcnow(),
                    )
                    .on_conflict_do_nothing(index_elements=[DiagnosticCredit.user_id, DiagnosticCredit.step_id])
                )
        await finish_if_ready(db, user_id)
    return True


async def release_check(
    user_id: UUID,
    db_factory: async_sessionmaker[AsyncSession],
    check_id: UUID,
    *,
    requeue: bool = False,
) -> None:
    async with db_factory() as db, db.begin():
        await lock_user(db, user_id)
        attempt = await db.get(Diagnostic, user_id, populate_existing=True)
        if attempt is not None and attempt.check_id == check_id:
            attempt.status = "checking" if requeue else "in_progress"
            attempt.check_id = None
            attempt.check_deadline = utcnow() if requeue else None
            attempt.check_unavailable = not requeue


async def process_pending_once(
    db_factory: async_sessionmaker[AsyncSession] | None = None,
    ai_client=None,
) -> int:
    """Обрабатывает задания с истёкшей lease, включая восстановление после рестарта."""
    factory = db_factory or get_session_factory()
    async with factory() as db:
        user_ids = list(await db.scalars(
            select(Diagnostic.user_id)
            .where(
                Diagnostic.status == "checking",
                Diagnostic.check_deadline <= utcnow(),
            )
            .order_by(Diagnostic.check_deadline)
            .limit(20)
        ))
    semaphore = asyncio.Semaphore(3)

    async def bounded_process(user_id: UUID) -> bool:
        async with semaphore:
            return await process_diagnostic(user_id, factory, ai_client)

    results = await asyncio.gather(*(bounded_process(user_id) for user_id in user_ids))
    return sum(results)


async def run_diagnostic_worker(stop_event: asyncio.Event, *, interval: float = 1.0) -> None:
    """Проверяет durable jobs до сигнала остановки приложения."""
    while not stop_event.is_set():
        try:
            await process_pending_once()
        except Exception:
            logger.exception("Diagnostic worker iteration failed")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval)
        except TimeoutError:
            pass

import json
from time import time_ns
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import CheckUnavailable
from app.audience import Audience
from app.auth.service import lock_user
from app.auth.tokens import utcnow
from app.diagnostic.models import Diagnostic, Question
from app.diagnostic.schemas import DiagnosticOut, Draft, FreeScores, QuestionOut, Submit, TrackScore
from app.errors import api_error
from app.learning.assessment import conflict, invalid_answer, validate_answer

DIAGNOSTIC_VERSIONS = {
    Audience.STUDENT: 1,
    Audience.SELF_EMPLOYED: 2,
    Audience.STARTUP: 3,
}
FREE_EXAMPLES = {
    "diag-idea-free": (
        "На большой перемене у буфета корпуса Б спрошу трёх студентов, которые ушли из очереди. "
        "Вопрос: «Что вы сделали в последний раз, когда у буфета была очередь?»"
    ),
    "diag-mvp-free": (
        "До начала перемены студент выбирает напиток в форме и получает номер заказа. "
        "На перемене забирает кофе по номеру у входа. Успех — минимум 6 из 10 заказавших забрали кофе за 10 минут."
    ),
    "diag-sales-free": (
        "Студенты корпуса Б, заберите кофе у входа без очереди на большой перемене. "
        "Капучино стоит 150 ₽. Чтобы заказать, напишите «кофе» в чат корпуса до 11:30."
    ),
}


async def get_questions(db: AsyncSession, version: int) -> list[Question]:
    return list(await db.scalars(select(Question).where(Question.version == version).order_by(Question.position)))


def response(
    attempt: Diagnostic | None, questions: list[Question], audience: Audience
) -> DiagnosticOut:
    scores = attempt.scores if attempt else None
    return DiagnosticOut(
        audience=audience,
        version=DIAGNOSTIC_VERSIONS[audience],
        status=attempt.status if attempt else "not_started",
        questions=[QuestionOut.model_validate(question) for question in questions],
        current_question_id=(attempt.current_question_id if attempt else questions[0].id if questions else None),
        answers=attempt.answers if attempt else {},
        results=[
            TrackScore(track_id=track_id, score=scores[track_id], optional_exercises=max(0, scores[track_id] - 1))
            for track_id in dict.fromkeys(question.track_id for question in questions)
        ] if scores is not None else None,
        check_unavailable=bool(attempt and attempt.check_unavailable),
    )


async def get_diagnostic(db: AsyncSession, user_id: UUID, audience: Audience) -> DiagnosticOut:
    version = DIAGNOSTIC_VERSIONS[audience]
    attempt = await db.get(Diagnostic, (user_id, version))
    questions = await get_questions(db, version)
    return response(attempt, questions, audience)


async def editable(
    db: AsyncSession, user_id: UUID, audience: Audience
) -> tuple[Diagnostic, list[Question]]:
    await lock_user(db, user_id)
    version = DIAGNOSTIC_VERSIONS[audience]
    attempt = await db.get(Diagnostic, (user_id, version), populate_existing=True)
    questions = await get_questions(db, version)
    if not questions:
        raise api_error(503, "DIAGNOSTIC_UNAVAILABLE", "Диагностика пока недоступна")
    if attempt is None:
        attempt = Diagnostic(
            user_id=user_id,
            version=version,
            status="in_progress",
            current_question_id=questions[0].id,
            answers={},
            scores=None,
            check_unavailable=False,
        )
        db.add(attempt)
    return attempt, questions


async def save_draft(
    db: AsyncSession, user_id: UUID, data: Draft, audience: Audience
) -> DiagnosticOut:
    async with db.begin():
        attempt, questions = await editable(db, user_id, audience)
        if attempt.status == "completed":
            return response(attempt, questions, audience)
        if attempt.status == "checking":
            raise conflict("CHECK_IN_PROGRESS", "Ответы сохранены и проверяются")
        apply_draft(attempt, questions, data)
        return response(attempt, questions, audience)


def apply_draft(attempt: Diagnostic, questions: list[Question], data: Draft) -> None:
    if data.saved_at_ms is not None and attempt.saved_at_ms is not None and data.saved_at_ms <= attempt.saved_at_ms:
        return
    by_id = {question.id: question for question in questions}
    if data.current_question_id not in by_id or not data.answers.keys() <= by_id.keys():
        raise invalid_answer()
    for question_id, answer in data.answers.items():
        question = by_id[question_id]
        validate_answer(question.type, question.options, answer, partial=True)
    attempt.answers = data.answers
    attempt.current_question_id = data.current_question_id
    attempt.status = "in_progress"
    attempt.check_unavailable = False
    if data.saved_at_ms is not None:
        attempt.saved_at_ms = data.saved_at_ms


async def skip(
    db: AsyncSession, user_id: UUID, data: Draft | None, audience: Audience
) -> DiagnosticOut:
    async with db.begin():
        attempt, questions = await editable(db, user_id, audience)
        if attempt.status == "checking":
            raise conflict("CHECK_IN_PROGRESS", "Дождитесь завершения проверки")
        if attempt.status != "completed":
            if data is not None:
                apply_draft(attempt, questions, data)
            attempt.status = "skipped"
            clock = data.saved_at_ms if data and data.saved_at_ms is not None else time_ns() // 1_000_000
            attempt.saved_at_ms = max(attempt.saved_at_ms or 0, clock)
            attempt.check_id = None
            attempt.check_deadline = None
            attempt.check_unavailable = False
        return response(attempt, questions, audience)


async def restart(db: AsyncSession, user_id: UUID, audience: Audience) -> DiagnosticOut:
    async with db.begin():
        attempt, questions = await editable(db, user_id, audience)
        if attempt.status not in {"completed", "skipped"}:
            raise conflict("DIAGNOSTIC_NOT_RESTARTABLE", "Завершите или пропустите текущую диагностику")
        attempt.status = "in_progress"
        attempt.saved_at_ms = max(attempt.saved_at_ms or 0, time_ns() // 1_000_000)
        attempt.current_question_id = questions[0].id
        attempt.answers = {}
        attempt.check_id = None
        attempt.check_deadline = None
        attempt.check_unavailable = False
        return response(attempt, questions, audience)


async def submit(
    db: AsyncSession, user_id: UUID, data: Submit, audience: Audience
) -> DiagnosticOut:
    async with db.begin():
        attempt, questions = await editable(db, user_id, audience)
        if attempt.status == "completed":
            return response(attempt, questions, audience)
        if attempt.status == "checking":
            if data.answers != attempt.answers:
                raise conflict("DIAGNOSTIC_SNAPSHOT_CHANGED", "Сохраните новые ответы перед проверкой")
            return response(attempt, questions, audience)
        question_ids = {question.id for question in questions}
        if data.answers.keys() != question_ids:
            raise invalid_answer()
        for question in questions:
            validate_answer(question.type, question.options, data.answers[question.id])
        attempt.answers = data.answers
        attempt.current_question_id = questions[-1].id
        attempt.status = "checking"
        attempt.check_unavailable = False
        attempt.check_id = None
        # Срок сразу наступил: фоновый обработчик подхватит задание после commit.
        attempt.check_deadline = utcnow()
        attempt.saved_at_ms = max(attempt.saved_at_ms or 0, data.saved_at_ms or time_ns() // 1_000_000)
        return response(attempt, questions, audience)


async def score_answers(ai, questions: list[Question], answers: dict) -> dict[str, int]:
    scores = dict.fromkeys((question.track_id for question in questions), 0)
    free = []
    for question in questions:
        answer = answers[question.id]
        if question.type == "free":
            free.append({
                "id": question.id,
                "prompt": question.prompt,
                "criteria": question.criteria,
                "reference_answer": FREE_EXAMPLES.get(question.id),
                "answer": answer,
            })
        elif answer == question.answer_key:
            scores[question.track_id] += 1
    result = await ai.complete(
        "Оцени каждый свободный ответ по условию и его критериям. Пример показывает допустимую конкретику. "
        "Засчитывай равноценные самостоятельные ответы. Верни scores с указанными ID и булевыми оценками.",
        json.dumps(free, ensure_ascii=False),
        FreeScores,
    )
    if result.scores.keys() != {item["id"] for item in free}:
        raise CheckUnavailable("AI вернул неверный набор ID диагностических вопросов")
    for question in questions:
        if result.scores.get(question.id):
            scores[question.track_id] += 1
    return scores

import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import CheckUnavailable
from app.auth.service import lock_user
from app.auth.tokens import utcnow
from app.diagnostic.models import Diagnostic, Question
from app.diagnostic.schemas import DiagnosticOut, Draft, FreeScores, QuestionOut, Submit, TrackScore
from app.errors import api_error
from app.learning.assessment import conflict, invalid_answer, validate_answer

VERSION = 1


async def get_questions(db: AsyncSession, version: int) -> list[Question]:
    return list(await db.scalars(select(Question).where(Question.version == version).order_by(Question.position)))


def response(attempt: Diagnostic | None, questions: list[Question]) -> DiagnosticOut:
    scores = attempt.scores if attempt else None
    return DiagnosticOut(
        version=attempt.version if attempt else VERSION,
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


async def get_diagnostic(db: AsyncSession, user_id: UUID) -> DiagnosticOut:
    attempt = await db.get(Diagnostic, user_id)
    questions = await get_questions(db, attempt.version if attempt else VERSION)
    return response(attempt, questions)


async def editable(db: AsyncSession, user_id: UUID) -> tuple[Diagnostic, list[Question]]:
    await lock_user(db, user_id)
    attempt = await db.get(Diagnostic, user_id, populate_existing=True)
    questions = await get_questions(db, attempt.version if attempt else VERSION)
    if not questions:
        raise api_error(503, "DIAGNOSTIC_UNAVAILABLE", "Диагностика пока недоступна")
    if attempt is None:
        attempt = Diagnostic(
            user_id=user_id,
            version=VERSION,
            status="in_progress",
            current_question_id=questions[0].id,
            answers={},
            scores=None,
            check_unavailable=False,
        )
        db.add(attempt)
    return attempt, questions


async def save_draft(db: AsyncSession, user_id: UUID, data: Draft) -> DiagnosticOut:
    async with db.begin():
        attempt, questions = await editable(db, user_id)
        if attempt.status == "completed":
            return response(attempt, questions)
        if attempt.status == "checking":
            raise conflict("CHECK_IN_PROGRESS", "Ответы сохранены и проверяются")
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
        return response(attempt, questions)


async def skip(db: AsyncSession, user_id: UUID) -> DiagnosticOut:
    async with db.begin():
        attempt, questions = await editable(db, user_id)
        if attempt.status == "checking":
            raise conflict("CHECK_IN_PROGRESS", "Дождитесь завершения проверки")
        if attempt.status != "completed":
            attempt.status = "skipped"
            attempt.check_id = None
            attempt.check_deadline = None
            attempt.check_unavailable = False
        return response(attempt, questions)


async def restart(db: AsyncSession, user_id: UUID) -> DiagnosticOut:
    async with db.begin():
        attempt, questions = await editable(db, user_id)
        if attempt.status not in {"completed", "skipped"}:
            raise conflict("DIAGNOSTIC_NOT_RESTARTABLE", "Завершите или пропустите текущую диагностику")
        attempt.status = "in_progress"
        attempt.current_question_id = questions[0].id
        attempt.answers = {}
        attempt.check_id = None
        attempt.check_deadline = None
        attempt.check_unavailable = False
        return response(attempt, questions)


async def submit(db: AsyncSession, user_id: UUID, data: Submit) -> DiagnosticOut:
    async with db.begin():
        attempt, questions = await editable(db, user_id)
        if attempt.status == "completed":
            return response(attempt, questions)
        if attempt.status == "checking":
            if data.answers != attempt.answers:
                raise conflict("DIAGNOSTIC_SNAPSHOT_CHANGED", "Сохраните новые ответы перед проверкой")
            return response(attempt, questions)
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
        return response(attempt, questions)


async def score_answers(ai, questions: list[Question], answers: dict) -> dict[str, int]:
    scores = dict.fromkeys((question.track_id for question in questions), 0)
    free = []
    for question in questions:
        answer = answers[question.id]
        if question.type == "free":
            free.append({"id": question.id, "prompt": question.prompt, "criteria": question.criteria, "answer": answer})
        elif answer == question.answer_key:
            scores[question.track_id] += 1
    result = await ai.complete(
        "Оцени каждый свободный ответ по его критериям. Верни scores с указанными ID и булевыми оценками.",
        json.dumps(free, ensure_ascii=False),
        FreeScores,
    )
    if result.scores.keys() != {item["id"] for item in free}:
        raise CheckUnavailable("AI вернул неверный набор ID диагностических вопросов")
    for question in questions:
        if result.scores.get(question.id):
            scores[question.track_id] += 1
    return scores

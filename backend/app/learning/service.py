import json
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import CheckUnavailable, DeepSeekClient
from app.auth.service import lock_user
from app.auth.tokens import utcnow
from app.errors import api_error, check_unavailable
from app.learning.assessment import (
    CHECK_LEASE,
    CheckDecision,
    claim_check,
    conflict,
    validate_answer,
)
from app.learning.models import Attempt, Credit, Draft, Step, Track, TrackPosition
from app.learning.progress import finish_if_ready, get_progress, get_route
from app.learning.schemas import (
    AttemptOut,
    CompletionIn,
    DraftIn,
    HelpIn,
    Hint,
    StepOut,
    SubmissionIn,
    SubmissionOut,
    TrackDetail,
    TrackOut,
)
from app.projects.bootstrap import ProjectPrefill

MEDIA_EVENTS = {"theory": "text_end", "video": "video_end"}
TERMINAL = {"accepted", "rejected"}


async def get_step(db: AsyncSession, step_id: str) -> Step:
    step = await db.get(Step, step_id)
    if step is None:
        raise api_error(404, "STEP_NOT_FOUND", "Шаг не найден")
    return step


async def step_out(db: AsyncSession, user_id: UUID, step: Step) -> StepOut:
    route = await get_route(db, user_id)
    draft = await db.get(Draft, (user_id, step.id))
    last_attempt = await db.scalar(
        select(Attempt)
        .where(
            Attempt.user_id == user_id,
            Attempt.step_id == step.id,
        )
        .order_by(Attempt.number.desc())
        .limit(1)
    )
    return StepOut(
        **route.summarize(step).model_dump(),
        track_id=step.track_id,
        blocks=step.blocks,
        prompt=step.prompt,
        options=step.options,
        draft=draft.answer if draft else None,
        last_attempt=attempt_out(last_attempt) if last_attempt else None,
    )


def attempt_out(attempt: Attempt) -> AttemptOut:
    return AttemptOut(
        id=attempt.id,
        number=attempt.number,
        request_key=attempt.request_key,
        answer=attempt.answer,
        status=attempt.status,
        remarks=attempt.remarks,
        accepted=(attempt.status == "accepted") if attempt.status in TERMINAL else None,
        prefill_status=attempt.prefill_status,
    )


async def tracks(db: AsyncSession, user_id: UUID) -> list[TrackOut]:
    route = await get_route(db, user_id)
    return [route.track_out(track) for track in route.tracks]


async def track_detail(db: AsyncSession, user_id: UUID, track_id: str) -> TrackDetail:
    track = await db.get(Track, track_id)
    if track is None:
        raise api_error(404, "TRACK_NOT_FOUND", "Трек не найден")
    route = await get_route(db, user_id)
    return TrackDetail(
        **route.track_out(track).model_dump(),
        steps=[route.summarize(step) for step in route.steps[track_id]],
    )


async def update_position(db: AsyncSession, user_id: UUID, step: Step) -> None:
    await db.execute(
        insert(TrackPosition)
        .values(
            user_id=user_id,
            track_id=step.track_id,
            step_id=step.id,
        )
        .on_conflict_do_update(
            index_elements=[TrackPosition.user_id, TrackPosition.track_id],
            set_={"step_id": step.id},
        )
    )


async def save_draft(db: AsyncSession, user_id: UUID, step_id: str, data: DraftIn) -> StepOut:
    async with db.begin():
        await lock_user(db, user_id)
        step = await get_step(db, step_id)
        if data.answer is not None:
            if step.type in MEDIA_EVENTS:
                raise api_error(422, "NO_ANSWER_EXPECTED", "У материала нет поля ответа")
            validate_answer(step.type, step.options, data.answer, partial=True)
            await db.execute(
                insert(Draft)
                .values(
                    user_id=user_id,
                    step_id=step.id,
                    answer=data.answer,
                )
                .on_conflict_do_update(
                    index_elements=[Draft.user_id, Draft.step_id],
                    set_={"answer": data.answer},
                )
            )
        elif "answer" in data.model_fields_set:
            await db.execute(
                delete(Draft).where(Draft.user_id == user_id, Draft.step_id == step_id)
            )
        await update_position(db, user_id, step)
        return await step_out(db, user_id, step)


async def require_available(db: AsyncSession, user_id: UUID, step: Step) -> None:
    summary = (await get_route(db, user_id)).summarize(step)
    if summary.credited:
        raise conflict("STEP_ALREADY_CREDITED", "Шаг уже зачтён")
    if not summary.can_credit:
        raise conflict("STEP_OUT_OF_ORDER", "Сначала завершите предыдущий обязательный шаг")


async def record_credit(
    db: AsyncSession,
    user_id: UUID,
    step: Step,
    attempt_id: UUID | None = None,
) -> None:
    db.add(Credit(user_id=user_id, step_id=step.id, attempt_id=attempt_id, credited_at=utcnow()))
    await update_position(db, user_id, step)
    await db.flush()


async def complete(db: AsyncSession, user_id: UUID, step_id: str, data: CompletionIn):
    async with db.begin():
        await lock_user(db, user_id)
        step = await get_step(db, step_id)
        if MEDIA_EVENTS.get(step.type) != data.event:
            raise api_error(422, "INVALID_COMPLETION_EVENT", "Событие не подходит для этого шага")
        if await db.get(Credit, (user_id, step_id)) is None:
            await require_available(db, user_id, step)
            await record_credit(db, user_id, step)
        await finish_if_ready(db, user_id)
        return await get_progress(db, user_id)


async def submission_out(db: AsyncSession, user_id: UUID, attempt: Attempt) -> SubmissionOut:
    return SubmissionOut(attempt=attempt_out(attempt), progress=await get_progress(db, user_id))


async def start_submission(
    db: AsyncSession,
    user_id: UUID,
    step_id: str,
    data: SubmissionIn,
) -> tuple[Attempt, Step]:
    await lock_user(db, user_id)
    step = await get_step(db, step_id)
    if step.type in MEDIA_EVENTS:
        raise api_error(422, "NO_ANSWER_EXPECTED", "У материала нет поля ответа")
    attempt = await db.scalar(
        select(Attempt).where(
            Attempt.user_id == user_id,
            Attempt.step_id == step_id,
            Attempt.request_key == data.request_key,
        )
    )
    if attempt is not None:
        if attempt.answer != data.answer:
            raise conflict("REQUEST_KEY_REUSED", "Этот ключ уже связан с другим ответом")
        return attempt, step

    await require_available(db, user_id, step)
    validate_answer(step.type, step.options, data.answer)
    running = await db.scalar(
        select(Attempt.id)
        .where(
            Attempt.user_id == user_id,
            Attempt.step_id == step_id,
            Attempt.status == "checking",
            Attempt.check_deadline > utcnow(),
        )
        .limit(1)
    )
    if running is not None:
        raise conflict("CHECK_IN_PROGRESS", "Проверка уже выполняется")
    number = await db.scalar(
        select(func.max(Attempt.number)).where(
            Attempt.user_id == user_id,
            Attempt.step_id == step_id,
        )
    )
    attempt = Attempt(
        user_id=user_id,
        step_id=step_id,
        request_key=data.request_key,
        number=(number or 0) + 1,
        answer=data.answer,
        status="checking",
        remarks=[],
    )
    db.add(attempt)
    await update_position(db, user_id, step)
    return attempt, step


async def save_decision(
    db: AsyncSession,
    attempt: Attempt,
    step: Step,
    decision: CheckDecision,
) -> None:
    attempt.status = "accepted" if decision.accepted else "rejected"
    attempt.remarks = decision.remarks
    attempt.check_id = None
    attempt.check_deadline = None
    if decision.accepted:
        await db.execute(
            delete(Draft).where(
                Draft.user_id == attempt.user_id,
                Draft.step_id == step.id,
            )
        )
        await record_credit(db, attempt.user_id, step, attempt.id)


async def submit(
    db: AsyncSession,
    ai: DeepSeekClient,
    user_id: UUID,
    step_id: str,
    data: SubmissionIn,
) -> SubmissionOut:
    async with db.begin():
        attempt, step = await start_submission(db, user_id, step_id, data)
        extracting = attempt.prefill_status == "checking"
        if attempt.status in TERMINAL and not extracting:
            await finish_if_ready(db, user_id)
            return await submission_out(db, user_id, attempt)
        if step.type in {"choice", "matching"}:
            accepted = attempt.answer == step.answer_key
            remarks = [] if accepted else ["Сверьте свой выбор с условием и попробуйте ещё раз."]
            await db.flush()
            await save_decision(
                db, attempt, step, CheckDecision(accepted=accepted, remarks=remarks)
            )
            await finish_if_ready(db, user_id)
            return await submission_out(db, user_id, attempt)
        if not extracting:
            await require_available(db, user_id, step)
            other_check = (
                await db.scalar(
                    select(Attempt.id)
                    .where(
                        Attempt.user_id == user_id,
                        Attempt.step_id == step.id,
                        Attempt.id != attempt.id,
                        Attempt.status == "checking",
                        Attempt.check_deadline > utcnow(),
                    )
                    .limit(1)
                )
                if attempt.id is not None
                else None
            )
            if other_check is not None:
                raise conflict("CHECK_IN_PROGRESS", "Проверка уже выполняется")
            attempt.status = "checking"
        attempt.check_id, attempt.check_deadline = claim_check(attempt.check_deadline)
        await db.flush()
        check_id = attempt.check_id
        attempt_id = attempt.id

    if not extracting:
        decision = await check_written(db, ai, attempt_id, check_id, user_id, step, data)
        if decision is not None:
            return decision
    return await extract_prefill(db, ai, attempt_id, check_id, user_id, data)


async def checked_attempt(
    db: AsyncSession,
    user_id: UUID,
    attempt_id: UUID,
    check_id: UUID,
) -> Attempt:
    await lock_user(db, user_id)
    attempt = await db.get(Attempt, attempt_id, populate_existing=True)
    if attempt is None or attempt.check_id != check_id:
        raise conflict("STALE_CHECK", "Проверка уже заменена другим запросом")
    return attempt


async def check_written(
    db: AsyncSession,
    ai: DeepSeekClient,
    attempt_id: UUID,
    check_id: UUID,
    user_id: UUID,
    step: Step,
    data: SubmissionIn,
) -> SubmissionOut | None:
    try:
        decision = await ai.complete(
            "Проверь ответ по критериям. Дай конкретные замечания на русском языке.",
            json.dumps(
                {
                    "prompt": step.prompt,
                    "criteria": step.criteria,
                    "answer": data.answer,
                },
                ensure_ascii=False,
            ),
            CheckDecision,
        )
    except CheckUnavailable as exc:
        async with db.begin():
            attempt = await checked_attempt(db, user_id, attempt_id, check_id)
            attempt.status = "check_unavailable"
            attempt.check_id = None
            attempt.check_deadline = None
        raise check_unavailable() from exc

    async with db.begin():
        attempt = await checked_attempt(db, user_id, attempt_id, check_id)
        if decision.accepted:
            await require_available(db, user_id, step)
        await save_decision(db, attempt, step, decision)
        if decision.accepted and step.type == "final":
            attempt.prefill_status = "checking"
            attempt.check_id = check_id
            attempt.check_deadline = utcnow() + CHECK_LEASE
            return None
        await finish_if_ready(db, user_id)
        return await submission_out(db, user_id, attempt)


async def extract_prefill(
    db: AsyncSession,
    ai: DeepSeekClient,
    attempt_id: UUID,
    check_id: UUID,
    user_id: UUID,
    data: SubmissionIn,
) -> SubmissionOut:
    fields = None
    try:
        result = await ai.complete(
            "Извлеки поля первой анкеты проекта из принятого итога: "
            "title, industry, stage, audience, problem, solution_benefit, mentor_request. "
            "Польза решения описывает пользу для клиента. Запрос наставнику извлекай "
            "только если ученик явно описал, с чем нужна помощь. "
            "Заполняй только поля, прямо подтверждённые ответом. Остальные оставь пустыми.",
            json.dumps({"answer": data.answer}, ensure_ascii=False),
            ProjectPrefill,
        )
        fields = result.model_dump(exclude_none=True)
    except CheckUnavailable:
        pass

    async with db.begin():
        attempt = await checked_attempt(db, user_id, attempt_id, check_id)
        attempt.prefill_status = "succeeded" if fields is not None else "failed"
        attempt.project_prefill = fields
        attempt.check_id = None
        attempt.check_deadline = None
        await finish_if_ready(db, user_id)
        return await submission_out(db, user_id, attempt)


async def help_with_step(db: AsyncSession, ai: DeepSeekClient, step_id: str, data: HelpIn) -> Hint:
    async with db.begin():
        step = await get_step(db, step_id)
        context = {"title": step.title, "prompt": step.prompt, "blocks": step.blocks}
    try:
        return await ai.complete(
            "Дай наводящую учебную подсказку на русском. Не раскрывай готовый ответ.",
            json.dumps(
                {
                    "task": context,
                    "question": data.question,
                    "current_input": data.current_input,
                },
                ensure_ascii=False,
            ),
            Hint,
        )
    except CheckUnavailable as exc:
        raise check_unavailable() from exc

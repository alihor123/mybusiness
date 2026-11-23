import json
from time import time_ns
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import CheckUnavailable, DeepSeekClient
from app.auth.service import lock_user
from app.auth.tokens import utcnow
from app.errors import api_error, check_unavailable
from app.learning.assessment import (
    CHECK_LEASE,
    Answer,
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
    TrackStepsOut,
)
from app.projects.bootstrap import ProjectPrefill

MEDIA_EVENTS = {"theory": "text_end", "video": "video_end"}
TERMINAL = {"accepted", "rejected"}

LEARNING_EXAMPLES = {
    "idea-validation-06": "Студенты корпуса Б с десятиминутной переменой. «Как в последний раз пытались купить кофе между парами?» «Что сделали, когда увидели очередь?»",
    "idea-validation-09": "Сейчас студенты берут кофе в автомате. Предзаказ позволит забрать готовый напиток у входа. Измерю, сколько минут проходит от начала перемены до выдачи в обоих случаях.",
    "idea-validation-10": "Студенты корпуса Б, у которых 10 минут между парами, часто уходят из очереди. За три дня опрошу 10 студентов и понаблюдаю у буфета. Если 6 уже уходили из очереди за неделю, проверю выдачу предзаказов у входа. Иначе проверю другую проблему.",
    "mvp-launch-06": "Студент видит объявление в чате, отправляет заказ через форму и забирает кофе по номеру. Бариста вручную сверяет номера, чтобы проверить выдачу до разработки приложения.",
    "mvp-launch-09": "Проверю, успеют ли студенты забрать предзаказ. Приглашу 10 человек, посчитаю выдачи за одну десятиминутную перемену. Цель — хотя бы 6 выдач.",
    "mvp-launch-10": "Неделю принимаю заказы через форму из чата корпуса. Бариста вручную собирает заказы и выдаёт по номеру у входа. Из 20 заказавших 12 должны забрать кофе за 10 минут. При успехе расширю тест на соседний корпус, иначе проверю, где возникают задержки.",
    "first-sales-06": "Студенты корпуса Б, заберите капучино за 150 ₽ у входа без очереди на большой перемене. Напишите «кофе» в чат корпуса до 11:30.",
    "first-sales-09": "За один день считаю просмотры объявления, заявки и оплаты в штуках. Конверсия заявки в покупку — число оплат, делённое на число заявок, умноженное на 100%.",
    "first-sales-10": "Студентам корпуса Б предлагаю кофе у входа за 150 ₽ при расходах 85 ₽ на напиток и стакан. Принимаю заявки из чата, считаю 15 оплат за неделю. При достижении цели повторю в соседнем корпусе, иначе разберу причины отказа после заявки.",
}


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


async def track_steps(db: AsyncSession, user_id: UUID, track_id: str) -> TrackStepsOut:
    track = await db.get(Track, track_id)
    if track is None:
        raise api_error(404, "TRACK_NOT_FOUND", "Трек не найден")
    route = await get_route(db, user_id)
    track_detail_out = TrackDetail(
        **route.track_out(track).model_dump(),
        steps=[route.summarize(step) for step in route.steps[track_id]],
    )
    steps = route.steps[track_id]
    step_ids = [step.id for step in steps]
    drafts = {
        draft.step_id: draft
        for draft in await db.scalars(
            select(Draft).where(Draft.user_id == user_id, Draft.step_id.in_(step_ids))
        )
    }
    attempts = await db.scalars(
        select(Attempt)
        .where(Attempt.user_id == user_id, Attempt.step_id.in_(step_ids))
        .order_by(Attempt.number.desc())
    )
    latest_attempts: dict[str, Attempt] = {}
    for attempt in attempts:
        latest_attempts.setdefault(attempt.step_id, attempt)
    lessons = [
        StepOut(
            **route.summarize(step).model_dump(),
            track_id=step.track_id,
            blocks=step.blocks,
            prompt=step.prompt,
            options=step.options,
            draft=drafts[step.id].answer if step.id in drafts else None,
            last_attempt=attempt_out(latest_attempts[step.id]) if step.id in latest_attempts else None,
        )
        for step in steps
    ]
    return TrackStepsOut(track=track_detail_out, lessons=lessons)


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
        if "answer" in data.model_fields_set:
            if step.type in MEDIA_EVENTS:
                raise api_error(422, "NO_ANSWER_EXPECTED", "У материала нет поля ответа")
            if data.answer is not None:
                validate_answer(step.type, step.options, data.answer, partial=True)
            await write_draft(db, user_id, step.id, data.answer, data.saved_at_ms)
        if data.saved_at_ms is None:
            await update_position(db, user_id, step)
        return await step_out(db, user_id, step)


async def write_draft(
    db: AsyncSession, user_id: UUID, step_id: str, answer: Answer | None, saved_at_ms: int | None
) -> None:
    # Пустой снимок тоже хранит время, чтобы задержанный запрос не вернул старый текст.
    data = insert(Draft).values(user_id=user_id, step_id=step_id, answer=answer, saved_at_ms=saved_at_ms)
    update = data.on_conflict_do_update(
        index_elements=[Draft.user_id, Draft.step_id],
        set_={"answer": data.excluded.answer, "saved_at_ms": func.coalesce(data.excluded.saved_at_ms, Draft.saved_at_ms)},
        where=(Draft.saved_at_ms.is_(None) | (Draft.saved_at_ms < data.excluded.saved_at_ms))
        if saved_at_ms is not None else None,
    )
    await db.execute(update)


async def require_available(db: AsyncSession, user_id: UUID, step: Step) -> None:
    summary = (await get_route(db, user_id)).summarize(step)
    if not summary.credited and not summary.can_credit:
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
    current = await db.get(Draft, (user_id, step.id))
    previous_clock = current.saved_at_ms if current and current.saved_at_ms is not None else -1
    clock = max(previous_clock + 1, data.saved_at_ms or time_ns() // 1_000_000)
    await write_draft(db, user_id, step.id, None, clock)
    await update_position(db, user_id, step)
    return attempt, step


async def save_decision(
    db: AsyncSession,
    attempt: Attempt,
    step: Step,
    decision: CheckDecision,
) -> bool:
    attempt.status = "accepted" if decision.accepted else "rejected"
    attempt.remarks = decision.remarks
    attempt.check_id = None
    attempt.check_deadline = None
    new_credit = decision.accepted and await db.get(Credit, (attempt.user_id, step.id)) is None
    if new_credit:
        await record_credit(db, attempt.user_id, step, attempt.id)
    return new_credit


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


async def learning_context(db: AsyncSession, step: Step) -> dict:
    track = await db.get(Track, step.track_id)
    return {
        "track": track.title if track else step.track_id,
        "track_goal": track.description if track else None,
        "task": step.title,
        "prompt": step.prompt,
        "criteria": step.criteria or [],
        "reference_answer": LEARNING_EXAMPLES.get(step.id),
    }


async def check_written(
    db: AsyncSession,
    ai: DeepSeekClient,
    attempt_id: UUID,
    check_id: UUID,
    user_id: UUID,
    step: Step,
    data: SubmissionIn,
) -> SubmissionOut | None:
    async with db.begin():
        context = await learning_context(db, step)
    try:
        decision = await ai.complete(
            "Проверь ответ по условию и критериям именно этого задания. Для итогов "
            "оцени план ученика для его проекта. Используй пример как ориентир полноты "
            "и конкретности. Засчитывай равноценные ответы с другими решениями и числами. "
            "При отказе назови недостающий пункт и предложи один следующий шаг. При принятии "
            "дай короткое подтверждение. Пиши по-русски и не добавляй факты за ученика.",
            json.dumps(
                {
                    **context,
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
        new_credit = await save_decision(db, attempt, step, decision)
        if new_credit and step.type == "final":
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
        if step.type not in {"written", "final"}:
            raise api_error(422, "HELP_UNAVAILABLE", "Подсказка доступна для задания с открытым ответом")
        context = await learning_context(db, step)
        context.pop("reference_answer", None)
    try:
        return await ai.complete(
            "Дай наводящую учебную подсказку на русском языке с учётом задания, критериев и "
            "примера. Не составляй ответ за ученика и не представляй пример как эталон. "
            "Помоги выбрать следующий конкретный шаг или проверить один пункт ответа.",
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

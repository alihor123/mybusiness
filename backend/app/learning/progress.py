from dataclasses import dataclass
from uuid import UUID, uuid4

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.tokens import utcnow
from app.diagnostic.models import Diagnostic
from app.learning.models import Attempt, Completion, Credit, Step, Track, TrackPosition
from app.learning.schemas import Progress, StepSummary, TrackOut, TrackProgress
from app.projects.bootstrap import ProjectPrefill, ensure_first_project


class LearningOutcome(BaseModel):
    can_create_project: bool
    project_prefill: ProjectPrefill


@dataclass
class Route:
    tracks: list[Track]
    steps: dict[str, list[Step]]
    credits: set[str]
    scores: dict[str, int]
    positions: dict[str, str]

    def is_optional(self, step: Step) -> bool:
        score = self.scores.get(step.track_id, 0)
        return step.optional_rank is not None and step.optional_rank <= score - 1

    def next_required(self, track_id: str) -> str | None:
        return next(
            (
                step.id
                for step in self.steps[track_id]
                if not self.is_optional(step) and step.id not in self.credits
            ),
            None,
        )

    def summarize(self, step: Step) -> StepSummary:
        credited = step.id in self.credits
        optional = self.is_optional(step)
        return StepSummary(
            id=step.id,
            title=step.title,
            position=step.position,
            type=step.type,
            optional_by_diagnostic=optional,
            credited=credited,
            can_credit=not credited and (optional or step.id == self.next_required(step.track_id)),
        )

    def track_progress(self, track_id: str) -> TrackProgress:
        steps = self.steps[track_id]
        required = [step for step in steps if not self.is_optional(step)]
        credited = sum(step.id in self.credits for step in steps)
        next_step = self.next_required(track_id)
        return TrackProgress(
            track_id=track_id,
            required_count=len(required),
            credited_required_count=sum(step.id in self.credits for step in required),
            credited_count=credited,
            next_required_step_id=next_step,
            current_step_id=self.positions.get(track_id) or next_step or steps[-1].id,
            status="completed"
            if next_step is None
            else ("in_progress" if credited or track_id in self.positions else "not_started"),
        )

    def track_out(self, track: Track) -> TrackOut:
        return TrackOut(
            **self.track_progress(track.id).model_dump(),
            id=track.id,
            position=track.position,
            title=track.title,
            description=track.description,
            cover_url=track.cover_url,
        )


async def get_route(db: AsyncSession, user_id: UUID) -> Route:
    tracks = list(await db.scalars(select(Track).order_by(Track.position)))
    steps: dict[str, list[Step]] = {track.id: [] for track in tracks}
    for step in await db.scalars(select(Step).order_by(Step.position)):
        steps[step.track_id].append(step)
    credits = set(await db.scalars(select(Credit.step_id).where(Credit.user_id == user_id)))
    scores = await db.scalar(
        select(Diagnostic.scores).where(
            Diagnostic.user_id == user_id,
            Diagnostic.status == "completed",
        )
    )
    positions = dict(
        (
            await db.execute(
                select(
                    TrackPosition.track_id,
                    TrackPosition.step_id,
                ).where(TrackPosition.user_id == user_id)
            )
        ).all()
    )
    return Route(tracks, steps, credits, scores or {}, positions)


async def get_progress(db: AsyncSession, user_id: UUID) -> Progress:
    route = await get_route(db, user_id)
    completion = await db.get(Completion, user_id)
    return Progress(
        tracks=[route.track_progress(track.id) for track in route.tracks],
        can_create_project=completion is not None,
        first_project_id=completion.first_project_id if completion else None,
    )


async def get_learning_outcome(db: AsyncSession, user_id: UUID) -> LearningOutcome:
    completion = await db.get(Completion, user_id)
    return LearningOutcome(
        can_create_project=completion is not None,
        project_prefill=ProjectPrefill.model_validate(
            completion.project_prefill if completion else {}
        ),
    )


async def finish_if_ready(db: AsyncSession, user_id: UUID) -> None:
    """Call with the learner row locked in the transaction that changes progress."""
    if await db.get(Completion, user_id) is not None:
        return
    route = await get_route(db, user_id)
    if len(route.tracks) != 3 or any(route.next_required(track.id) for track in route.tracks):
        return
    finals = (
        await db.execute(
            select(Attempt.prefill_status, Attempt.project_prefill)
            .join(Credit, Credit.attempt_id == Attempt.id)
            .join(Step, Credit.step_id == Step.id)
            .join(Track, Step.track_id == Track.id)
            .where(Credit.user_id == user_id, Step.type == "final")
            .order_by(Track.position)
        )
    ).all()
    if len(finals) != 3 or any(status not in {"succeeded", "failed"} for status, _ in finals):
        return
    # Later tracks can clarify the same business idea as it develops.
    fields: dict = {}
    for _, prefill in finals:
        fields.update(prefill or {})
    project_prefill = ProjectPrefill.model_validate(fields)
    completion_id = uuid4()
    project_id = await ensure_first_project(
        db,
        user_id=user_id,
        completion_id=completion_id,
        project_prefill=project_prefill,
    )
    db.add(
        Completion(
            id=completion_id,
            user_id=user_id,
            first_project_id=project_id,
            project_prefill=fields,
            completed_at=utcnow(),
        )
    )

from datetime import datetime, timedelta
from typing import Annotated
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field

from app.auth.tokens import utcnow
from app.errors import api_error

OptionID = Annotated[str, Field(min_length=1, max_length=64)]
Answer = Annotated[str, Field(min_length=1, max_length=10_000)] | dict[OptionID, OptionID]
CHECK_LEASE = timedelta(minutes=5)


class Option(BaseModel):
    id: str
    text: str


class ChoiceOptions(BaseModel):
    choices: list[Option]


class MatchingOptions(BaseModel):
    left: list[Option]
    right: list[Option]


Options = ChoiceOptions | MatchingOptions


class CheckDecision(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    accepted: bool
    remarks: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(max_length=10)


def conflict(code: str, message: str):
    return api_error(409, code, message)


def invalid_answer():
    return api_error(422, "INVALID_ANSWER", "Ответ не соответствует формату задания")


def validate_answer(
    kind: str, options: dict | None, answer: Answer, *, partial: bool = False
) -> None:
    if kind == "choice":
        if (
            options is None
            or not isinstance(answer, str)
            or answer not in {option["id"] for option in options["choices"]}
        ):
            raise invalid_answer()
    elif kind == "matching":
        if options is None or not isinstance(answer, dict):
            raise invalid_answer()
        left = {option["id"] for option in options["left"]}
        right = {option["id"] for option in options["right"]}
        if (
            not answer.keys() <= left
            or (not partial and answer.keys() != left)
            or not set(answer.values()) <= right
            or len(set(answer.values())) != len(answer)
        ):
            raise invalid_answer()
    elif not isinstance(answer, str) or (not partial and not answer.strip()):
        raise invalid_answer()


def claim_check(previous_deadline: datetime | None) -> tuple[UUID, datetime]:
    now = utcnow()
    if previous_deadline is not None and previous_deadline > now:
        raise conflict("CHECK_IN_PROGRESS", "Проверка уже выполняется")
    return uuid4(), now + CHECK_LEASE

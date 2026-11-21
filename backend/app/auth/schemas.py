from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class Credentials(BaseModel):
    login: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=256)
    device_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$")

    @field_validator("login")
    @classmethod
    def normalize_login(cls, login: str) -> str:
        login = login.strip().lower()
        if not login or len(login) > 254 or any(character.isspace() for character in login):
            raise ValueError("Логин должен быть без пробелов")
        return login


class Registration(Credentials):
    password: str = Field(min_length=8, max_length=256)


class Profile(BaseModel):
    id: UUID
    role: Literal["student", "teacher"]
    login: str
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    occupation: str | None = None


class Actor(BaseModel):
    user_id: UUID
    role: Literal["student", "teacher"]
    permissions: frozenset[str]
    profile: Profile

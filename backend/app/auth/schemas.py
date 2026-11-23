import re
import unicodedata
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.config import get_settings


class Credentials(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1, max_length=256)
    device_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, email: str) -> str:
        email = email.strip().lower()
        if not email or len(email) > 254 or "\x00" in email:
            raise ValueError("Некорректные данные регистрации")
        if get_settings().simplified_registration:
            return email
        if "@" not in email:
            raise ValueError("Некорректные данные регистрации")
        local, domain = email.rsplit("@", 1)
        labels = domain.split(".")
        local_pattern = r"[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*"
        label_pattern = r"[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?"
        if (
            len(local) > 64
            or not re.fullmatch(local_pattern, local)
            or len(labels) < 2
            or any(not label or len(label) > 63 or not re.fullmatch(label_pattern, label) for label in labels)
        ):
            raise ValueError("Некорректные данные регистрации")
        return email


class Registration(Credentials):
    first_name: str = Field(max_length=100)
    last_name: str = Field(max_length=100)

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if "\x00" in value:
            raise ValueError("Некорректные данные регистрации")
        if get_settings().simplified_registration:
            return value
        groups = re.split(r"[- '’]", value)
        if (
            any(not group or any(unicodedata.category(c)[0] not in "LM" for c in group) for group in groups)
            or not any(unicodedata.category(c).startswith("L") for c in value)
        ):
            raise ValueError("Некорректные данные регистрации")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, password: str) -> str:
        if not password.strip():
            raise ValueError("Некорректные данные регистрации")
        if not get_settings().simplified_registration and (
            len(password) < 8 or not any(character.isalpha() for character in password)
            or not re.search(r"[0-9]", password)
        ):
            raise ValueError("Некорректные данные регистрации")
        return password


class LoginCredentials(Credentials):
    @field_validator("password")
    @classmethod
    def validate_nonblank_password(cls, password: str) -> str:
        if not password.strip():
            raise ValueError("Некорректные данные регистрации")
        return password


class Profile(BaseModel):
    id: UUID
    role: Literal["student", "teacher"]
    email: str
    first_name: str | None = None
    last_name: str | None = None
    occupation: str | None = None


class ProfileUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    occupation: str | None = Field(default=None, max_length=200)

    @field_validator("first_name", "last_name", "occupation")
    @classmethod
    def normalize_profile_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class Actor(BaseModel):
    user_id: UUID
    role: Literal["student", "teacher"]
    permissions: frozenset[str]
    profile: Profile

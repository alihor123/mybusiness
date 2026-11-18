from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from hashlib import sha256
from uuid import UUID

from authx import AuthX, AuthXConfig, RequestToken
from authx.exceptions import AuthXException, CSRFError, MissingCSRFTokenError
from fastapi import Request, Response
from pydantic import ValidationError

from app.config import get_settings
from app.errors import api_error

ACCESS_COOKIE = "access_token_cookie"
REFRESH_COOKIE = "refresh_token_cookie"
CSRF_HEADER = "X-CSRF-TOKEN"


@dataclass(frozen=True)
class Pair:
    access: str
    refresh: str
    expires_at: datetime


@dataclass(frozen=True)
class SessionToken:
    user_id: UUID
    sid: UUID
    request_token: RequestToken


@lru_cache
def get_auth() -> AuthX:
    settings = get_settings()
    return AuthX(
        AuthXConfig(
            JWT_SECRET_KEY=settings.jwt_secret.get_secret_value(),
            JWT_TOKEN_LOCATION=["cookies"],
            JWT_ACCESS_COOKIE_NAME=ACCESS_COOKIE,
            JWT_ACCESS_COOKIE_PATH="/api/v1",
            JWT_REFRESH_COOKIE_NAME=REFRESH_COOKIE,
            JWT_REFRESH_COOKIE_PATH="/api/v1/auth/refresh",
            JWT_ACCESS_CSRF_HEADER_NAME=CSRF_HEADER,
            JWT_REFRESH_CSRF_HEADER_NAME=CSRF_HEADER,
            JWT_COOKIE_DOMAIN=settings.cookie_domain or None,
            JWT_COOKIE_SECURE=settings.cookie_secure,
        )
    )


def unauthorized():
    return api_error(401, "UNAUTHENTICATED", "Войдите в аккаунт")


def read_token(request: Request, *, refresh: bool = False) -> SessionToken:
    cookie = request.cookies.get(REFRESH_COOKIE if refresh else ACCESS_COOKIE)
    if not cookie:
        raise unauthorized()
    request_token = RequestToken(
        token=cookie,
        csrf=request.headers.get(CSRF_HEADER),
        type="refresh" if refresh else "access",
        location="cookies",
    )
    try:
        payload = get_auth().verify_token(request_token, verify_csrf=False)
        return SessionToken(UUID(payload.sub), UUID(payload.model_dump()["sid"]), request_token)
    except (AuthXException, ValidationError, ValueError, KeyError, TypeError) as exc:
        raise unauthorized() from exc


def require_csrf(request: Request, token: SessionToken) -> None:
    auth = get_auth()
    if request.method in auth.config.JWT_CSRF_METHODS:
        try:
            auth.verify_token(token.request_token)
        except (CSRFError, MissingCSRFTokenError) as exc:
            raise api_error(403, "INVALID_CSRF", "Недействительный CSRF-токен") from exc
        except AuthXException as exc:
            raise unauthorized() from exc


def issue_pair(user_id: UUID, sid: UUID, now: datetime) -> Pair:
    settings = get_settings()
    auth = get_auth()
    expires_at = now + timedelta(seconds=settings.refresh_ttl_seconds)
    claims = {"sid": str(sid)}
    return Pair(
        access=auth.create_access_token(
            str(user_id), data=claims, expiry=now + timedelta(seconds=settings.access_ttl_seconds)
        ),
        refresh=auth.create_refresh_token(str(user_id), data=claims, expiry=expires_at),
        expires_at=expires_at,
    )


def set_cookies(response: Response, pair: Pair) -> None:
    settings = get_settings()
    auth = get_auth()
    auth.set_access_cookies(pair.access, response, max_age=settings.access_ttl_seconds)
    auth.set_refresh_cookies(pair.refresh, response, max_age=settings.refresh_ttl_seconds)


def token_hash(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)

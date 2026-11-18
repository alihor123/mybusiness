from fastapi import Depends, Request
from fastapi.security import APIKeyCookie

from app.auth.schemas import Actor
from app.auth.service import active_session, get_actor
from app.auth.tokens import ACCESS_COOKIE, read_token, require_csrf, unauthorized
from app.config import get_settings
from app.database import get_session_factory
from app.errors import api_error

access_cookie = APIKeyCookie(name=ACCESS_COOKIE, scheme_name="AccessCookie", auto_error=False)


async def get_current_user(request: Request, _: str | None = Depends(access_cookie)) -> Actor:
    settings = get_settings()
    async with get_session_factory()() as db:
        if settings.test_user:
            actor = await get_actor(db, settings.test_user_id)
            if actor.role != "student":
                raise unauthorized()
            return actor
        token = read_token(request)
        await active_session(db, token)
        require_csrf(request, token)
        return await get_actor(db, token.user_id)


def require_permission(permission: str):
    async def dependency(actor: Actor = Depends(get_current_user)) -> Actor:
        if permission not in actor.permissions:
            raise api_error(403, "FORBIDDEN", "Недостаточно прав")
        return actor

    return dependency

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import APIKeyCookie
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.auth.dependencies import access_cookie, get_current_user
from app.auth.schemas import Actor, Credentials, Profile, Registration
from app.auth.tokens import REFRESH_COOKIE, get_auth, read_token, set_cookies
from app.config import get_settings
from app.database import get_db
from app.errors import api_error

router = APIRouter(tags=["auth"])
refresh_cookie = APIKeyCookie(name=REFRESH_COOKIE, scheme_name="RefreshCookie", auto_error=False)


def require_origin(request: Request) -> None:
    if request.headers.get("origin") != get_settings().public_origin:
        raise api_error(403, "INVALID_ORIGIN", "Недопустимый источник запроса")


@router.post("/auth/register", status_code=201, dependencies=[Depends(require_origin)])
async def register(
    data: Registration, response: Response, db: AsyncSession = Depends(get_db)
) -> Profile:
    actor, pair = await service.register(db, data)
    set_cookies(response, pair)
    return actor.profile


@router.post("/auth/login", dependencies=[Depends(require_origin)])
async def login(
    data: Credentials, response: Response, db: AsyncSession = Depends(get_db)
) -> Profile:
    actor, pair = await service.login(db, data)
    set_cookies(response, pair)
    return actor.profile


@router.post("/auth/refresh", status_code=204, dependencies=[Depends(refresh_cookie)])
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> None:
    token = read_token(request, refresh=True)
    set_cookies(response, await service.refresh(db, request, token))


@router.post("/auth/logout", status_code=204, dependencies=[Depends(access_cookie)])
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> None:
    token = read_token(request)
    await service.logout(db, request, token)
    get_auth().unset_cookies(response)


@router.get("/me")
async def me(actor: Actor = Depends(get_current_user)) -> Profile:
    return actor.profile

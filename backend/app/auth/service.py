from hmac import compare_digest
from uuid import UUID, uuid4

from fastapi import Request
from pwdlib import PasswordHash
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.auth.models import Permission, Role, RolePermission, Session, User
from app.auth.schemas import Actor, LoginCredentials, Profile, Registration
from app.auth.tokens import (
    Pair,
    SessionToken,
    issue_pair,
    require_csrf,
    token_hash,
    unauthorized,
    utcnow,
)
from app.config import get_settings
from app.errors import api_error


class TestModeDisabled(Exception):
    """A previously issued demo session is no longer allowed in this mode."""

passwords = PasswordHash.recommended()


async def hash_password(password: str) -> str:
    return await run_in_threadpool(passwords.hash, password)


async def lock_user(db: AsyncSession, user_id: UUID) -> None:
    await db.execute(select(User.id).where(User.id == user_id).with_for_update())


async def get_actor(db: AsyncSession, user_id: UUID) -> Actor:
    row = (
        await db.execute(
            select(User, Role.code).join(Role, User.role_id == Role.id).where(User.id == user_id)
        )
    ).one_or_none()
    if row is None:
        raise unauthorized()
    user, role = row
    granted = await db.scalars(
        select(Permission.code).join(RolePermission).where(RolePermission.role_id == user.role_id)
    )
    return Actor(
        user_id=user.id,
        role=role,
        permissions=frozenset(granted),
        profile=Profile(
            id=user.id,
            role=role,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            occupation=user.occupation,
            is_demo=user.is_demo,
        ),
    )


async def start_session(db: AsyncSession, user_id: UUID, device_id: str) -> Pair:
    await lock_user(db, user_id)
    now = utcnow()
    existing = await db.scalar(
        select(Session)
        .where(
            Session.user_id == user_id,
            Session.device_id == device_id,
            Session.revoked_at.is_(None),
        )
        .with_for_update()
    )
    if existing is not None and existing.expires_at <= now:
        existing.revoked_at = now
        await db.flush()
        existing = None
    sid = existing.id if existing is not None else uuid4()
    pair = issue_pair(user_id, sid, now)
    if existing is None:
        db.add(
            Session(
                id=sid,
                user_id=user_id,
                device_id=device_id,
                created_at=now,
                expires_at=pair.expires_at,
                refresh_hash=token_hash(pair.refresh),
            )
        )
    else:
        existing.refresh_hash = token_hash(pair.refresh)
        existing.expires_at = pair.expires_at
    return pair


async def register(db: AsyncSession, data: Registration) -> tuple[Actor, Pair]:
    password_hash = await hash_password(data.password)
    async with db.begin():
        role_id = await db.scalar(select(Role.id).where(Role.code == "student"))
        user_id = await db.scalar(
            insert(User)
            .values(
                email=data.email,
                first_name=data.first_name,
                last_name=data.last_name,
                password_hash=password_hash,
                role_id=role_id,
            )
            .on_conflict_do_nothing(index_elements=[User.email])
            .returning(User.id)
        )
        if user_id is None:
            raise api_error(409, "EMAIL_EXISTS", "Электронная почта уже зарегистрирована")
        pair = await start_session(db, user_id, data.device_id)
        actor = await get_actor(db, user_id)
        actor.profile = actor.profile.model_copy(update={"show_diagnostic_on_login": True})
        return actor, pair


async def login(db: AsyncSession, data: LoginCredentials) -> tuple[Actor, Pair]:
    async with db.begin():
        user = await db.scalar(select(User).where(User.email == data.email))
    match = (
        await run_in_threadpool(passwords.verify, data.password, user.password_hash)
        if user
        else False
    )
    if user is None:
        await hash_password(data.password)
    if not match or user is None:
        raise unauthorized()
    async with db.begin():
        pair = await start_session(db, user.id, data.device_id)
        return await get_actor(db, user.id), pair


async def test_login(db: AsyncSession, device_id: str) -> tuple[Actor, Pair]:
    demo_user_id = UUID("00000000-0000-4000-8000-000000000004")
    async with db.begin():
        user = await db.scalar(select(User).where(User.id == demo_user_id).with_for_update())
        if user is None or not user.is_demo:
            raise unauthorized()
        pair = await start_session(db, user.id, device_id)
        return await get_actor(db, user.id), pair


async def active_session(db: AsyncSession, token: SessionToken, *, lock: bool = False) -> Session:
    statement = (
        select(Session, User.is_demo)
        .join(User, User.id == Session.user_id)
        .where(
            Session.id == token.sid,
            Session.user_id == token.user_id,
            Session.revoked_at.is_(None),
        )
    )
    if lock:
        statement = statement.with_for_update(of=Session)
    row = (await db.execute(statement)).one_or_none()
    if row is None:
        raise unauthorized()
    session, is_demo = row
    if session.expires_at <= utcnow():
        raise unauthorized()
    if is_demo and not get_settings().test_mode:
        raise TestModeDisabled()
    return session


async def refresh(db: AsyncSession, request: Request, token: SessionToken) -> Pair:
    async with db.begin():
        session = await active_session(db, token, lock=True)
        if not compare_digest(session.refresh_hash, token_hash(token.request_token.token)):
            raise unauthorized()
        require_csrf(request, token)
        pair = issue_pair(token.user_id, token.sid, utcnow())
        session.refresh_hash = token_hash(pair.refresh)
        session.expires_at = pair.expires_at
        return pair


async def logout(db: AsyncSession, request: Request, token: SessionToken) -> None:
    async with db.begin():
        await active_session(db, token, lock=True)
        require_csrf(request, token)
        await db.execute(update(Session).where(Session.id == token.sid).values(revoked_at=utcnow()))

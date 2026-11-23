import asyncio
import mimetypes
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.accompaniment.router import router as accompaniment_router
from app.ai.client import get_deepseek
from app.api_contract import describe_errors
from app.applications.router import router as applications_router
from app.auth.router import router as auth_router
from app.auth.service import TestModeDisabled
from app.auth.tokens import get_auth
from app.database import get_db, get_session_factory
from app.diagnostic.router import router as diagnostic_router
from app.diagnostic.worker import run_diagnostic_worker
from app.errors import api_error
from app.events.router import router as events_router
from app.learning.router import router as learning_router
from app.mentors.router import router as mentors_router
from app.projects.router import router as projects_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    stop_diagnostics = asyncio.Event()
    diagnostics = asyncio.create_task(run_diagnostic_worker(stop_diagnostics))
    try:
        yield
    finally:
        stop_diagnostics.set()
        diagnostics.cancel()
        with suppress(asyncio.CancelledError):
            await diagnostics
        if get_deepseek.cache_info().currsize:
            await get_deepseek().close()
            get_deepseek.cache_clear()
        if get_session_factory.cache_info().currsize:
            await get_session_factory().kw["bind"].dispose()
            get_session_factory.cache_clear()


app = FastAPI(title="Мой бизнес", version="0.1.0", lifespan=lifespan)
describe_errors(app)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(diagnostic_router, prefix="/api/v1")
app.include_router(learning_router, prefix="/api/v1")
for router in (
    projects_router,
    mentors_router,
    applications_router,
    accompaniment_router,
    events_router,
):
    app.include_router(router, prefix="/api/v1")
mimetypes.add_type("image/webp", ".webp")
app.mount("/media", StaticFiles(directory=Path(__file__).resolve().parents[1] / "public_media"))


@app.get("/health", tags=["system"], responses={503: {"description": "База недоступна"}})
async def health(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    try:
        await db.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError) as exc:
        raise api_error(503, "DATABASE_UNAVAILABLE", "База данных недоступна") from exc
    return {"status": "ok"}


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    if _request.url.path in {"/api/v1/auth/register", "/api/v1/auth/login"}:
        return JSONResponse({"detail": "Некорректные данные"}, status_code=422)
    # Keep validation errors usable without reflecting passwords or submitted answers.
    errors = [{field: error[field] for field in ("type", "loc", "msg")} for error in exc.errors()]
    return JSONResponse({"detail": errors}, status_code=422)


@app.exception_handler(TestModeDisabled)
async def test_mode_disabled(_request: Request, _exc: Exception) -> JSONResponse:
    response = JSONResponse(
        {"detail": {"code": "TEST_MODE_DISABLED", "message": "Тестовый режим отключён"}},
        status_code=401,
    )
    get_auth().unset_cookies(response)
    return response

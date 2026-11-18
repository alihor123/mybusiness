from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.errors import api_error

app = FastAPI(title="Мой бизнес", version="0.1.0")
app.mount("/media", StaticFiles(directory=Path(__file__).resolve().parents[1] / "public_media"))


@app.get("/health", tags=["system"])
async def health(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    try:
        await db.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError) as exc:
        raise api_error(503, "DATABASE_UNAVAILABLE", "База данных недоступна") from exc
    return {"status": "ok"}

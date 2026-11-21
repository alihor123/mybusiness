import asyncio

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.accompaniment import models as accompaniment_models  # noqa: F401
from app.applications import models as application_models  # noqa: F401
from app.auth import models as auth_models  # noqa: F401
from app.config import get_settings
from app.database import Base
from app.diagnostic import models as diagnostic_models  # noqa: F401
from app.events import models as event_models  # noqa: F401
from app.events import models as events_models  # noqa: F401
from app.learning import models as learning_models  # noqa: F401
from app.mentors import models as mentor_models  # noqa: F401
from app.mentors import models as mentors_models  # noqa: F401
from app.projects import bootstrap as projects_models  # noqa: F401
from app.projects import models as project_models  # noqa: F401


def run_migrations(connection):
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_online():
    engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    try:
        async with engine.connect() as connection:
            await connection.run_sync(run_migrations)
    finally:
        await engine.dispose()


if context.is_offline_mode():
    context.configure(
        url=get_settings().database_url,
        target_metadata=Base.metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(run_online())

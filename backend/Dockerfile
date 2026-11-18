FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.13.9 /uv /usr/local/bin/uv
WORKDIR /srv/backend
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

FROM python:3.12-slim
WORKDIR /srv/backend
RUN groupadd -g 10001 backend && useradd -u 10001 -g backend backend \
    && install -d -o backend -g backend /srv/backend/var/uploads
ENV PATH="/srv/backend/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
COPY --from=build /srv/backend/.venv ./.venv
COPY app ./app
COPY migrations ./migrations
COPY scripts ./scripts
COPY public_media ./public_media
COPY alembic.ini .
USER backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

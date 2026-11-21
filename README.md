# Мой бизнес

Серверная часть ТЗ 01 для предпринимательской программы Югры. В `backend/` находятся
аккаунты и роли, диагностика, учебные треки и общий клиент DeepSeek. Контракт HTTP и примеры
запросов описаны в [backend/API.md](backend/API.md).

## Локальный запуск

Нужны Python 3.10+, `uv` и PostgreSQL. Создайте базу и отдельного пользователя, затем запустите
из корня репозитория:

```sh
cd backend
cp .env.example .env
```

В `.env` заполните `DATABASE_URL` и `JWT_SECRET`. Ключ подписи можно сгенерировать командой
`python -c 'import secrets; print(secrets.token_hex(32))'`. Для разработки по HTTP задайте
`PUBLIC_ORIGIN=http://localhost:8000` и `COOKIE_SECURE=false`. Для письменной проверки,
диагностики и подсказок задайте `DEEPSEEK_API_KEY`.

```sh
uv sync --locked
uv run alembic upgrade head
uv run uvicorn app.main:app
```

API проверяет PostgreSQL на `GET /health`, публикует схему на `/openapi.json`, Swagger UI на
`/docs` и учебные файлы на `/media/`. Запросы браузера идут через тот же origin.

## Запуск стенда

В `backend/.env` задайте `POSTGRES_PASSWORD` и URL подключения с хостом `postgres`.
Установите `PUBLIC_ORIGIN=https://<домен стенда>` и `COOKIE_SECURE=true`. Положите
`fullchain.pem` и `privkey.pem` в `deploy/tls/` либо задайте `TLS_DIR`. Сборку React можно
смонтировать из `dist/` или через `REACT_DIST`.

```sh
docker compose --env-file backend/.env up --build
```

Compose ждёт PostgreSQL, выполняет миграции отдельным сервисом и запускает API после
успешной миграции. Nginx передаёт API, публичные медиа и проверку готовности в FastAPI.
Тома `postgres_data` и `private_uploads` сохраняются между запусками.

## Данные для показа

Задайте `DEMO_PASSWORD` в окружении демостенда. В локальном окружении запустите из
`backend/` команду `uv run python -m scripts.seed_demo`. Для Compose запустите
`docker compose --env-file backend/.env exec api python -m scripts.seed_demo`.

| Логин | Учётная запись |
| --- | --- |
| `demo-student-start` | Ученик в начале обучения |
| `demo-student-complete` | Ученик с зачтёнными треками и черновиком «Кофе между парами» |
| `demo-teacher` | Наставник для проверки роли |
| `demo-mentor-gordon-ramsay` | Первый наставник демонстрационного каталога |
| `demo-mentor-lisa-su` | Второй наставник демонстрационного каталога |

Команда загружает каталог, карточки Leader-ID и демопроект с планом и встречей. Повторный запуск сохраняет существующие пароли и прогресс. Для самостоятельного показа на
отдельном стенде с демонстрационной БД задайте `TEST_USER=true`. Значение `TEST_USER_ID`
`00000000-0000-4000-8000-000000000001` включает ученика в начале пути, значение
`00000000-0000-4000-8000-000000000002` — ученика с завершённым обучением. Все посетители
такого стенда работают с одной выбранной учётной записью.

## Проверки

Создайте отдельную тестовую базу PostgreSQL. Из `backend/` запустите:

```sh
export TEST_DATABASE_URL='postgresql+asyncpg://USER:PASSWORD@HOST:5432/mybusiness_test'
DATABASE_URL="$TEST_DATABASE_URL" uv run alembic upgrade head
uv run python -m pytest -q
uv run ruff check .
```

Интеграционные тесты используют PostgreSQL и подмену DeepSeek. Для проверки реального
провайдера задайте ключ и отправьте запрос на `/learning/steps/idea-validation-06/help`
от ученика по примеру в контракте.

# Мой бизнес

Веб-демка предпринимательской программы Югры. В `frontend/` находятся кабинеты ученика и
наставника. В `backend/` находятся аккаунты, диагностика, треки, проекты и сопровождение.
Контракт HTTP и примеры запросов описаны в [backend/API.md](backend/API.md).

## Локальный запуск

Нужны Python 3.10+, `uv` и PostgreSQL. Создайте базу и отдельного пользователя, затем запустите
из корня репозитория:

```sh
cd backend
cp .env.example .env
```

В `.env` заполните `DATABASE_URL` и `JWT_SECRET`. Ключ подписи можно сгенерировать командой
`python -c 'import secrets; print(secrets.token_hex(32))'`. Для запуска вместе с Vite
задайте `PUBLIC_ORIGIN=http://localhost:5173` и `COOKIE_SECURE=false`. Если открываете
интерфейс по другому адресу, внесите в `PUBLIC_ORIGIN` этот адрес с портом.

```sh
uv sync --locked
uv run alembic upgrade head
uv run uvicorn app.main:app
```

API проверяет PostgreSQL на `GET /health`, публикует схему на `/openapi.json`, Swagger UI на
`/docs` и учебные файлы на `/media/`. Во втором терминале запустите фронтенд:

```sh
cd frontend
npm install
npm run dev
```

Откройте `http://localhost:5173`. Vite проксирует API и медиа на `http://127.0.0.1:8000`.
Если FastAPI слушает другой адрес, перед запуском Vite задайте `VITE_API_TARGET` в
окружении фронтенда.

`SIMPLIFIED_REGISTRATION=true` в `backend/.env` включён по умолчанию. В этом режиме
можно зарегистрироваться с произвольным непустым значением в поле почты и коротким
паролем. Чтобы включить проверку имени, фамилии, адреса почты и пароля при регистрации,
установите `SIMPLIFIED_REGISTRATION=false`, перезапустите API и Vite или пересоберите
фронтенд.

### Локальная демка без DeepSeek

Для отдельной демо-БД установите в `backend/.env`:

```dotenv
LOCAL_DEMO_MODE=true
DEMO_PASSWORD=12345
```

После миграций выполните из `backend/` команду `uv run python -m scripts.seed_demo`.
Локальный режим позволяет использовать короткие тестовые пароли. При пустом
`DEEPSEEK_API_KEY` он также включает предсказуемые ответы для диагностики, обучения
и подбора наставников. Если задать ключ, эти функции используют DeepSeek даже
при включённом локальном режиме.

## Запуск стенда

В `backend/.env` задайте `POSTGRES_PASSWORD` и URL подключения с хостом `postgres`.
Для стенда с обычной регистрацией задайте `SIMPLIFIED_REGISTRATION=false` до сборки фронтенда.
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

| Почта | Учётная запись |
| --- | --- |
| `demo-student-start@example.com` | Ученик в начале обучения |
| `demo-student-complete@example.com` | Ученик с зачтёнными треками и проектом |
| `demo-teacher@example.com` | Наставник для проверки роли и пустого кабинета |
| `demo-mentor-food@example.com` | Анна Сазонова, ресторанный бизнес |
| `demo-mentor-it@example.com` | Мария Волкова, IT |

Команда загружает каталог вымышленных наставников, карточки Leader-ID и демопроект
с планом и встречей. Повторный запуск обновляет каталог и сохраняет существующие
пароли и прогресс.

Для автоматического входа подготовьте Ивана Иванова командой
`uv run python -m scripts.seed_proda` из `backend/` после миграций и загрузки каталога.
Установите `TEST_MODE=true` в окружении API и `VITE_TEST_MODE=true` перед сборкой фронтенда.
На открытии сайта `POST /api/v1/auth/test` выдаёт обычную cookie-сессию Ивана.
Страницы входа и регистрации перенаправляют на главную. С `TEST_MODE=false` сервер
отклоняет ранее выданные тестовые access и refresh JWT. Обычная сборка с
`VITE_TEST_MODE=false` открывает стандартные формы авторизации.

## Учебные медиа

Ответ шага содержит `blocks`. Для видео блок содержит `url` и необязательный
`poster_url`. Файлы можно положить в `backend/public_media/lessons/` и указывать пути
вида `/media/lessons/file.mp4`. Также подойдут прямые HTTPS-ссылки на видеофайлы,
которые открываются в HTML-плеере. Для замены учебных материалов привяжите каждый
файл к ID шага. Уже загруженные данные обновляются отдельной миграцией или командой
загрузки контента.

Плеер MP4 загружает файл по HTTP и может запрашивать диапазоны байтов для перемотки.
Первый видеоурок «Проверки идеи» использует встроенный плеер RUTUBE. По завершении
фронтенд отправляет `video_end` в API. При просмотре на RUTUBE ученик может вернуться
и подтвердить просмотр кнопкой в уроке.

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

# Контракт ТЗ 01

OpenAPI доступен на `/openapi.json` работающего сервиса. Маршруты в примерах начинаются
с `/api/v1`. Регистрация и вход принимают `Origin`, равный `PUBLIC_ORIGIN`.

| Cookie | Назначение и путь |
| --- | --- |
| `access_token_cookie` | JWT для API, путь `/api/v1` |
| `refresh_token_cookie` | JWT для обновления, путь `/api/v1/auth/refresh` |
| `csrf_access_token` | Токен CSRF для изменений через API, путь `/` |
| `csrf_refresh_token` | Токен CSRF для обновления сессии, путь `/` |

JWT выдаются с `HttpOnly`, `SameSite=Lax` и по умолчанию `Secure`. Для изменяющих запросов
браузер отправляет значение соответствующей CSRF cookie в заголовке `X-CSRF-TOKEN`. При
`401` на `/me` клиент один раз вызывает refresh и при успехе повторяет `/me`.

Ошибки бизнес-правил возвращаются в формате
`{"detail":{"code":"CHECK_UNAVAILABLE","message":"…"}}`. Валидация тела FastAPI возвращает
массив ошибок в `detail`. `401` относится к сессии, `403` к правам, CSRF или Origin,
`404` к отсутствию объекта, `409` к конфликту состояния, `422` к неверным данным.
Технический сбой проверки ИИ возвращает `503 CHECK_UNAVAILABLE`.

## Аккаунты

Для локального показа установите `LOCAL_DEMO_MODE=true`, `DEMO_PASSWORD=12345`,
`COOKIE_SECURE=false` и `PUBLIC_ORIGIN=http://localhost:5173`, затем примените миграции
и запустите `python -m scripts.seed_demo` из каталога backend. Если `DEEPSEEK_API_KEY` задан,
запросы ИИ идут в DeepSeek. При пустом ключе локальный режим использует предсказуемые ответы.
Настройки регистрации действуют независимо от выбора провайдера.

`SIMPLIFIED_REGISTRATION=true` включён по умолчанию и независимо от `LOCAL_DEMO_MODE` разрешает
короткие непустые пароли, произвольный непустой идентификатор вместо адреса почты и имена до 100
символов. Идентификатор обрезается по краям и приводится к нижнему регистру. При значении `false`
сервер проверяет формат почты, имена и пароль от 8 символов с буквой и цифрой.

Пароль для всех демо-учётных записей задаётся через `DEMO_PASSWORD`. Доступны
`demo-student-start@example.com` (обучение с начала), `demo-student-complete@example.com`
(обучение завершено), `demo-teacher@example.com` (кабинет наставника), а также
`demo-mentor-food@example.com` и `demo-mentor-it@example.com`.

| Запрос | Пример тела | Результат |
| --- | --- | --- |
| `POST /auth/register` | `{"first_name":"Алексей","last_name":"Иванов","email":"student@example.com","password":"example-password","device_id":"browser-1"}` | `201`, профиль и cookies |
| `POST /auth/login` | `{"email":"student@example.com","password":"example-password","device_id":"browser-2"}` | `200`, профиль и cookies |
| `POST /auth/refresh` | Без тела, CSRF из `csrf_refresh_token` | `204`, новая пара cookies |
| `POST /auth/logout` | Без тела, CSRF из `csrf_access_token` | `204`, очистка cookies |
| `GET /me` | Без тела | `200`, профиль |
| `PATCH /me` | JSON с `first_name`, `last_name`, `occupation` | `200`, обновлённый профиль |

Примеры ответов `/me` для ученика и наставника:

```json
{"id":"00000000-0000-4000-8000-000000000001","email":"demo-student-start@example.com","role":"student","first_name":"Алексей","last_name":null,"occupation":null}
```

```json
{"id":"00000000-0000-4000-8000-000000000003","email":"demo-teacher@example.com","role":"teacher","first_name":"Ирина","last_name":null,"occupation":null}
```

## Диагностика

| Запрос | Пример тела | Результат |
| --- | --- | --- |
| `GET /diagnostic` | Без тела | Состояние, вопросы, позиция, сохранённые ответы и доступные баллы |
| `PUT /diagnostic/draft` | `{"answers":{"diag-idea-choice":"a"},"current_question_id":"diag-idea-matching"}` | Сохранённый черновик |
| `POST /diagnostic/skip` | Без тела | Состояние `skipped` и сохранённые ответы |
| `POST /diagnostic/restart` | Без тела | Новый черновик после завершённой диагностики. Предыдущий результат сохраняется до окончания новой проверки |
| `POST /diagnostic/submit` | Объект `answers` со всеми девятью ответами | `202`, сохранённый тест в состоянии `checking` |

```json
{
  "answers": {
    "diag-idea-choice": "a",
    "diag-idea-matching": {"l1":"r1","l2":"r2","l3":"r3"},
    "diag-idea-free": "Поговорю со студентами после перемены.",
    "diag-mvp-choice": "b",
    "diag-mvp-matching": {"l1":"r1","l2":"r2","l3":"r3"},
    "diag-mvp-free": "Предложу пробный предзаказ на один день.",
    "diag-sales-choice": "c",
    "diag-sales-matching": {"l1":"r1","l2":"r2","l3":"r3"},
    "diag-sales-free": "Посчитаю, сколько студентов сделали заказ."
  }
}
```

Пока идёт проверка, `GET /diagnostic` возвращает `checking`. Можно продолжить обучение.
После успешной проверки статус меняется на `completed` и появляются баллы. При сбое
возвращаются `in_progress` и `check_unavailable: true`. Повторная отправка тех же ответов
запускает проверку снова. Отправка такого же набора во время проверки возвращает текущее
состояние задания. Изменить ответы можно после завершения проверки или её сбоя.

## Треки и задания

| Запрос | Пример тела | Результат |
| --- | --- | --- |
| `GET /tracks` | Без тела | Карточки трёх треков с прогрессом |
| `GET /tracks/idea-validation` | Без тела | Список шагов и `next_required_step_id` |
| `GET /tracks/idea-validation/steps` | Без тела | `track` со сводкой и `lessons` с материалами, черновиками и последними попытками по всем шагам |
| `GET /learning/steps/idea-validation-06` | Без тела | Материалы, условия, черновик и последняя попытка |
| `PUT /learning/steps/idea-validation-06/draft` | `{"answer":"Студенты ждут кофе в очереди."}` | Шаг с сохранённым черновиком |
| `POST /learning/steps/idea-validation-01/complete` | `{"event":"text_end"}` | Серверный прогресс |
| `POST /learning/steps/idea-validation-02/complete` | `{"event":"video_end"}` | Серверный прогресс |
| `POST /learning/steps/idea-validation-06/submissions` | `{"answer":"Студенты теряют пять минут перемены в очереди за кофе.","request_key":"attempt-6-1"}` | Попытка, замечания и прогресс |
| `POST /learning/steps/idea-validation-06/help` | `{"question":"Как конкретизировать проблему?","current_input":"Очередь за кофе"}` | `{"hint":"…"}` |
| `GET /learning/progress` | Без тела | Прогресс треков, флаг допуска и ID черновика |

Черновик без поля `answer` сохраняет только позицию, а `{"answer":null}` очищает ответ.
После ошибки транспорта повторите отправку с теми же `request_key` и `answer`. После
перезагрузки страницы их можно получить из `last_attempt` на странице шага.
Для исправленного ответа создайте новый ключ. У зачтённого шага `credit_source` равен
`earned` после прохождения или `diagnostic` после зачёта входным тестом. Зачтённые входным
тестом упражнения доступны для практики. Пересдача теста сохраняет зачтённые шаги.
Обязательные шаги засчитываются последовательно внутри трека.
Подсказки доступны для шагов `written` и `final`.

## Стык с модулем проектов

- `app.auth.dependencies.get_current_user` возвращает `Actor` с `user_id`, `role` и
  `permissions`. `require_permission(code)` проверяет право. Доступ к объектам проверяет
  их модуль.
- `await app.learning.progress.get_learning_outcome(db, user_id)` возвращает
  `can_create_project` и `project_prefill`. Модулю проектов следует проверять флаг перед
  ручным созданием.
- `await app.projects.service.ensure_first_project(db, user_id=…, completion_id=…, project_prefill=…)`
  вызывается в транзакции завершения, возвращает UUID черновика и использует уникальный
  `completion_id`. Таблица `first_project_drafts` хранит исходный ID и снимок
  предзаполнения. Миграция переносит ранее созданные записи в `projects` с теми
  же ID. После удаления проекта исходная запись сохраняется и повтор завершения
  обучения не создаёт второй черновик. Данные из финалов копируются один раз.
- `app.ai.client.get_deepseek().complete(instructions, data, ResultModel)` возвращает
  проверенный Pydantic-объект. Сетевой запрос выполняется вне транзакции PostgreSQL.
  Подменить клиент в тестах можно через `app.dependency_overrides[get_deepseek]`.

## Проекты и сопровождение (ТЗ 02)

Все маршруты используют префикс `/api/v1`. Для изменяющих запросов передавайте CSRF
из cookie `csrf_access_token`. Swagger показывает точные имена полей и схемы ответов.

- Ученик открывает `GET /projects` после завершения обучения. В прогрессе
  `draft_project_id` указывает на первый проект. `first_project_id` сохранён для
  совместимости. `POST /projects` создаёт последующий пустой проект.
- `PATCH /projects/{id}` принимает частичную анкету. Для подбора и подачи заявки
  заполните `title`, `industry`, `stage`, `audience`, `problem`, `solution_benefit`
  и `mentor_request`. Каталог можно загружать страницами через `GET /mentors/search`
  с параметрами `q`, `industry`, `offset` и `limit`. Для следующей страницы возьмите
  `next_offset` из ответа. `null` означает конец списка. Подбор вызывается через
  `POST /projects/{id}/mentor-recommendations`. При `503 CHECK_UNAVAILABLE` наставника
  можно выбрать вручную.
- Для `POST /projects/{id}/applications` передайте `{"mentor_id":"<UUID>"}`.
  Наставник открывает `GET /applications/{id}` и отправляет
  `{"decision":"accept","questionnaire_version":1}` на `POST /applications/{id}/decision`.
  Номер версии возьмите из анкеты. При `409` перечитайте её или обновите список заявок.
- План из пяти задач доступен через `GET /projects/{id}/tasks`. Просмотр задачи,
  черновик, проверка ИИ и сдача начинаются с `/tasks/{id}`. Черновик и сдача
  используют multipart с полями `text`, `file_action` и необязательным `file`.
  Доступные действия с файлом: `keep`, `replace`, `remove`. При сдаче передайте
  уникальный `request_key`; для повтора сетевого запроса используйте тот же ключ.
  Файл PDF, JPG или PNG размером до 10 МБ выдаётся
  через `GET /attachments/{id}` участникам, которым доступна соответствующая версия.
- Закреплённый наставник ведёт ближайшую встречу через `PUT /projects/{id}/meeting`.
  `GET /events` отдаёт карточки Leader-ID. После `POST /projects/{id}/archive`
  владелец и закреплённый наставник сохраняют доступ к истории и файлам.

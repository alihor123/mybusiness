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

| Запрос | Пример тела | Результат |
| --- | --- | --- |
| `POST /auth/register` | `{"login":"student","password":"example-password","device_id":"browser-1"}` | `201`, профиль и cookies |
| `POST /auth/login` | `{"login":"student","password":"example-password","device_id":"browser-2"}` | `200`, профиль и cookies |
| `POST /auth/refresh` | Без тела, CSRF из `csrf_refresh_token` | `204`, новая пара cookies |
| `POST /auth/logout` | Без тела, CSRF из `csrf_access_token` | `204`, очистка cookies |
| `GET /me` | Без тела | `200`, профиль |

Примеры ответов `/me` для ученика и наставника:

```json
{"id":"00000000-0000-4000-8000-000000000001","login":"demo-student-start","role":"student","first_name":"Алексей","last_name":null,"email":null,"occupation":null}
```

```json
{"id":"00000000-0000-4000-8000-000000000003","login":"demo-teacher","role":"teacher","first_name":"Ирина","last_name":null,"email":null,"occupation":null}
```

## Диагностика

| Запрос | Пример тела | Результат |
| --- | --- | --- |
| `GET /diagnostic` | Без тела | Состояние, вопросы, позиция, сохранённые ответы и доступные баллы |
| `PUT /diagnostic/draft` | `{"answers":{"diag-idea-choice":"a"},"current_question_id":"diag-idea-matching"}` | Сохранённый черновик |
| `POST /diagnostic/skip` | Без тела | Состояние `skipped` и сохранённые ответы |
| `POST /diagnostic/submit` | Объект `answers` со всеми девятью ответами | `completed`, баллы и количество необязательных упражнений по трекам |

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

Во время проверки повтор возвращает `409 CHECK_IN_PROGRESS`. После технического сбоя можно
повторить отправку сохранённого набора. Для новых ответов сначала обновите черновик. После
успешной сдачи повтор возвращает сохранённые баллы.

## Треки и задания

| Запрос | Пример тела | Результат |
| --- | --- | --- |
| `GET /tracks` | Без тела | Карточки трёх треков с прогрессом |
| `GET /tracks/idea-validation` | Без тела | Список шагов и `next_required_step_id` |
| `GET /learning/steps/idea-validation-06` | Без тела | Материалы, условия, черновик и последняя попытка |
| `PUT /learning/steps/idea-validation-06/draft` | `{"answer":"Студенты ждут кофе в очереди."}` | Шаг с сохранённым черновиком |
| `POST /learning/steps/idea-validation-01/complete` | `{"event":"text_end"}` | Серверный прогресс |
| `POST /learning/steps/idea-validation-02/complete` | `{"event":"video_end"}` | Серверный прогресс |
| `POST /learning/steps/idea-validation-06/submissions` | `{"answer":"Студенты теряют пять минут перемены в очереди за кофе.","request_key":"attempt-6-1"}` | Попытка, замечания и прогресс |
| `POST /learning/steps/idea-validation-06/help` | `{"question":"Как конкретизировать проблему?","current_input":"Очередь за кофе"}` | `{"hint":"…"}` |
| `GET /learning/progress` | Без тела | Прогресс треков, флаг допуска и ID черновика |

Черновик без поля `answer` сохраняет только позицию, а `{"answer":null}` очищает ответ.
После ошибки транспорта повторите отправку с тем же `request_key` и тем же ответом.
Для исправленного ответа создайте новый ключ. Поля `credited` и `optional_by_diagnostic`
передаются отдельно. Обязательные шаги засчитываются последовательно внутри трека.
Все учебные материалы доступны для просмотра.

## Стык с модулем проектов

- `app.auth.dependencies.get_current_user` возвращает `Actor` с `user_id`, `role` и
  `permissions`. `require_permission(code)` проверяет право. Доступ к объектам проверяет
  их модуль.
- `await app.learning.progress.get_learning_outcome(db, user_id)` возвращает
  `can_create_project` и `project_prefill`. Модулю проектов следует проверять флаг перед
  ручным созданием.
- `await app.projects.bootstrap.ensure_first_project(db, user_id=…, completion_id=…, project_prefill=…)`
  вызывается в транзакции завершения, возвращает UUID черновика и использует уникальный
  `completion_id`. В ТЗ 01 есть ссылка на отдельное описание семи полей. Текущий контракт
  использует `title`, `industry`, `stage`, `audience`, `problem`, `solution` и
  `completed_actions`. Эти имена нужно сверить с модулем проектов.
- Таблица `first_project_drafts` хранит первую анкету и закреплённый за ней UUID.
  При подключении проектного CRUD используйте этот UUID и сохраняйте ключ завершения после
  удаления проекта. При конфликте извлечённых значений используются данные более позднего
  трека. После создания анкеты её данные фиксируются.
- `app.ai.client.get_deepseek().complete(instructions, data, ResultModel)` возвращает
  проверенный Pydantic-объект. Сетевой запрос выполняется вне транзакции PostgreSQL.
  Подменить клиент в тестах можно через `app.dependency_overrides[get_deepseek]`.

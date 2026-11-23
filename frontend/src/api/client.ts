const prefix = "/api/v1"
const sessionExpiredEvent = "mb:session-expired"

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  signal?: AbortSignal
  auth?: boolean
}

type ErrorDetail = {
  detail?: { code?: string }
}

const businessMessages = new Map([
  ["CHECK_UNAVAILABLE", "Проверка ИИ временно недоступна. Попробуйте ещё раз"],
  ["CHECK_IN_PROGRESS", "Проверка уже выполняется"],
  ["INVALID_ANSWER", "Ответ не соответствует формату задания"],
  ["STEP_OUT_OF_ORDER", "Сначала завершите предыдущий обязательный шаг"],
  ["STEP_ALREADY_CREDITED", "Шаг уже зачтён"],
  ["APPLICATION_EXISTS", "Заявка уже отправлена"],
  ["MENTOR_ASSIGNED", "Наставник уже назначен"],
  ["LEARNING_INCOMPLETE", "Сначала завершите обучение"],
  ["PROJECT_ARCHIVED", "Проект находится в архиве"],
  ["TEXT_REQUIRED", "Добавьте текст перед отправкой"],
  ["INVALID_ATTACHMENT_TYPE", "Разрешены только PDF, JPG и PNG"],
  ["INVALID_ATTACHMENT", "Проверьте формат файла и размер до 10 МБ"],
  ["COMMENT_REQUIRED", "Добавьте комментарий для возврата на доработку"],
])

// Хранит статус и серверный код ошибки для обработчиков конкретного экрана.
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

const statusMessages: Record<number, string> = {
  0: "Не удалось связаться с сервером",
  401: "Войдите в аккаунт",
  403: "Нет доступа к этому действию",
  404: "Данные не найдены",
  409: "Данные изменились. Обновите страницу и повторите действие",
  413: "Файл слишком большой",
  422: "Проверьте введённые данные",
  429: "Слишком много запросов. Попробуйте чуть позже",
  500: "На сервере произошла ошибка. Попробуйте позже",
  502: "Не удалось связаться с сервером",
  503: "Сервис временно недоступен",
  504: "Сервер не ответил вовремя. Повторите запрос",
}

// Читает только доступные браузеру CSRF-cookie. JWT отправляются самим браузером.
function readCookie(name: string) {
  const item = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
  return item?.slice(name.length + 1)
}

// Преобразует бизнес-ошибки и ошибки проверки полей FastAPI.
async function responseError(response: Response) {
  let data: ErrorDetail | undefined
  try {
    data = (await response.json()) as ErrorDetail
  } catch {
    // Прокси может вернуть ответ без JSON.
  }
  const code = data?.detail?.code
  const fallback = statusMessages[response.status] ?? "Не удалось выполнить запрос"
  return new ApiError(businessMessages.get(code ?? "") ?? fallback, response.status, code)
}

function waitForRequestDelay(signal?: AbortSignal) {
  if (!import.meta.env.DEV) return Promise.resolve()
  const delay = Number(import.meta.env.VITE_API_DELAY_MS ?? 0)
  if (!Number.isFinite(delay) || delay <= 0) return Promise.resolve()
  if (signal?.aborted) return Promise.reject(signal.reason)

  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", abort)
      resolve()
    }, delay)
    function abort() {
      window.clearTimeout(timer)
      reject(signal?.reason ?? new DOMException("Запрос отменён", "AbortError"))
    }
    signal?.addEventListener("abort", abort, { once: true })
  })
}

// Передаёт одинаковые параметры прокси и стенду и сохраняет boundary для FormData.
async function send(path: string, options: RequestOptions) {
  const method = options.method ?? "GET"
  const headers = new Headers()
  const form = options.body instanceof FormData
  if (options.body !== undefined && !form) headers.set("Content-Type", "application/json")
  if (method !== "GET") {
    const csrf = readCookie(path === "/auth/refresh" ? "csrf_refresh_token" : "csrf_access_token")
    if (csrf) headers.set("X-CSRF-TOKEN", csrf)
  }
  try {
    await waitForRequestDelay(options.signal)
    const timeout = AbortSignal.timeout(method === "GET" ? 20_000 : 120_000)
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
    return await fetch(`${prefix}${path}`, {
      method,
      headers,
      credentials: "same-origin",
      signal,
      body: form ? (options.body as FormData) : JSON.stringify(options.body),
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError("Сервер не ответил вовремя. Повторите запрос", 0)
    }
    throw new ApiError(statusMessages[0], 0)
  }
}

let refreshPending: Promise<boolean> | null = null

// Один refresh обслуживает все запросы, одновременно получившие 401.
async function refreshSession() {
  if (refreshPending) return refreshPending
  if (!readCookie("csrf_refresh_token")) return false

  // Сохраняет сетевую ошибку, чтобы отличать потерю связи от выхода из аккаунта.
  async function refresh() {
    const response = await send("/auth/refresh", { method: "POST", auth: false })
    if (response.status === 401) return false
    if (!response.ok) throw await responseError(response)
    return true
  }

  refreshPending = refresh()
  try {
    return await refreshPending
  } finally {
    refreshPending = null
  }
}

// Возвращает ответ сервера и даёт один повтор после обновления сессии.
export async function requestResponse(path: string, options: RequestOptions = {}) {
  const previousCsrf = readCookie("csrf_access_token")
  let response = await send(path, options)
  if (response.status === 401 && options.auth !== false) {
    const currentCsrf = readCookie("csrf_access_token")
    const alreadyRefreshed = Boolean(currentCsrf && currentCsrf !== previousCsrf)
    if (alreadyRefreshed || (await refreshSession())) response = await send(path, options)
    if (response.status === 401) window.dispatchEvent(new Event(sessionExpiredEvent))
  }
  if (!response.ok) throw await responseError(response)
  return response
}

// Читает JSON-контракт или возвращает undefined для ответов без тела.
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await requestResponse(path, options)
  if (response.status === 204 || response.status === 205) return undefined as T
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError("Сервер вернул ответ в неизвестном формате", response.status)
  }
}

// Сообщает провайдеру о подтверждённом завершении сессии.
export function onSessionExpired(listener: () => void) {
  window.addEventListener(sessionExpiredEvent, listener)
  return () => window.removeEventListener(sessionExpiredEvent, listener)
}

// Показывает точное сообщение API или текст операции для неизвестной ошибки.
export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

// Создаёт ключ запроса и для HTTPS, и для локальной демки по HTTP.
export function createRequestId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

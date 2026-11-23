import { createRequestId, request } from "./client"

export type Role = "student" | "teacher"

export type ProfileFields = {
  first_name: string | null
  last_name: string | null
  email: string
  occupation: string | null
}

export type EditableProfileFields = Pick<ProfileFields, "first_name" | "last_name" | "occupation">
export type Profile = ProfileFields & {
  id: string
  role: Role
  is_demo: boolean
  show_diagnostic_on_login: boolean
}
export type SignupFields = { first_name: string, last_name: string, email: string, password: string }

export const demoLoginEnabled = import.meta.env.VITE_DEMO_LOGIN === "true"

const deviceStorageKey = "mb_device_id"
let sessionDeviceId: string | undefined

// Один браузер сохраняет идентификатор устройства между перезагрузками.
function deviceId() {
  try {
    const stored = window.localStorage.getItem(deviceStorageKey)
    if (stored) return stored
  } catch {
    // В приватном режиме оставляем идентификатор в памяти вкладки.
  }
  sessionDeviceId ??= createRequestId()
  try {
    window.localStorage.setItem(deviceStorageKey, sessionDeviceId)
  } catch {
    // Сессия может работать и при выключенном хранилище.
  }
  return sessionDeviceId
}

export function getProfile(signal?: AbortSignal) {
  return request<Profile>("/me", { signal })
}

export function authenticate(mode: "login", email: string, password: string): Promise<Profile>
export function authenticate(mode: "register", fields: SignupFields): Promise<Profile>
export function authenticate(mode: "login" | "register", value: string | SignupFields, password?: string) {
  const body =
    mode === "login"
      ? { email: value as string, password, device_id: deviceId() }
      : { ...(value as SignupFields), device_id: deviceId() }
  return request<Profile>(`/auth/${mode}`, { method: "POST", auth: false, body })
}

// Открывает серверную демосессию без учётных данных на клиенте.
export function authenticateDemo(signal?: AbortSignal) {
  return request<Profile>("/auth/demo", {
    method: "POST",
    auth: false,
    signal,
    body: { device_id: deviceId() },
  })
}

export function saveProfile(fields: EditableProfileFields) {
  return request<Profile>("/me", { method: "PATCH", body: fields })
}

export function logout() {
  return request<void>("/auth/logout", { method: "POST" })
}

export function roleHome(role: Role) {
  return role === "teacher" ? "/mentor/requests" : "/"
}

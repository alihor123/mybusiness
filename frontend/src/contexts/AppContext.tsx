import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import {
  authenticate,
  authenticateTest,
  getProfile,
  logout,
  saveProfile,
  testModeEnabled,
  type EditableProfileFields,
  type Profile,
  type SignupFields,
} from "../api/auth"
import { ApiError, errorMessage, onSessionExpired, TEST_MODE_DISABLED } from "../api/client"

type Session =
  | { status: "loading" | "guest", profile: null }
  | { status: "error", profile: null, error: string }
  | { status: "ready", profile: Profile }

type AppContextValue = {
  session: Session
  testMode: boolean
  restoreSession: () => void
  signIn: (mode: "login", email: string, password: string) => Promise<void>
  signUp: (fields: SignupFields) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (fields: Partial<EditableProfileFields>) => Promise<Profile>
}

const AppContext = createContext<AppContextValue | null>(null)

// Восстанавливает серверную сессию и передаёт профилю изменения учётной записи.
export function AppProvider({ children }: { children: ReactNode }) {
  // Состояние восстановления и номер попытки пользователя.
  const [session, setSession] = useState<Session>({ status: "loading", profile: null })
  const [attempt, setAttempt] = useState(0)
  // Если сервер отключил режим, в текущей вкладке доступен обычный вход.
  const [testMode, setTestMode] = useState(testModeEnabled)

  useEffect(() => {
    const controller = new AbortController()

    // В тестовой сборке получает тестовую сессию, в обычной восстанавливает текущую.
    async function loadSession() {
      try {
        const profile = testMode
          ? await authenticateTest(controller.signal)
          : await getProfile(controller.signal)
        if (!controller.signal.aborted) setSession({ status: "ready", profile })
      } catch (error) {
        if (controller.signal.aborted) return
        if (testMode && error instanceof ApiError && (error.code === TEST_MODE_DISABLED || error.status === 404)) {
          setTestMode(false)
          return
        }
        if (!testMode && error instanceof ApiError && error.status === 401) {
          setSession({ status: "guest", profile: null })
          return
        }
        setSession({
          status: "error",
          profile: null,
          error: errorMessage(error, "Не удалось проверить сессию"),
        })
      }
    }

    // StrictMode успевает отменить первый эффект до отправки запроса входа.
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadSession()
    })
    return () => controller.abort()
  }, [attempt, testMode])

  useEffect(() => onSessionExpired((code) => {
    if (testMode && code === TEST_MODE_DISABLED) {
      setSession({ status: "loading", profile: null })
      setTestMode(false)
      return
    }
    setSession({ status: "guest", profile: null })
  }), [testMode])

  // Повторяет проверку профиля после ошибки сети.
  function restoreSession() {
    setSession({ status: "loading", profile: null })
    setAttempt((current) => current + 1)
  }

  // Получает роль из ответа авторизации.
  async function signIn(mode: "login", email: string, password: string) {
    const profile = await authenticate(mode, email, password)
    setSession({ status: "ready", profile })
  }

  async function signUp(fields: SignupFields) {
    const profile = await authenticate("register", fields)
    setSession({ status: "ready", profile })
  }

  // Закрывает локальный кабинет после выхода или подтверждённого истечения сессии.
  async function signOut() {
    try {
      await logout()
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error
    }
    setSession({ status: "guest", profile: null })
  }

  // Синхронизирует профиль с ответом сервера.
  async function updateProfile(fields: Partial<EditableProfileFields>) {
    const profile = await saveProfile(fields)
    setSession({ status: "ready", profile })
    return profile
  }

  return (
    <AppContext.Provider value={{ session, testMode, restoreSession, signIn, signUp, signOut, updateProfile }}>
      {children}
    </AppContext.Provider>
  )
}

// Даёт страницам доступ к текущему аккаунту.
export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error("useApp требует AppProvider")
  return context
}

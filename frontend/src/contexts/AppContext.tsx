import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import {
  authenticate,
  authenticateDemo,
  demoLoginEnabled,
  getProfile,
  logout,
  saveProfile,
  type EditableProfileFields,
  type Profile,
  type SignupFields,
} from "../api/auth"
import { ApiError, errorMessage, onSessionExpired } from "../api/client"

type Session =
  | { status: "loading" | "guest", profile: null }
  | { status: "error", profile: null, error: string }
  | { status: "ready", profile: Profile }

type AppContextValue = {
  session: Session
  restoreSession: () => void
  signIn: (mode: "login", email: string, password: string) => Promise<void>
  signUp: (fields: SignupFields) => Promise<void>
  signInDemo: () => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (fields: EditableProfileFields) => Promise<Profile>
}

const AppContext = createContext<AppContextValue | null>(null)

// Восстанавливает серверную сессию и передаёт профилю изменения учётной записи.
export function AppProvider({ children }: { children: ReactNode }) {
  // Состояние восстановления и номер попытки пользователя.
  const [session, setSession] = useState<Session>({ status: "loading", profile: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    // Проверяет текущий профиль, повтор с обновлением cookie выполняет клиент.
    async function loadSession() {
      try {
        const profile = await getProfile(controller.signal)
        if (!controller.signal.aborted) setSession({ status: "ready", profile })
      } catch (error) {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 401) {
          if (demoLoginEnabled && window.location.pathname === "/") {
            try {
              const profile = await authenticateDemo(controller.signal)
              if (!controller.signal.aborted) setSession({ status: "ready", profile })
              return
            } catch {
              if (controller.signal.aborted) return
            }
          }
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

    void loadSession()
    return () => controller.abort()
  }, [attempt])

  useEffect(() => onSessionExpired(() => setSession({ status: "guest", profile: null })), [])

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

  // Открывает демоаккаунт с обычной сессией кабинета.
  async function signInDemo() {
    const profile = await authenticateDemo()
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
  async function updateProfile(fields: EditableProfileFields) {
    const profile = await saveProfile(fields)
    setSession({ status: "ready", profile })
    return profile
  }

  return (
    <AppContext.Provider value={{ session, restoreSession, signIn, signUp, signInDemo, signOut, updateProfile }}>
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

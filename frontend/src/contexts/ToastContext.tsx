import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { motion, useReducedMotion } from "motion/react"
import CloseIcon from "../assets/icons/close.svg?react"
import styles from "./ToastContext.module.css"

type Toast = {
  message: string
  type?: "neutral" | "success" | "error"
  persistent?: boolean
  durationMs?: number
  oneLine?: boolean
}
type ActiveToast = Toast & { id: number, closing?: boolean }
type ToastContextValue = { showToast: (toast: Toast) => () => void }

const ToastContext = createContext<ToastContextValue | null>(null)

// Показывает сообщения поверх текущего маршрута и закрывает их по таймеру.
export function ToastProvider({ children }: { children: ReactNode }) {
  // Текущее уведомление, таймер и идентификатор для безопасной замены.
  const [toast, setToast] = useState<ActiveToast | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const currentId = useRef(0)
  const reducedMotion = useReducedMotion()

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Закрывает только то сообщение, чей таймер или кнопка сработали.
  function dismiss(id: number) {
    if (id !== currentId.current) return
    window.clearTimeout(timer.current)
    setToast((active) => active?.id === id ? { ...active, closing: true } : active)
  }

  // Убирает уведомление после анимации, если за это время его не заменили.
  function finishDismiss(id: number) {
    setToast((active) => active?.id === id && active.closing ? null : active)
  }

  // Возвращает закрытие этого уведомления для завершения фоновой операции.
  function showToast(next: Toast) {
    window.clearTimeout(timer.current)
    const id = ++currentId.current
    setToast({ ...next, id })
    if (!next.persistent) timer.current = window.setTimeout(() => dismiss(id), next.durationMs ?? 4200)
    return () => dismiss(id)
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className={styles.viewport} aria-live="polite" aria-atomic="true">
          {toast && (
            <motion.div
              key={toast.id}
              className={`${styles.toast} ${styles[toast.type ?? "neutral"]}`}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
              animate={{ opacity: toast.closing ? 0 : 1, y: toast.closing && !reducedMotion ? 10 : 0 }}
              onAnimationComplete={() => {
                if (toast.closing) finishDismiss(toast.id)
              }}
              transition={{ duration: reducedMotion ? 0 : 0.18 }}
            >
              <span className={toast.oneLine ? styles.oneLine : undefined}>{toast.message}</span>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Закрыть уведомление">
                <CloseIcon aria-hidden="true" />
              </button>
            </motion.div>
          )}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

// Даёт экранам доступ к общему уведомлению.
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error("Уведомления требуют ToastProvider")
  return context
}

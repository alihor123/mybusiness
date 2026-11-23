import { useEffect, useRef } from "react"

// Откладывает последний снимок и отправляет его при уходе со страницы.
export default function useDraftAutosave() {
  // В таймере ждёт только последний снимок. Уже отправленные запросы независимы.
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<(() => Promise<unknown>) | null>(null)

  // Явная отправка полной формы делает ожидающий черновик лишним.
  function cancel() {
    window.clearTimeout(timer.current)
    pending.current = null
  }

  // Автосохранение остаётся фоновым даже при ошибке сети.
  async function flush() {
    const save = pending.current
    cancel()
    try {
      await save?.()
    } catch {
      // Следующий снимок снова попробует сохранить текущие данные.
    }
  }

  // Передаёт действие с уже сформированным снимком формы.
  function schedule(save: () => Promise<unknown>) {
    cancel()
    pending.current = save
    timer.current = window.setTimeout(() => void flush(), 300)
  }

  useEffect(() => () => { void flush() }, [])
  return { cancel, flush, schedule }
}

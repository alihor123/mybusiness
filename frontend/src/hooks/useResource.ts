import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { errorMessage } from "../api/client"

type Resource<T> = { key: string | null, data: T | null, loading: boolean, error: string | null }

// Загружает данные текущего маршрута и отменяет запрос при переходе.
export default function useResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  // Ответ связан с ключом, чтобы карточка предыдущего маршрута не мелькала при переходе.
  const [state, setState] = useState<Resource<T>>({ key: null, data: null, loading: false, error: null })
  const [attempt, setAttempt] = useState(0)
  // Вызов из JSX может пересоздать замыкание без изменения ключа запроса.
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    if (key === null) return
    const controller = new AbortController()
    setState((current) => ({
      key,
      data: current.key === key ? current.data : null,
      loading: true,
      error: null,
    }))

    // Поздний ответ отменённой загрузки не меняет текущий экран.
    async function fetchResource() {
      try {
        const value = await loadRef.current(controller.signal)
        if (!controller.signal.aborted) setState({ key, data: value, loading: false, error: null })
      } catch (error) {
        if (!controller.signal.aborted) setState((current) => ({
          ...current,
          loading: false,
          error: errorMessage(error, "Не удалось загрузить данные"),
        }))
      }
    }

    void fetchResource()
    return () => controller.abort()
  }, [key, attempt])

  // Перечитывает текущий ресурс, сохраняя видимые данные до ответа.
  function reload() {
    setAttempt((current) => current + 1)
  }

  // Применяет результат изменения к экрану, на котором оно было сделано.
  const setData: Dispatch<SetStateAction<T | null>> = function setResourceData(next) {
    setState((current) => current.key === key ? {
      ...current,
      data: typeof next === "function" ? (next as (value: T | null) => T | null)(current.data) : next,
      error: null,
    } : current)
  }

  if (key === null) return { data: null, loading: false, error: null, reload, setData }
  if (state.key !== key) return { data: null, loading: true, error: null, reload, setData }
  return { data: state.data, loading: state.loading, error: state.error, reload, setData }
}

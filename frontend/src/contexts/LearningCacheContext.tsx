import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { errorMessage } from "../api/client"
import {
  fetchLearningProgress,
  fetchTracks,
  fetchTrackSteps,
  type Diagnostic,
  type LearningProgress,
  type LearningStep,
  type Track,
  type TrackBundle,
  type TrackStep,
} from "../api/learning"

type Resource<T> = { data: T | null, error: string | null }
type LearningCache = {
  tracks: Resource<Track[]>
  progress: Resource<LearningProgress>
  trackBundles: Record<string, Resource<TrackBundle>>
  loadTracks: () => void
  loadProgress: () => void
  loadTrack: (trackId: string) => void
  updateStep: (step: LearningStep) => void
  updateProgress: (progress: LearningProgress) => void
  observeDiagnostic: (diagnostic: Diagnostic) => void
}

const empty = { data: null, error: null }
const Context = createContext<LearningCache | null>(null)

// Кэш живёт в кабинете одного аккаунта и сохраняется при возврате к списку.
export function LearningCacheProvider({ children }: { children: ReactNode }) {
  // Список, права на проекты и полностью загруженные уроки.
  const [tracks, setTracks] = useState<Resource<Track[]>>(empty)
  const [progress, setProgress] = useState<Resource<LearningProgress>>(empty)
  const [trackBundles, setTrackBundles] = useState<Record<string, Resource<TrackBundle>>>({})
  // Один запрос на ресурс. Старые ответы игнорируются после отмены.
  const pending = useRef(new Map<string, AbortController>())
  const diagnosticResult = useRef("")

  useEffect(
    () => () => {
      pending.current.forEach((controller) => controller.abort())
      pending.current.clear()
    },
    [],
  )

  // Загружает ресурс и сохраняет видимые данные при фоновом сбое.
  async function load<T>(
    key: string,
    fetch: (signal: AbortSignal) => Promise<T>,
    set: (value: Resource<T>) => void,
    data: T | null,
  ) {
    if (pending.current.has(key)) return
    const controller = new AbortController()
    pending.current.set(key, controller)
    set({ data, error: null })
    try {
      const result = await fetch(controller.signal)
      if (!controller.signal.aborted) set({ data: result, error: null })
    } catch (error) {
      if (!controller.signal.aborted) set({ data, error: errorMessage(error, "Не удалось загрузить данные") })
    } finally {
      if (pending.current.get(key) === controller) pending.current.delete(key)
    }
  }

  // Отменяет запрос, данные которого уже могли измениться.
  function cancel(key: string) {
    pending.current.get(key)?.abort()
    pending.current.delete(key)
  }

  // Перечитывает список или право на проекты по запросу экрана.
  function loadTracks() {
    void load("tracks", fetchTracks, setTracks, tracks.data)
  }

  function loadProgress() {
    void load("progress", fetchLearningProgress, setProgress, progress.data)
  }

  // Загружает все материалы выбранного трека одним запросом.
  function loadTrack(trackId: string) {
    void load(
      `track:${trackId}`,
      (signal) => fetchTrackSteps(trackId, signal),
      (resource) => {
        setTrackBundles((current) => ({ ...current, [trackId]: resource }))
      },
      trackBundles[trackId]?.data ?? null,
    )
  }

  // Применяет сохранённый черновик или попытку к открытому шагу.
  function updateStep(step: LearningStep) {
    setTrackBundles((current) => {
      const bundle = current[step.track_id]?.data
      if (!bundle) return current
      return {
        ...current,
        [step.track_id]: {
          error: null,
          data: {
            track: {
              ...bundle.track,
              steps: bundle.track.steps.map((item) => (item.id === step.id ? step : item)),
            },
            lessons: bundle.lessons.map((item) => (item.id === step.id ? step : item)),
          },
        },
      }
    })
  }

  // Обновляет счётчики и доступность следующего шага из ответа сервера.
  function updateProgress(next: LearningProgress) {
    cancel("progress")
    setProgress({ data: next, error: null })
    setTracks((current) => {
      if (!current.data) return current
      const data = current.data.map((track) => {
        const update = next.tracks.find((item) => item.track_id === track.id)
        return update ? { ...track, ...update } : track
      })
      return { data, error: null }
    })
    setTrackBundles((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, resource]) => {
          const update = next.tracks.find((item) => item.track_id === id)
          const bundle = resource.data
          if (!bundle || !update) return [id, resource]
          function availability<T extends TrackStep>(step: T): T {
            return {
              ...step,
              can_credit:
                step.credit_source !== "earned" &&
                (step.optional_by_diagnostic || step.id === update?.next_required_step_id),
            }
          }
          return [
            id,
            {
              ...resource,
              data: {
                track: { ...bundle.track, ...update, steps: bundle.track.steps.map(availability) },
                lessons: bundle.lessons.map(availability),
              },
            },
          ]
        }),
      ),
    )
  }

  // Состояние зачёта может измениться в любом треке после диагностики.
  function observeDiagnostic(diagnostic: Diagnostic) {
    if (diagnostic.status !== "completed" || !diagnostic.results) return
    const signature = JSON.stringify(diagnostic.results)
    if (diagnosticResult.current === signature) return
    diagnosticResult.current = signature
    if (!tracks.data && !progress.data && !Object.keys(trackBundles).length) return
    cancel("tracks")
    cancel("progress")
    Object.keys(trackBundles).forEach((id) => cancel(`track:${id}`))
    setTrackBundles({})
    loadTracks()
    loadProgress()
  }

  return (
    <Context.Provider
      value={{
        tracks,
        progress,
        trackBundles,
        loadTracks,
        loadProgress,
        loadTrack,
        updateStep,
        updateProgress,
        observeDiagnostic,
      }}
    >
      {children}
    </Context.Provider>
  )
}

// Даёт экрану доступ к данным текущего пользователя.
export function useLearningCache() {
  const value = useContext(Context)
  if (!value) throw new Error("useLearningCache требует LearningCacheProvider")
  return value
}

// Берёт список из кэша при возврате со страницы урока.
export function useCachedTracks() {
  const { tracks, loadTracks } = useLearningCache()
  useEffect(() => {
    if (!tracks.data && !tracks.error) loadTracks()
  }, [tracks.data, tracks.error, loadTracks])
  return { ...tracks, loading: !tracks.data && !tracks.error, reload: loadTracks }
}

// Одни и те же данные о допуске используются меню и маршрутом проектов.
export function useCachedProgress(enabled = true) {
  const { progress, loadProgress } = useLearningCache()
  useEffect(() => {
    if (enabled && !progress.data && !progress.error) loadProgress()
  }, [enabled, progress.data, progress.error, loadProgress])
  return { ...progress, loading: enabled && !progress.data && !progress.error, reload: loadProgress }
}

// Переключение шагов не меняет ключ трека и не запускает загрузку.
export function useCachedTrack(trackId: string | undefined) {
  const { trackBundles, loadTrack } = useLearningCache()
  const result = (trackId && trackBundles[trackId]) || empty
  useEffect(() => {
    if (trackId && !result.data && !result.error) loadTrack(trackId)
  }, [trackId, result.data, result.error, loadTrack])
  return {
    ...result,
    loading: Boolean(trackId && !result.data && !result.error),
    reload: () => {
      if (trackId) loadTrack(trackId)
    },
  }
}

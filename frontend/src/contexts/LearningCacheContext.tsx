import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { errorMessage } from "../api/client"
import { useApp } from "./AppContext"
import {
  fetchLearningProgress,
  fetchDiagnostic,
  fetchTracks,
  fetchTrackSteps,
  type Diagnostic,
  type LearningAnswer,
  type LearningProgress,
  type LearningStep,
  type Track,
  type TrackBundle,
  type TrackStep,
} from "../api/learning"

type Resource<T> = { data: T | null, error: string | null }
type LearningCache = {
  diagnostic: Resource<Diagnostic>
  setDiagnostic: (diagnostic: Diagnostic | null) => void
  applyDiagnosticDraft: (diagnostic: Diagnostic, savedAt: number) => void
  loadDiagnostic: () => void
  tracks: Resource<Track[]>
  progress: Resource<LearningProgress>
  trackBundles: Record<string, Resource<TrackBundle>>
  loadTracks: () => void
  loadProgress: () => void
  loadTrack: (trackId: string) => void
  updateStep: (step: LearningStep) => void
  updateDraft: (trackId: string, stepId: string, draft: LearningAnswer | null, savedAt: number) => void
  updateProgress: (progress: LearningProgress) => void
}

const empty = { data: null, error: null }
const Context = createContext<LearningCache | null>(null)

// Кэш живёт в кабинете одного аккаунта и сохраняется при возврате к списку.
export function LearningCacheProvider({ children }: { children: ReactNode }) {
  const { session } = useApp()
  const audience = session.status === "ready" ? session.profile.audience : "student"
  // Список, права на проекты и полностью загруженные уроки.
  const [tracks, setTracks] = useState<Resource<Track[]>>(empty)
  const [diagnostic, setDiagnosticState] = useState<Resource<Diagnostic>>(empty)
  const [progress, setProgress] = useState<Resource<LearningProgress>>(empty)
  const [trackBundles, setTrackBundles] = useState<Record<string, Resource<TrackBundle>>>({})
  // Один запрос на ресурс. Старые ответы игнорируются после отмены.
  const pending = useRef(new Map<string, AbortController>())
  const diagnosticClock = useRef(0)
  const draftClocks = useRef(new Map<string, number>())

  // Результат явного действия заменяет старый запрос диагностики.
  function setDiagnostic(next: Diagnostic | null) {
    cancel("diagnostic")
    diagnosticClock.current = Date.now()
    setDiagnosticState({ data: next, error: null })
  }

  // Ответ черновика учитывается при возврате к форме, если ещё актуален.
  function applyDiagnosticDraft(next: Diagnostic, savedAt: number) {
    if (savedAt < diagnosticClock.current) return
    diagnosticClock.current = savedAt
    setDiagnosticState({ data: next, error: null })
  }

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
    void load("tracks", (signal) => fetchTracks(signal, audience), setTracks, tracks.data)
  }

  function loadProgress() {
    void load("progress", (signal) => fetchLearningProgress(signal, audience), setProgress, progress.data)
  }

  function loadDiagnostic() {
    void load("diagnostic", (signal) => fetchDiagnostic(signal, audience), setDiagnosticState, diagnostic.data)
  }

  // Один фоновый опрос поддерживает статус диагностики актуальным на всех экранах.
  useEffect(() => {
    if (diagnostic.data?.status !== "checking") return
    const controller = new AbortController()
    async function poll() {
      while (!controller.signal.aborted) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 5000))
        if (controller.signal.aborted) return
        try {
          const latest = await fetchDiagnostic(controller.signal, audience)
          if (!controller.signal.aborted) setDiagnosticState({ data: latest, error: null })
          if (latest.status !== "checking") return
        } catch {
          // Временная ошибка не прерывает фоновую проверку.
        }
      }
    }
    void poll()
    return () => controller.abort()
  }, [diagnostic.data?.status])

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
    draftClocks.current.set(step.id, Date.now())
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

  // Меняет только черновик, сохраняя ответ проверки и доступность остальных шагов.
  function updateDraft(trackId: string, stepId: string, draft: LearningAnswer | null, savedAt: number) {
    if (savedAt <= (draftClocks.current.get(stepId) ?? 0)) return
    draftClocks.current.set(stepId, savedAt)
    setTrackBundles((current) => {
      const resource = current[trackId]
      if (!resource?.data) return current
      return {
        ...current,
        [trackId]: {
          ...resource,
          data: {
            ...resource.data,
            lessons: resource.data.lessons.map((step) => step.id === stepId ? { ...step, draft } : step),
          },
        },
      }
    })
  }

  // Обновляет счётчики и доступность следующего шага из ответа сервера.
  function updateProgress(next: LearningProgress) {
    if (next.audience === audience) {
      cancel("progress")
      setProgress({ data: next, error: null })
    } else {
      cancel("progress")
      loadProgress()
    }
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

  // Появление результата меняет зачёты даже если пользователь сейчас внутри урока.
  useEffect(() => {
    if (diagnostic.data?.status !== "completed") return
    if (tracks.data || pending.current.has("tracks")) {
      cancel("tracks")
      loadTracks()
    }
    if (progress.data || pending.current.has("progress")) {
      cancel("progress")
      loadProgress()
    }
    for (const id of Object.keys(trackBundles)) {
      cancel(`track:${id}`)
      loadTrack(id)
    }
  }, [diagnostic.data?.status])

  return (
    <Context.Provider
      value={{
        diagnostic,
        setDiagnostic,
        applyDiagnosticDraft,
        loadDiagnostic,
        tracks,
        progress,
        trackBundles,
        loadTracks,
        loadProgress,
        loadTrack,
        updateStep,
        updateDraft,
        updateProgress,
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

export function useCachedDiagnostic(enabled = true) {
  const { diagnostic, loadDiagnostic, setDiagnostic, applyDiagnosticDraft } = useLearningCache()
  useEffect(() => {
    if (enabled && !diagnostic.data && !diagnostic.error) loadDiagnostic()
  }, [enabled, diagnostic.data, diagnostic.error, loadDiagnostic])
  return {
    ...diagnostic,
    loading: enabled && !diagnostic.data && !diagnostic.error,
    reload: loadDiagnostic,
    setData: setDiagnostic,
    applyDraft: applyDiagnosticDraft,
  }
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

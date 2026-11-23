import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ResourceError } from "../../components/AsyncState/AsyncState"
import useResource from "../../hooks/useResource"
import { fetchDiagnostic, submitDiagnostic } from "../../api/learning"
import AiActivity from "../../components/AsyncState/AiActivity"
import { useToast } from "../../contexts/ToastContext"
import { useCachedTracks, useLearningCache } from "../../contexts/LearningCacheContext"
import styles from "./TracksPage.module.css"

// Показывает прогресс трёх учебных треков с сервера.
export default function TracksPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  // Активная панель зачтённых шагов и состояние повтора диагностики.
  const [retrying, setRetrying] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const { trackBundles, loadTrack, observeDiagnostic } = useLearningCache()
  const tracks = useCachedTracks()
  const diagnostic = useResource("diagnostic", fetchDiagnostic)

  useEffect(() => {
    if (diagnostic.data?.status !== "checking") return
    const controller = new AbortController()

    async function poll() {
      while (!controller.signal.aborted) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 5000))
        if (controller.signal.aborted) return
        try {
          const latest = await fetchDiagnostic(controller.signal)
          diagnostic.setData(latest)
          if (latest.status !== "checking") return
        } catch {
          // При временном сбое запроса продолжаем опрашивать, не скрывая обучение.
        }
      }
    }

    void poll()
    return () => controller.abort()
  }, [diagnostic.data?.status])

  useEffect(() => {
    if (diagnostic.data) observeDiagnostic(diagnostic.data)
  }, [diagnostic.data, observeDiagnostic])

  async function retryCheck() {
    if (!diagnostic.data || retrying) return
    setRetrying(true)
    try {
      diagnostic.setData(await submitDiagnostic(diagnostic.data.answers))
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось повторить проверку",
        type: "error",
      })
    } finally {
      setRetrying(false)
    }
  }

  // Загруженные шаги используются и здесь, и при открытии урока.
  function toggleTrackDetails(trackId: string) {
    setExpanded(expanded === trackId ? null : trackId)
    if (expanded !== trackId && !trackBundles[trackId]?.data) loadTrack(trackId)
  }
  const detail = expanded ? trackBundles[expanded] : undefined

  return (
    <div className={styles.page}>
      <div className={styles.fixedTop}>
        {diagnostic.data?.status === "checking" && (
          <AiActivity
            compact
            status="checking"
            message="ИИ проверяет входной тест. Можно продолжать обучение."
          />
        )}
        {diagnostic.data?.check_unavailable && (
          <AiActivity
            compact
            status="check_unavailable"
            message="Тест сохранён, проверка ИИ не завершилась."
            onRetry={() => void retryCheck()}
            retrying={retrying}
          />
        )}
        <div className={styles.headerRow}>
          <div className={styles.headingCol}>
            <div className={styles.title} role="heading" aria-level={1}>
              ОБУЧЕНИЕ
            </div>
            <div className={styles.subtitle}>Начните с проверки идеи</div>
          </div>
          <button
            type="button"
            className={styles.testBtn}
            onClick={() =>
              navigate(
                diagnostic.data?.status === "completed" || diagnostic.data?.status === "checking"
                  ? "/learning/results"
                  : "/learning/test",
              )
            }
          >
            {diagnostic.data?.status === "completed"
              ? "Результаты теста"
              : diagnostic.data?.status === "checking"
                ? "Статус проверки"
                : "Пройти входной тест"}
          </button>
        </div>
      </div>
      <div className={styles.scrollBody}>
        <div className={styles.grid}>
          {tracks.loading && (
            <div className={styles.skeletonGrid} role="status" aria-label="Загружаем треки">
              {Array.from({ length: 3 }, (_, index) => (
                <div className={styles.card} key={index} aria-hidden="true">
                  <div className={`${styles.imageWrap} ${styles.placeholder}`} />
                  <div className={`${styles.placeholder} ${styles.headingPlaceholder}`} />
                  <div className={`${styles.placeholder} ${styles.descriptionPlaceholder}`} />
                  <div className={`${styles.placeholder} ${styles.actionPlaceholder}`} />
                </div>
              ))}
            </div>
          )}
          {tracks.error && !tracks.data && (
            <div className={styles.skeletonGrid}>
              <ResourceError message={tracks.error} retry={tracks.reload} />
            </div>
          )}
          {tracks.data?.map((track) => (
            <div key={track.id} className={styles.card}>
              <div className={styles.imageWrap}>
                {track.cover_url && <img src={track.cover_url} alt="" className={styles.image} />}
              </div>
              <div className={styles.cardTitle}>{track.title}</div>
              <div className={styles.cardDesc}>{track.description}</div>
              <div className={styles.progressText}>
                Обязательных шагов: {track.credited_required_count} из {track.required_count}
              </div>
              {track.credited_count > 0 && (
                <button
                  type="button"
                  className={styles.detailBtn}
                  onClick={() => toggleTrackDetails(track.id)}
                  aria-expanded={expanded === track.id}
                >
                  {expanded === track.id ? "Скрыть зачтённые шаги" : "Посмотреть зачтённые шаги"}
                </button>
              )}
              {expanded === track.id && (
                <div className={styles.creditedSteps}>
                  {detail?.error && !detail.data && (
                    <ResourceError message={detail.error} retry={() => loadTrack(track.id)} />
                  )}
                  {!detail?.data && !detail?.error && (
                    <div
                      className={`${styles.placeholder} ${styles.headingPlaceholder}`}
                      role="status"
                      aria-label="Загружаем зачёты"
                    />
                  )}
                  {detail?.data?.track.steps.every((step) => !step.credited) && (
                    <span>Зачтённых шагов пока нет</span>
                  )}
                  {detail?.data?.track.steps
                    .filter((step) => step.credited)
                    .map((step) => (
                      <button
                        key={step.id}
                        type="button"
                        className={styles.creditedStep}
                        onClick={() =>
                          navigate(`/learning/track/${track.id}?step=${encodeURIComponent(step.id)}`)
                        }
                      >
                        <span>{step.title}</span>
                        <span className={styles.creditSource}>
                          {step.credit_source === "diagnostic"
                            ? "Зачтён входной диагностикой · Открыть"
                            : "Пройден · Открыть"}
                        </span>
                      </button>
                    ))}
                </div>
              )}
              <div className={styles.cardFooter}>
                <button
                  type="button"
                  className={styles.startBtn}
                  onClick={() =>
                    navigate(`/learning/track/${track.id}?step=${encodeURIComponent(track.current_step_id)}`)
                  }
                >
                  {track.status === "completed"
                    ? "Повторить трек"
                    : track.status === "in_progress"
                      ? "Продолжить трек"
                      : "Начать трек"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

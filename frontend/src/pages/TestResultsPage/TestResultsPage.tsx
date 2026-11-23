import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { LoadingSkeleton, ResourceError } from "../../components/AsyncState/AsyncState"
import useResource from "../../hooks/useResource"
import { fetchDiagnostic, restartDiagnostic, submitDiagnostic } from "../../api/learning"
import AiActivity from "../../components/AsyncState/AiActivity"
import { useToast } from "../../contexts/ToastContext"
import { useCachedTracks, useLearningCache } from "../../contexts/LearningCacheContext"
import LightbulbIcon from "../../assets/icons/lightbulb.svg?react"
import TerminalIcon from "../../assets/icons/terminal.svg?react"
import ChartUpIcon from "../../assets/icons/chart-up.svg?react"
import styles from "./TestResultsPage.module.css"

// Показывает баллы диагностики, рассчитанные сервером.
export default function TestResultsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  // Загружает завершённый результат и названия треков.
  const diagnostic = useResource("diagnostic", fetchDiagnostic)
  const tracks = useCachedTracks()
  const { observeDiagnostic } = useLearningCache()

  useEffect(() => {
    if (diagnostic.data) observeDiagnostic(diagnostic.data)
  }, [diagnostic.data, observeDiagnostic])

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
          // Сетевая ошибка опроса не скрывает результат и не останавливает ожидание.
        }
      }
    }

    void poll()
    return () => controller.abort()
  }, [diagnostic.data?.status])

  async function retryCheck() {
    if (!diagnostic.data || busy) return
    setBusy(true)
    try {
      diagnostic.setData(await submitDiagnostic(diagnostic.data.answers))
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось повторить проверку",
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  async function retake() {
    setBusy(true)
    try {
      diagnostic.setData(await restartDiagnostic())
      navigate("/learning/test")
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось начать тест заново",
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  if (diagnostic.loading || (diagnostic.data?.results && tracks.loading))
    return (
      <div className={styles.page}>
        <div className={styles.title} role="heading" aria-level={1}>
          ВХОДНОЕ ТЕСТИРОВАНИЕ
        </div>
        <LoadingSkeleton variant="cards" count={3} />
      </div>
    )
  if (diagnostic.error || !diagnostic.data)
    return (
      <ResourceError
        message={diagnostic.error ?? "Не удалось загрузить результат"}
        retry={diagnostic.reload}
      />
    )
  if (diagnostic.data.results && tracks.error && !tracks.data)
    return <ResourceError message={tracks.error ?? "Не удалось загрузить треки"} retry={tracks.reload} />
  if (!diagnostic.data.results && diagnostic.data.status === "checking")
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>ПРОВЕРКА ВХОДНОГО ТЕСТА</h1>
        <AiActivity
          status="checking"
          message="ИИ проверяет ответы. Можно перейти к обучению, не дожидаясь результата."
        />
        <div className={styles.footerRow}>
          <button type="button" className={styles.primaryBtn} onClick={() => navigate("/learning")}>
            Перейти к обучению
          </button>
        </div>
      </div>
    )
  if (!diagnostic.data.results && diagnostic.data.check_unavailable)
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>ПРОВЕРКА ВХОДНОГО ТЕСТА</h1>
        <AiActivity
          status="check_unavailable"
          message="Ответы сохранены. Повторите проверку или начните обучение."
          onRetry={() => void retryCheck()}
          retrying={busy}
        />
        <div className={styles.footerRow}>
          <button type="button" className={styles.primaryBtn} onClick={() => navigate("/learning")}>
            Перейти к обучению
          </button>
        </div>
      </div>
    )
  if (!diagnostic.data.results)
    return (
      <div className={styles.page}>
        <div className={styles.headingCol}>
          <div className={styles.title} role="heading" aria-level={1}>
            РЕЗУЛЬТАТ ТЕСТА
          </div>
          <div className={styles.subtitle}>Сначала завершите входное тестирование.</div>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => navigate("/learning/test")}>
          Продолжить тест
        </button>
      </div>
    )

  return (
    <div className={styles.page}>
      <div className={styles.headingCol}>
        <div className={styles.title} role="heading" aria-level={1}>
          РЕЗУЛЬТАТ ТЕСТА
        </div>
        <div className={styles.subtitle}>
          Результат показывает стартовый уровень и помогает выбрать объём обучения. Это ориентир для маршрута.
        </div>
      </div>
      {diagnostic.data.status === "checking" && (
        <AiActivity status="checking" message="ИИ проверяет ответы. Вы можете продолжить обучение." />
      )}
      {diagnostic.data.check_unavailable && (
        <AiActivity
          status="check_unavailable"
          message="Ответы и прежний результат сохранены. Уже зачтённые шаги останутся доступными."
          onRetry={() => void retryCheck()}
          retrying={busy}
        />
      )}
      <div className={styles.grid}>
        {diagnostic.data.results.map((result, index) => {
          const track = tracks.data?.find((item) => item.id === result.track_id)
          const Icon = index === 0 ? LightbulbIcon : index === 1 ? TerminalIcon : ChartUpIcon
          return (
            <div key={result.track_id} className={styles.card}>
              <div className={styles.iconBox}>
                <Icon className={styles.cardIcon} aria-hidden="true" />
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardTitle}>{track?.title ?? result.track_id}</div>
                <div className={styles.cardDesc}>{track?.description ?? ""}</div>
              </div>
              <div className={styles.divider} />
              <div className={styles.volumeBlock}>
                <div className={styles.volumeLabel}>Стартовый уровень</div>
                <div className={styles.hoursText}>
                  {result.score} из {result.max_score} · зачётов по этому результату:{" "}
                  {result.optional_exercises}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className={styles.footerRow}>
        <button type="button" className={styles.primaryBtn} onClick={() => navigate("/learning")}>
          Перейти к обучению
        </button>
        {(diagnostic.data.status === "completed" || diagnostic.data.status === "skipped") && (
          <button type="button" className={styles.primaryBtn} disabled={busy} onClick={() => void retake()}>
            {busy ? "Подождите…" : "Пройти тест заново"}
          </button>
        )}
      </div>
    </div>
  )
}

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ResourceError } from "../../components/AsyncState/AsyncState"
import { restartDiagnostic, submitDiagnostic } from "../../api/learning"
import { errorMessage } from "../../api/client"
import AiActivity from "../../components/AsyncState/AiActivity"
import { useToast } from "../../contexts/ToastContext"
import { useCachedDiagnostic, useCachedTracks } from "../../contexts/LearningCacheContext"
import LightbulbIcon from "../../assets/icons/lightbulb.svg?react"
import TerminalIcon from "../../assets/icons/terminal.svg?react"
import ChartUpIcon from "../../assets/icons/chart-up.svg?react"
import ArrowRightIcon from "../../assets/icons/arrow-right.svg?react"
import buttonStyles from "../../styles/ButtonContent.module.css"
import styles from "./TestResultsPage.module.css"

const icons = [LightbulbIcon, TerminalIcon, ChartUpIcon]
const trackTitles = ["Проверка идеи", "Запуск MVP", "Первые продажи"]
const volumeSlots = 5

// Показывает результат той попытки, которая завершила проверку.
export default function TestResultsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const diagnostic = useCachedDiagnostic()
  const tracks = useCachedTracks()
  // Блокирует повторное нажатие на время явного запроса.
  const [busy, setBusy] = useState(false)
  const data = diagnostic.data
  const checking = data?.status === "checking"
  const results = data?.status === "completed" || data?.status === "skipped" ? data.results : null
  const loading = diagnostic.loading || Boolean(results && (tracks.loading || busy))

  // Передаёт сохранённые ответы, если пользователь просит проверить их снова.
  async function retryCheck() {
    if (!data || busy) return
    setBusy(true)
    try {
      diagnostic.setData(await submitDiagnostic(data.answers))
    } catch (error) {
      showToast({ message: errorMessage(error, "Не удалось повторить проверку"), type: "error" })
    } finally {
      setBusy(false)
    }
  }

  // Переходит к новому черновику после подтверждения сервера.
  async function retake() {
    if (busy) return
    setBusy(true)
    try {
      diagnostic.setData(await restartDiagnostic())
      navigate("/learning/test")
    } catch (error) {
      showToast({ message: errorMessage(error, "Не удалось начать тест заново"), type: "error" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <div className={styles.headingCol}>
          <div className={styles.title} role="heading" aria-level={1}>РЕЗУЛЬТАТ ТЕСТА</div>
          <div className={styles.subtitle}>
            Результат показывает стартовый уровень и помогает выбрать объём обучения. Это ориентир для маршрута.
          </div>
        </div>
        {results && (
          <button type="button" className={styles.retakeBtn} disabled={busy} onClick={() => void retake()}>
            {busy ? "Подождите…" : "Пройти тест заново"}
          </button>
        )}
      </div>
      {checking && <AiActivity status="checking" message="ИИ проверяет ответы. Можно продолжить обучение." />}
      {data?.check_unavailable && (
        <AiActivity
          status="check_unavailable"
          message="Ответы сохранены. Можно повторить проверку или продолжить обучение."
          onRetry={() => void retryCheck()}
          retrying={busy}
        />
      )}
      {diagnostic.error && !data && <ResourceError message={diagnostic.error} retry={diagnostic.reload} />}
      {results && tracks.error && !tracks.data && <ResourceError message={tracks.error} retry={tracks.reload} />}
      {loading && (
        <div className={styles.grid} role="status" aria-label="Загружаем результаты">
          {icons.map((_, index) => (
            <div key={index} className={`${styles.card} ${styles.skeletonCard}`} aria-hidden="true">
              <div className={styles.skeletonIcon} />
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLine} />
            </div>
          ))}
        </div>
      )}
      {results && !loading && (
        <div className={styles.grid}>
          {results.map((result, index) => {
            const track = tracks.data?.find((item) => item.id === result.track_id)
            const Icon = icons[index] ?? LightbulbIcon
            const recommended = volumeSlots - result.optional_exercises
            return (
              <div key={result.track_id} className={styles.card}>
                <div className={styles.iconBox}><Icon className={styles.cardIcon} aria-hidden="true" /></div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{track?.title ?? trackTitles[index]}</div>
                  <div className={styles.cardDesc}>{track?.description}</div>
                </div>
                <div className={styles.divider} />
                <div className={styles.volumeBlock}>
                  <div className={styles.volumeLabel}>Рекомендуемый объём</div>
                  <div className={styles.levelRow} aria-label={`Рекомендуемый объём: ${recommended} из ${volumeSlots}`}>
                    {Array.from({ length: volumeSlots }, (_, slot) => (
                      <span key={slot} className={`${styles.levelPill} ${slot < recommended ? styles.levelPillActive : ""}`} />
                    ))}
                  </div>
                  <div className={styles.scoreText}>
                    Баллы<span className={styles.scoreDetail}> за трек:</span> {result.score} из {result.max_score}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {data && !results && !checking && !data.check_unavailable && (
        <div className={styles.subtitle}>Завершите входной тест, чтобы увидеть результаты.</div>
      )}
      <div className={styles.footerRow}>
        {data && !results && !checking && !data.check_unavailable && (
          <button
            type="button"
            className={`${styles.retakeBtn} ${buttonStyles.withIcon}`}
            onClick={() => navigate("/learning/test")}
          >
            Продолжить тест
            <ArrowRightIcon aria-hidden="true" />
          </button>
        )}
        <button type="button" className={styles.primaryBtn} onClick={() => navigate("/learning")}>
          Перейти к обучению
        </button>
      </div>
    </div>
  )
}

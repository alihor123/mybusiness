import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ResourceError } from "../../components/AsyncState/AsyncState"
import { submitDiagnostic } from "../../api/learning"
import AiActivity from "../../components/AsyncState/AiActivity"
import { useToast } from "../../contexts/ToastContext"
import { useCachedDiagnostic, useCachedTracks } from "../../contexts/LearningCacheContext"
import ArrowRightIcon from "../../assets/icons/arrow-right.svg?react"
import buttonStyles from "../../styles/ButtonContent.module.css"
import styles from "./TracksPage.module.css"

// Показывает прогресс трёх учебных треков с сервера.
export default function TracksPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  // Состояние повтора проверки диагностики.
  const [retrying, setRetrying] = useState(false)
  const tracks = useCachedTracks()
  const diagnostic = useCachedDiagnostic()
  const hasResult = Boolean(diagnostic.data?.results &&
    (diagnostic.data.status === "completed" || diagnostic.data.status === "skipped"))

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
          {diagnostic.loading ? (
            <div className={styles.testBtnPlaceholder} role="status" aria-label="Загружаем статус теста" />
          ) : <button
            type="button"
            className={styles.testBtn}
            onClick={() =>
              navigate(
                hasResult || diagnostic.data?.status === "checking"
                  ? "/learning/results"
                  : "/learning/test",
              )
            }
          >
            {hasResult
              ? "Результаты теста"
              : diagnostic.data?.status === "checking"
                ? "Статус проверки"
                : "Пройти входной тест"}
          </button>}
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
              <div className={styles.cardFooter}>
                <button
                  type="button"
                  className={`${styles.startBtn} ${buttonStyles.withIcon}`}
                  onClick={() =>
                    navigate(`/learning/track/${track.id}?step=${encodeURIComponent(track.current_step_id)}`)
                  }
                >
                  {track.status === "completed"
                    ? "Повторить трек"
                    : track.status === "in_progress"
                      ? "Продолжить трек"
                      : "Начать трек"}
                  {track.status === "in_progress" && <ArrowRightIcon aria-hidden="true" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

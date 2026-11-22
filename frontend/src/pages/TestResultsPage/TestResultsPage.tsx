import { useNavigate } from "react-router-dom"
import StageTabs from "../../components/StageTabs/StageTabs"
import LightbulbIcon from "../../assets/icons/lightbulb.svg?react"
import TerminalIcon from "../../assets/icons/terminal.svg?react"
import ChartUpIcon from "../../assets/icons/chart-up.svg?react"
import { useApp } from "../../contexts/AppContext"
import type { LearningTrack } from "../../data/mockData"
import styles from "./TestResultsPage.module.css"

const LEVEL_SLOTS = [1, 2, 3, 4, 5]

// Показывает результат диагностики и рекомендуемый объём по каждому треку.
export default function TestResultsPage() {
  const { tracks } = useApp()
  const navigate = useNavigate()

  // Подбирает иконку карточки результата в зависимости от типа трека.
  function renderTrackIcon(kind: LearningTrack["iconKind"]) {
    if (kind === "idea") return <LightbulbIcon className={styles.cardIcon} aria-hidden="true" />
    if (kind === "mvp") return <TerminalIcon className={styles.cardIcon} aria-hidden="true" />
    return <ChartUpIcon className={styles.cardIcon} aria-hidden="true" />
  }

  return (
    <div className={styles.page}>
      <StageTabs active="learning" />

      <div className={styles.headingCol}>
        <div className={styles.title} role="heading" aria-level={1}>
          РЕЗУЛЬТАТ ТЕСТА
        </div>
        <div className={styles.subtitle}>
          Рекомендуем пройти три обучающих трека, чтобы последовательно развивать идею и навыки
        </div>
      </div>

      <div className={styles.grid}>
        {tracks.map((track) => (
          <div key={track.id} className={styles.card}>
            <div className={styles.iconBox}>{renderTrackIcon(track.iconKind)}</div>

            <div className={styles.cardBody}>
              <div className={styles.cardTitle}>{track.title}</div>
              <div className={styles.cardDesc}>{track.resultDescription}</div>
            </div>

            <div className={styles.divider} />

            <div className={styles.volumeBlock}>
              <div className={styles.volumeLabel}>Рекомендуемый объем</div>
              <div className={styles.levelRow} aria-label={`Уровень ${track.recommendedLevel} из 5`}>
                {LEVEL_SLOTS.map((slot) => (
                  <span
                    key={slot}
                    className={`${styles.levelPill} ${slot <= track.recommendedLevel ? styles.levelPillActive : ""}`}
                  />
                ))}
              </div>
              <div className={styles.hoursText}>{track.estimatedHours}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.footerRow}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => navigate("/learning")}
        >
          Перейти к обучению
        </button>
      </div>
    </div>
  )
}

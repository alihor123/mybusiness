import { useNavigate } from "react-router-dom"
import StageTabs from "../../components/StageTabs/StageTabs"
import { useApp } from "../../contexts/AppContext"
import styles from "./TracksPage.module.css"

// Отображает список трёх учебных треков и прогресс прохождения каждого из них.
export default function TracksPage() {
  const { tracks, testCompleted } = useApp()
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.fixedTop}>
        <StageTabs active="learning" />

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
            onClick={() => navigate(testCompleted ? "/learning/results" : "/learning/test")}
          >
            {testCompleted ? "Результаты теста" : "Пройти входной тест"}
          </button>
        </div>
      </div>

      <div className={styles.scrollBody}>
        <div className={styles.grid}>
        {tracks.map((track) => {
          const completedSteps = track.steps.filter((step) => step.completed).length
          const totalSteps = track.steps.length
          const isStarted = completedSteps > 0
          const isFinished = completedSteps === totalSteps

          return (
            <div key={track.id} className={styles.card}>
              <div className={styles.imageWrap}>
                <img src={track.image} alt="" className={styles.image} />
              </div>

              <div className={styles.cardTitle}>{track.title}</div>
              <div className={styles.cardDesc}>{track.cardDescription}</div>

              <div className={styles.progressText}>
                Пройдено шагов: {completedSteps} из {totalSteps}
              </div>

              <div className={styles.cardFooter}>
                <button
                  type="button"
                  className={styles.startBtn}
                  onClick={() => navigate(`/learning/track/${track.id}`)}
                >
                  {isFinished ? "Повторить трек" : isStarted ? "Продолжить трек" : "Начать трек"}
                </button>
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import StageTabs from "../../components/StageTabs/StageTabs"
import { DIAGNOSTIC_QUESTIONS } from "../../data/mockData"
import { useApp } from "../../contexts/AppContext"
import styles from "./DiagnosticTestPage.module.css"

// Проводит входное тестирование и рассчитывает рекомендуемый объём обучения.
export default function DiagnosticTestPage() {
  const { completeTest, skipTest } = useApp()
  const navigate = useNavigate()

  // Хранит текущий номер вопроса и выбранные ответы пользователя.
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({
    q1: 2,
  })

  const currentQuestion = DIAGNOSTIC_QUESTIONS[currentIndex]
  const totalCount = DIAGNOSTIC_QUESTIONS.length
  const selectedOption = selectedAnswers[currentQuestion.id]
  const progressPercent = Math.round(((currentIndex + 1) / totalCount) * 100)

  // Фиксирует выбранный вариант ответа для текущего вопроса.
  function selectOption(optionIndex: number) {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionIndex,
    }))
  }

  // Переходит к следующему вопросу или завершает тест и открывает результаты.
  function handleNext() {
    if (selectedOption === undefined) return
    if (currentIndex < totalCount - 1) {
      setCurrentIndex((prev) => prev + 1)
      return
    }
    completeTest()
    navigate("/learning/results")
  }

  // Пропускает тестирование и открывает полный маршрут обучения.
  function handleSkip() {
    skipTest()
    navigate("/learning")
  }

  return (
    <div className={styles.page}>
      <StageTabs active="learning" />

      <div className={styles.headerRow}>
        <div className={styles.headingCol}>
          <div className={styles.title} role="heading" aria-level={1}>
            ВХОДНОЕ ТЕСТИРОВАНИЕ
          </div>
          <div className={styles.subtitle}>Узнайте свой уровень подготовки</div>
        </div>

        <div className={styles.skipCol}>
          <button type="button" className={styles.skipBtn} onClick={handleSkip}>
            ПРОПУСТИТЬ ТЕСТ
          </button>
          <div className={styles.skipHint}>Без теста — полный маршрут обучения</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.progressRow}>
          <div className={styles.progressLabel}>
            ВОПРОС {currentIndex + 1} ИЗ {totalCount}
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className={styles.questionTitle}>{currentQuestion.question}</div>
        <div className={styles.instruction}>Выберите один вариант ответа</div>

        <div className={styles.optionsList} role="radiogroup" aria-label="Варианты ответа">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedOption === idx
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`${styles.optionBtn} ${isSelected ? styles.optionBtnSelected : ""}`}
                onClick={() => selectOption(idx)}
              >
                <span className={`${styles.radioOuter} ${isSelected ? styles.radioOuterSelected : ""}`}>
                  {isSelected && <span className={styles.radioInner} />}
                </span>
                <span className={styles.optionText}>{option}</span>
              </button>
            )
          })}
        </div>

        <div className={styles.actionsRow}>
          {currentIndex > 0 && (
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => setCurrentIndex((prev) => prev - 1)}
            >
              Назад
            </button>
          )}
          <button
            type="button"
            className={styles.nextBtn}
            disabled={selectedOption === undefined}
            onClick={handleNext}
          >
            {currentIndex === totalCount - 1 ? "Завершить тест" : "Далее"}
          </button>
        </div>
      </div>
    </div>
  )
}

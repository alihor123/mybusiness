import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import CustomSelect from "../../components/CustomSelect/CustomSelect"
import AiActivity from "../../components/AsyncState/AiActivity"
import { LoadingSkeleton, ResourceError } from "../../components/AsyncState/AsyncState"
import useResource from "../../hooks/useResource"
import { useToast } from "../../contexts/ToastContext"
import {
  fetchDiagnostic,
  saveDiagnosticDraft,
  skipDiagnostic,
  submitDiagnostic,
  type LearningAnswer,
} from "../../api/learning"
import styles from "./DiagnosticTestPage.module.css"

// Заголовок и пропуск теста остаются на месте во время первой загрузки вопросов.
function DiagnosticHeading({
  onSkip,
  hasResult,
  busy,
}: {
  onSkip?: () => void
  hasResult?: boolean
  busy?: boolean
}) {
  return (
    <div className={styles.headerRow}>
      <div className={styles.headingCol}>
        <div className={styles.title} role="heading" aria-level={1}>
          ВХОДНОЕ ТЕСТИРОВАНИЕ
        </div>
        <div className={styles.subtitle}>Узнайте свой уровень подготовки</div>
      </div>
      <div className={styles.skipCol}>
        <button
          type="button"
          name="diagnostic-navigation"
          className={styles.skipBtn}
          onClick={onSkip}
          disabled={busy || !onSkip}
        >
          ПРОПУСТИТЬ ТЕСТ
        </button>
        <div className={styles.skipHint}>
          {hasResult ? "Прежние зачёты сохранятся" : "Без теста доступен полный маршрут"}
        </div>
      </div>
    </div>
  )
}

// Проводит входное тестирование и сохраняет ответы на сервере.
export default function DiagnosticTestPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  // Загружает вопросы и сохранённый черновик диагностики.
  const resource = useResource("diagnostic", fetchDiagnostic)
  // Хранит ответы формы и номер вопроса между запросами.
  const [answers, setAnswers] = useState<Record<string, LearningAnswer>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!resource.data) return
    setAnswers(resource.data.answers)
    const index = resource.data.questions.findIndex(
      (question) => question.id === resource.data?.current_question_id,
    )
    setCurrentIndex(Math.max(0, index))
    if (resource.data.status === "completed" || resource.data.status === "checking")
      navigate("/learning/results", { replace: true })
  }, [resource.data, navigate])
  if (!resource.data)
    return (
      <div className={styles.page}>
        <DiagnosticHeading />
        {resource.loading ? (
          <div className={styles.card}>
            <LoadingSkeleton variant="form" />
          </div>
        ) : (
          <ResourceError message={resource.error ?? "Не удалось загрузить тест"} retry={resource.reload} />
        )}
      </div>
    )

  const { questions } = resource.data
  const question = questions[currentIndex]
  if (!question) return <ResourceError message="Вопросы теста недоступны" retry={resource.reload} />
  const answer = answers[question.id]
  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100)

  // Обновляет черновик после ответа и сохраняет текущий вопрос.
  async function choose(value: LearningAnswer) {
    if (busy) return
    const next = { ...answers, [question.id]: value }
    setAnswers(next)
    setBusy(true)
    try {
      const saved = await saveDiagnosticDraft({ answers: next, current_question_id: question.id })
      resource.setData(saved)
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось сохранить ответ",
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  // Сохраняет свободный ответ при выходе из поля, не отправляя каждый символ.
  async function saveCurrentDraft() {
    if (busy || answer === resource.data?.answers[question.id]) return
    setBusy(true)
    try {
      const saved = await saveDiagnosticDraft({ answers, current_question_id: question.id })
      resource.setData(saved)
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось сохранить ответ",
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  // Сохраняет следующий вопрос вместе с черновиком перед переходом.
  async function moveNext() {
    if (busy) return
    if (currentIndex >= questions.length - 1) {
      await finish()
      return
    }
    const nextIndex = currentIndex + 1
    setBusy(true)
    try {
      const saved = await saveDiagnosticDraft({ answers, current_question_id: questions[nextIndex].id })
      resource.setData(saved)
      setCurrentIndex(nextIndex)
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось сохранить ответ",
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  // Сохраняет текущий вопрос перед возвратом к предыдущему.
  async function moveBack() {
    if (busy) return
    if (currentIndex <= 0) return
    setBusy(true)
    try {
      const saved = await saveDiagnosticDraft({
        answers,
        current_question_id: questions[currentIndex - 1].id,
      })
      resource.setData(saved)
      setCurrentIndex((index) => index - 1)
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось сохранить ответ",
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  // Возвращает, заполнен ли ответ целиком для выбранного типа вопроса.
  function hasAnswer() {
    if (question.type === "free") return typeof answer === "string" && Boolean(answer.trim())
    if (question.type === "matching")
      return (
        Boolean(question.options?.left?.length) &&
        typeof answer === "object" &&
        answer !== null &&
        question.options?.left?.every((item) => Boolean(answer[item.id]))
      )
    return typeof answer === "string" && Boolean(answer)
  }

  // Проверяет заполнение теста и отправляет серверу полный набор ответов.
  async function finish(retry = false) {
    if (busy || resource.data?.status === "checking") return
    if (questions.some((item) => !answers[item.id])) {
      showToast({ message: "Ответьте на все вопросы", type: "neutral" })
      return
    }
    setBusy(true)
    try {
      const result = await submitDiagnostic(answers)
      resource.setData(result)
      if (retry || result.status === "checking") navigate("/learning/results")
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось проверить ответы",
        type: "error",
        persistent: true,
      })
      resource.reload()
    } finally {
      setBusy(false)
    }
  }

  // Пропускает диагностику на сервере и открывает треки.
  async function skip() {
    if (busy) return
    setBusy(true)
    try {
      if (question.type === "free" && answer !== resource.data?.answers[question.id]) {
        await saveDiagnosticDraft({ answers, current_question_id: question.id })
      }
      await skipDiagnostic()
      navigate("/learning")
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось пропустить тест",
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <DiagnosticHeading onSkip={skip} hasResult={Boolean(resource.data.results)} busy={busy} />
      <div className={styles.card}>
        {resource.data.check_unavailable && (
          <AiActivity
            status="check_unavailable"
            message="Ответы сохранены. Повторите проверку или продолжите обучение."
            onRetry={() => void finish(true)}
            retrying={busy}
          />
        )}
        <div className={styles.progressRow}>
          <div className={styles.progressLabel}>
            ВОПРОС {currentIndex + 1} ИЗ {questions.length}
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <div className={styles.questionTitle}>{question.prompt}</div>
        <div className={styles.instruction}>Выберите или введите ответ</div>
        {question.type === "choice" && question.options?.choices && (
          <div className={styles.optionsList} role="radiogroup">
            {question.options.choices.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={answer === option.id}
                className={`${styles.optionBtn} ${answer === option.id ? styles.optionBtnSelected : ""}`}
                disabled={busy}
                onClick={() => choose(option.id)}
              >
                <span
                  className={`${styles.radioOuter} ${answer === option.id ? styles.radioOuterSelected : ""}`}
                >
                  {answer === option.id && <span className={styles.radioInner} />}
                </span>
                <span className={styles.optionText}>{option.text}</span>
              </button>
            ))}
          </div>
        )}
        {question.type === "free" && (
          <textarea
            className={styles.optionBtn}
            value={typeof answer === "string" ? answer : ""}
            onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
            onBlur={(event) => {
              if (!event.relatedTarget?.matches('[name="diagnostic-navigation"]')) void saveCurrentDraft()
            }}
            aria-label="Ваш ответ"
            disabled={busy}
          />
        )}
        {question.type === "matching" && question.options?.left && question.options.right && (
          <div className={styles.optionsList}>
            {question.options.left.map((item) => (
              <div key={item.id} className={styles.matchingRow}>
                <span className={styles.optionText}>{item.text}</span>
                <CustomSelect
                  ariaLabel={`Соответствие для: ${item.text}`}
                  placeholder="Выберите соответствие"
                  value={typeof answer === "object" && answer ? (answer[item.id] ?? "") : ""}
                  disabled={busy}
                  options={(question.options?.right ?? []).map((option) => ({
                    id: option.id,
                    label: option.text,
                  }))}
                  onChange={(right) => {
                    const next = { ...(typeof answer === "object" && answer ? answer : {}) }
                    for (const key of Object.keys(next)) if (next[key] === right) delete next[key]
                    next[item.id] = right
                    void choose(next)
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <div className={styles.actionsRow}>
          {currentIndex > 0 && (
            <button
              type="button"
              name="diagnostic-navigation"
              className={styles.backBtn}
              disabled={busy}
              onClick={moveBack}
            >
              Назад
            </button>
          )}
          <button
            type="button"
            name="diagnostic-navigation"
            className={styles.nextBtn}
            disabled={busy || !hasAnswer()}
            onClick={moveNext}
          >
            {busy ? "Сохраняем…" : currentIndex === questions.length - 1 ? "Завершить тест" : "Далее"}
          </button>
        </div>
      </div>
    </div>
  )
}

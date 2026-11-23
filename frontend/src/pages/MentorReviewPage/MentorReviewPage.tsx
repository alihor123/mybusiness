import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { getProjectPlan } from "../../api/projects"
import { decideSubmission, downloadAttachment } from "../../api/accompaniment"
import useResource from "../../hooks/useResource"
import { LoadingSkeleton, ResourceError } from "../../components/AsyncState/AsyncState"
import AiActivity from "../../components/AsyncState/AiActivity"
import { useToast } from "../../contexts/ToastContext"
import styles from "./MentorReviewPage.module.css"

// Загружает задачи проекта наставника и показывает решения по выбранной работе.
export default function MentorReviewPage() {
  const { projectId = "", taskId = "" } = useParams()
  const {
    data: plan,
    loading,
    error,
    reload,
  } = useResource(`mentor-plan-${projectId}`, (signal) => getProjectPlan(projectId, signal))
  const { showToast } = useToast()
  // Черновик комментария, ответ сервера и защита от повторного решения.
  const [comment, setComment] = useState("")
  const [decisionError, setDecisionError] = useState(false)
  const [busy, setBusy] = useState(false)
  if (loading && !plan) return (
    <div className={styles.page}>
      <Link to="/mentor/projects" className={styles.backLink}>← К списку проектов</Link>
      <div className={styles.headerRow}>
        <div className={styles.headingCol}>
          <div className={styles.title} role="heading" aria-level={1}>ПРОВЕРКА РАБОТ</div>
        </div>
      </div>
      <LoadingSkeleton variant="lesson" />
    </div>
  )
  if (error) return <ResourceError message={error} retry={reload} />
  const task = plan?.tasks.find((item) => item.id === taskId)
  if (!task) return <div>Задача не найдена</div>
  const submission = task.submissions[task.submissions.length - 1]
  const canAccept = task.allowed_actions.includes("accept")
  const canRequestRevision = task.allowed_actions.includes("request_revision")

  // Перечитывает историю и оставляет на экране подтверждение решения.
  async function decide(decision: "accept" | "revision_requested") {
    if (!submission || busy) return
    setBusy(true)
    setDecisionError(false)
    try {
      await decideSubmission(submission.id, decision, comment)
      const message = decision === "accept" ? "Работа принята" : "Работа возвращена на доработку"
      showToast({ message, type: "success" })
      reload()
    } catch (error) {
      setDecisionError(true)
    } finally {
      setBusy(false)
    }
  }

  // Скачивает защищённое вложение в текущей сессии наставника.
  async function download(id: string, name: string) {
    try {
      const blob = await downloadAttachment(id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = name
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось скачать файл",
        type: "error",
      })
    }
  }
  return (
    <div className={styles.page}>
      <Link to="/mentor/projects" className={styles.backLink}>
        ← К списку проектов
      </Link>
      <div className={styles.headerRow}>
        <div className={styles.headingCol}>
          <div className={styles.title} role="heading" aria-level={1}>
            ПРОВЕРКА РАБОТ
          </div>
          <div className={styles.context}>{task.title}</div>
        </div>
        <div className={styles.statusBadge}>
          {task.status === "accepted"
            ? "Принято"
            : task.status === "revision_requested"
              ? "На доработке"
              : task.status === "submitted"
                ? "На проверке"
                : "Черновик"}
        </div>
      </div>
      <section className={styles.criteriaCard}>
        <div className={styles.cardHeadingSmall}>Условие</div>
        <div className={styles.criteriaText}>{task.condition}</div>
        <ul>
          {task.criteria.map((criterion) => (
            <li key={criterion}>{criterion}</li>
          ))}
        </ul>
      </section>
      <div className={styles.reviewGrid}>
        <section className={styles.panelCard}>
          <div className={styles.cardHeading}>История отправок</div>
          {task.submissions.map((item) => {
            const attachment = item.attachment
            return (
              <article key={item.id}>
                <strong>
                  Работа {item.number} · {new Date(item.created_at).toLocaleString("ru-RU")}
                </strong>
                <p>{item.text}</p>
                {item.decision_comment && <p>{item.decision_comment}</p>}
                {attachment && (
                  <button
                    type="button"
                    className={styles.downloadBtn}
                    onClick={() => void download(attachment.id, attachment.filename)}
                  >
                    Скачать {attachment.filename}
                  </button>
                )}
              </article>
            )
          })}
          {!submission && <p>Отправок пока нет</p>}
        </section>
        {(canAccept || canRequestRevision) && (
          <section className={styles.panelCard}>
            <label className={styles.commentLabel}>
              Комментарий наставника
              <textarea
                className={styles.commentTextarea}
                value={comment}
                maxLength={4000}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            <div className={styles.decisionRow}>
              {canRequestRevision && (
                <button
                  type="button"
                  className={styles.outlineBtn}
                  disabled={busy || !comment.trim()}
                  onClick={() => void decide("revision_requested")}
                >
                  На доработку
                </button>
              )}
              {canAccept && (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={busy}
                  onClick={() => void decide("accept")}
                >
                  Принять результат
                </button>
              )}
            </div>
          </section>
        )}
      </div>
      {busy && <AiActivity status="checking" compact message="Сохраняем решение наставника" />}
      {decisionError && <AiActivity status="check_unavailable" compact message="Не удалось сохранить решение" onRetry={() => void decide(canAccept ? "accept" : "revision_requested")} />}
    </div>
  )
}

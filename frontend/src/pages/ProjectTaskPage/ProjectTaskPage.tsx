import { useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { getProjectPlan } from "../../api/projects"
import { saveTaskDraft, submitTask, previewTask } from "../../api/accompaniment"
import useResource from "../../hooks/useResource"
import { createRequestId, errorMessage } from "../../api/client"
import { LoadingSkeleton, ResourceError } from "../../components/AsyncState/AsyncState"
import AiActivity from "../../components/AsyncState/AiActivity"
import { useToast } from "../../contexts/ToastContext"
import styles from "./ProjectTaskPage.module.css"

export default function ProjectTaskPage() {
  const { projectId = "", taskId = "" } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const {
    data: plan,
    loading,
    error,
    reload,
  } = useResource(`project-plan-${projectId}`, (signal) => getProjectPlan(projectId, signal))
  const task = plan?.tasks.find((item) => item.id === taskId)
  const [text, setText] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [removeAttachment, setRemoveAttachment] = useState(false)
  const [remarks, setRemarks] = useState<string[] | null>(null)
  const [pending, setPending] = useState<"save" | "submit" | "preview" | null>(null)
  const [checkError, setCheckError] = useState("")
  const requestKey = useRef<{ signature: string, key: string } | null>(null)
  if (loading && !plan) return (
    <div className={styles.page}>
      <Link to={`/projects/${projectId}`} className={styles.backLink}>← К плану проекта</Link>
      <div className={styles.title} role="heading" aria-level={1}>ЗАДАЧА ПРОЕКТА</div>
      <LoadingSkeleton variant="form" />
    </div>
  )
  if (error) return <ResourceError message={error} retry={reload} />
  if (!task) return <div>Задача не найдена</div>
  const currentTask = task
  const answer = text ?? task.draft_text ?? ""
  const action = file ? "replace" : removeAttachment ? "remove" : "keep"
  const signature = `${answer}\u0000${action}\u0000${file ? `${file.name}:${file.size}:${file.lastModified}` : ""}`
  const allowed = new Set(task.allowed_actions)
  const editable = allowed.has("save_draft") || allowed.has("submit")
  const busy = pending !== null
  async function run(operation: "save" | "submit" | "preview") {
    if (busy) return
    setPending(operation)
    try {
      if (operation === "preview") {
        setCheckError("")
        setRemarks(null)
        const result = await previewTask(currentTask.id, answer)
        setRemarks(result.remarks)
      } else if (operation === "save") {
        await saveTaskDraft(currentTask.id, answer, action, file ?? undefined)
        showToast({ message: "Черновик сохранён", type: "success" })
      } else {
        if (!requestKey.current || requestKey.current.signature !== signature) {
          requestKey.current = { signature, key: createRequestId() }
        }
        await submitTask(currentTask.id, answer, requestKey.current.key, action, file ?? undefined)
        requestKey.current = null
        showToast({ message: "Работа отправлена наставнику", type: "success" })
        navigate(`/projects/${projectId}`)
      }
    } catch (error) {
      if (operation === "preview") setCheckError(errorMessage(error, "Не удалось проверить черновик"))
      else
        showToast({
          message: errorMessage(
            error,
            operation === "save" ? "Не удалось сохранить черновик" : "Не удалось отправить работу",
          ),
          type: "error",
        })
    } finally {
      setPending(null)
    }
  }
  return (
    <div className={styles.page}>
      <Link to={`/projects/${projectId}`} className={styles.backLink}>
        ← К плану
      </Link>
      <div className={styles.headingCol}>
        <div className={styles.title} role="heading" aria-level={1}>
          {plan?.tasks.length ? "ЗАДАЧА ПРОЕКТА" : ""}
        </div>
        <div className={styles.taskTitle}>{task.title}</div>
        <div className={styles.instruction}>{task.condition}</div>
      </div>
      <section className={styles.card}>
        <strong>Критерии</strong>
        <ul>
          {task.criteria.map((criterion) => (
            <li key={criterion}>{criterion}</li>
          ))}
        </ul>
        {task.submissions.map((submission) => (
          <article key={submission.id}>
            <strong>
              Отправка {submission.number} · {new Date(submission.created_at).toLocaleString("ru-RU")}
            </strong>
            <p>{submission.text}</p>
            {submission.decision_comment && <p>{submission.decision_comment}</p>}
          </article>
        ))}
        <div className={styles.field}>
          <label htmlFor="project-task-answer">Результаты</label>
          <textarea
            id="project-task-answer"
            disabled={!editable}
            readOnly={busy}
            rows={6}
            className={styles.textarea}
            value={answer}
            onChange={(event) => {
              setText(event.target.value)
              setRemarks(null)
              setCheckError("")
            }}
          />
        </div>
        <div className={styles.filesSection}>
          <strong>Файл (PDF, JPG или PNG, до 10 МБ)</strong>
          {task.draft_attachment && !removeAttachment && !file && (
            <div>
              {task.draft_attachment.filename}{" "}
              {editable && (
                <button type="button" onClick={() => setRemoveAttachment(true)}>
                  Удалить
                </button>
              )}
            </div>
          )}
          {editable && (
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                setRemoveAttachment(false)
              }}
            />
          )}
          {file && (
            <button type="button" onClick={() => setFile(null)}>
              Убрать выбранный файл
            </button>
          )}
        </div>
        {remarks && remarks.length > 0 && (
          <div className={styles.aiBox}>
            <strong>Замечания к черновику</strong>
            <ul>
              {remarks.map((remark) => (
                <li key={remark}>{remark}</li>
              ))}
            </ul>
          </div>
        )}
        {remarks?.length === 0 && (
          <AiActivity status="completed" compact message="Проверка завершилась без замечаний" />
        )}
        {pending === "preview" && <AiActivity status="checking" compact message="ИИ проверяет черновик" />}
        {checkError && <AiActivity status="check_unavailable" compact message={checkError} />}
      </section>
      <div className={styles.actionsRow}>
        {allowed.has("save_draft") && (
          <button className={styles.outlineBtn} disabled={busy} onClick={() => void run("save")}>
            Сохранить черновик
          </button>
        )}
        {allowed.has("preview_check") && (
          <button className={styles.outlineBtn} disabled={busy} onClick={() => void run("preview")}>
            {checkError ? "Повторить проверку" : "Проверить с ИИ"}
          </button>
        )}
        {allowed.has("submit") && (
          <button className={styles.primaryBtn} disabled={busy} onClick={() => void run("submit")}>
            Отправить наставнику
          </button>
        )}
      </div>
    </div>
  )
}

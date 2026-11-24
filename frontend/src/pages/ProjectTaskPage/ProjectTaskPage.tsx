import { useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { getProjectPlan } from "../../api/projects"
import { saveTaskDraft, submitTask, previewTask } from "../../api/accompaniment"
import useResource from "../../hooks/useResource"
import useDraftAutosave from "../../hooks/useDraftAutosave"
import { ApiError, createRequestId, errorMessage } from "../../api/client"
import { LoadingSkeleton, ResourceError } from "../../components/AsyncState/AsyncState"
import AiActivity from "../../components/AsyncState/AiActivity"
import { useToast } from "../../contexts/ToastContext"
import ChevronLeftIcon from "../../assets/icons/chevron-left.svg?react"
import FileIcon from "../../assets/icons/file-text.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import AlertCircleIcon from "../../assets/icons/alert-circle.svg?react"
import CheckIcon from "../../assets/icons/check.svg?react"
import styles from "./ProjectTaskPage.module.css"

type FileEdit = { file: File | null, saved: boolean }

// Задача сопровождения сохраняет изменения ответа по мере ввода.
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
  // Уточнения ученика живут в форме, пока готовится явная отправка.
  const [text, setText] = useState<string | null>(null)
  const [fileEdit, setFileEdit] = useState<FileEdit | null>(null)
  const [remarks, setRemarks] = useState<string[] | null>(null)
  const [pending, setPending] = useState<"submit" | "preview" | null>(null)
  const [checkError, setCheckError] = useState("")
  const requestKey = useRef<{ signature: string, key: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autosave = useDraftAutosave()
  if (loading && !plan) return (
    <div className={styles.page}>
      <Link to={`/projects/${projectId}`} className={styles.backLink}>
        <ChevronLeftIcon className={styles.backIcon} aria-hidden="true" />
        К плану
      </Link>
      <div className={styles.title} role="heading" aria-level={1}>ЗАДАЧА ПРОЕКТА</div>
      <LoadingSkeleton variant="form" />
    </div>
  )
  if (error) return <ResourceError message={error} retry={reload} />
  if (!task) return <div>Задача не найдена</div>
  const currentTask = task
  const answer = text ?? task.draft_text ?? ""
  const file = fileEdit?.file
  const filename = fileEdit ? file?.name : task.draft_attachment?.filename
  const signature = `${answer}\u0000${fileEdit ? (file ? `${file.name}:${file.size}:${file.lastModified}` : "remove") : "keep"}`
  const allowed = new Set(task.allowed_actions)
  const editable = allowed.has("save_draft") || allowed.has("submit")
  const revising = task.status === "revision_requested"
  const busy = pending !== null

  // Отправляет только вложение. Автосохранение текста не повторяет загрузку файла.
  async function editFile(nextFile: File | null) {
    const previousEdit = fileEdit
    const edit = { file: nextFile, saved: false }
    setFileEdit(edit)
    try {
      await saveTaskDraft(currentTask.id, null, nextFile ? "replace" : "remove", Date.now(), nextFile ?? undefined)
      setFileEdit((current) => current === edit ? { ...edit, saved: true } : current)
      if (!nextFile) showToast({ message: "Файл удалён", type: "neutral" })
    } catch (error) {
      // Выбранный файл ещё можно передать при отправке всей работы.
      if (nextFile) return
      setFileEdit((current) => current === edit ? previousEdit : current)
      if (error instanceof ApiError && [0, 502, 504].includes(error.status)) reload()
      showToast({ message: errorMessage(error, "Не удалось удалить файл"), type: "error" })
    }
  }

  // Различает предварительную подсказку ИИ и сдачу работы наставнику.
  async function run(operation: "submit" | "preview") {
    if (busy) return
    setPending(operation)
    try {
      if (operation === "preview") {
        setCheckError("")
        setRemarks(null)
        const result = await previewTask(currentTask.id, answer)
        setRemarks(result.remarks)
      } else {
        if (!requestKey.current || requestKey.current.signature !== signature) {
          requestKey.current = { signature, key: createRequestId() }
        }
        const action = !fileEdit || fileEdit.saved ? "keep" : file ? "replace" : "remove"
        await submitTask(currentTask.id, answer, requestKey.current.key, action, action === "replace" ? file ?? undefined : undefined)
        autosave.cancel()
        requestKey.current = null
        showToast({ message: "Работа отправлена наставнику", type: "success" })
        navigate(`/projects/${projectId}`)
      }
    } catch (error) {
      if (operation === "preview") setCheckError(errorMessage(error, "Не удалось проверить черновик"))
      else
        showToast({
          message: errorMessage(error, "Не удалось отправить работу"),
          type: "error",
        })
    } finally {
      setPending(null)
    }
  }
  return (
    <div className={styles.page}>
      <Link to={`/projects/${projectId}`} className={styles.backLink}>
        <ChevronLeftIcon className={styles.backIcon} aria-hidden="true" />
        К плану
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
            {submission.decision_comment && (
              <div className={`${styles.feedbackBox} ${submission.status === "accepted" ? styles.feedbackAccepted : ""}`}>
                <div className={styles.feedbackTitle}>Комментарий наставника</div>
                <div className={styles.feedbackRow}>
                  {submission.status === "accepted" ? (
                    <CheckIcon className={styles.feedbackIcon} aria-hidden="true" />
                  ) : (
                    <AlertCircleIcon className={styles.feedbackIcon} aria-hidden="true" />
                  )}
                  {submission.decision_comment}
                </div>
              </div>
            )}
          </article>
        ))}
        {editable && <div className={styles.field}>
          <label htmlFor="project-task-answer" className={styles.fieldLabel}>
            {revising ? "Исправленный ответ" : "Результаты"}
          </label>
          <textarea
            id="project-task-answer"
            readOnly={busy}
            rows={6}
            className={styles.textarea}
            value={answer}
            onChange={(event) => {
              const next = event.target.value
              const savedAt = Date.now()
              setText(next)
              autosave.schedule(() => saveTaskDraft(currentTask.id, next, "keep", savedAt))
              setRemarks(null)
              setCheckError("")
            }}
          />
        </div>}
        <div className={styles.filesSection}>
          <div className={styles.filesHeader}>
            <strong className={styles.filesTitle}>Файл (PDF, JPG или PNG, до 10 МБ)</strong>
            {editable && (
              <button
                type="button"
                className={styles.attachBtn}
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileIcon aria-hidden="true" />
                {filename ? "Заменить файл" : "Прикрепить файл"}
              </button>
            )}
          </div>
          {filename ? (
            <div className={styles.filesList}>
              <div className={styles.fileItem}>
                <FileIcon className={styles.fileIcon} aria-hidden="true" />
                <div className={styles.fileMeta}>
                  <span className={styles.fileName}>{filename}</span>
                  {file && <span className={styles.fileSize}>{(file.size / 1024 / 1024).toFixed(1)} МБ</span>}
                </div>
                {editable && (
                  <button
                    type="button"
                    className={styles.removeFileBtn}
                    aria-label="Удалить файл"
                    disabled={busy}
                    onClick={() => void editFile(null)}
                  >
                    <CloseIcon className={styles.removeIcon} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.noFiles}>Файл не прикреплён</div>
          )}
          {editable && (
            <input
              ref={fileInputRef}
              className={styles.hiddenInput}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={busy}
              onChange={(event) => {
                const next = event.currentTarget.files?.[0]
                if (next) void editFile(next)
                event.currentTarget.value = ""
              }}
            />
          )}
        </div>
        {remarks && remarks.length > 0 && (
          <div className={styles.feedbackBox}>
            <div className={styles.feedbackTitle}>Замечания к черновику</div>
            <div className={styles.feedbackList}>
              {remarks.map((remark) => (
                <div key={remark} className={styles.feedbackRow}>
                  <AlertCircleIcon className={styles.feedbackIcon} aria-hidden="true" />
                  {remark}
                </div>
              ))}
            </div>
          </div>
        )}
        {remarks?.length === 0 && (
          <AiActivity status="completed" compact message="Проверка завершилась без замечаний" />
        )}
        {pending === "preview" && <AiActivity status="checking" compact message="ИИ проверяет черновик" />}
        {checkError && <AiActivity status="check_unavailable" compact message={checkError} />}
      </section>
      <div className={styles.actionsRow}>
        {allowed.has("preview_check") && (
          <button className={styles.outlineBtn} disabled={busy} onClick={() => void run("preview")}>
            {checkError ? "Повторить проверку" : "Проверить с ИИ"}
          </button>
        )}
        {allowed.has("submit") && (
          <button className={styles.primaryBtn} disabled={busy} onClick={() => void run("submit")}>
            {revising ? "Отправить повторно" : "Отправить наставнику"}
          </button>
        )}
      </div>
    </div>
  )
}

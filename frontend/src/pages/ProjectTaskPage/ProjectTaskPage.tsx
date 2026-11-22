import { useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import ChevronLeftIcon from "../../assets/icons/chevron-left.svg?react"
import FileTextIcon from "../../assets/icons/file-text.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import AlertCircleIcon from "../../assets/icons/alert-circle.svg?react"
import CheckIcon from "../../assets/icons/check.svg?react"
import { useApp } from "../../contexts/AppContext"
import type { ProjectFile } from "../../data/mockData"
import styles from "./ProjectTaskPage.module.css"

// Позволяет ученику заполнить результаты задачи, прикрепить файлы и проверить ответ с ИИ.
export default function ProjectTaskPage() {
  const { projectId, taskId } = useParams()
  const navigate = useNavigate()
  const { projects, updateTaskDraft, submitTaskToMentor } = useApp()

  const project = projects.find((item) => item.id === projectId) ?? projects[0]
  const task = project.tasks.find((item) => item.id === taskId) ?? project.tasks[1] ?? project.tasks[0]

  // Локальные поля ответа, списка файлов, ИИ-замечаний и уведомлений.
  const [answer, setAnswer] = useState(task.answer)
  const [files, setFiles] = useState<ProjectFile[]>(task.files)
  const [aiFeedback, setAiFeedback] = useState<string[]>(task.aiFeedback)
  const [aiPassed, setAiPassed] = useState(false)
  const [notice, setNotice] = useState("")
  // Скрытый input для прикрепления файлов с устройства.
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Добавляет выбранные пользователем файлы в список прикреплённых материалов.
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files
    if (!selected || selected.length === 0) return
    const added: ProjectFile[] = Array.from(selected).map((file) => ({
      id: `f-${Date.now()}-${file.name}`,
      name: file.name,
      size: `${Math.max(1, Math.round(file.size / 1024))} КБ`,
    }))
    setFiles((prev) => [...prev, ...added])
    event.target.value = ""
  }

  // Удаляет файл из списка прикреплённых материалов.
  function removeFile(fileId: string) {
    setFiles((prev) => prev.filter((item) => item.id !== fileId))
  }

  // Сохраняет черновик ответа и прикреплённые файлы.
  function handleSave() {
    updateTaskDraft(project.id, task.id, answer, files, aiFeedback)
    setNotice("Черновик ответа сохранён.")
  }

  // Запускает моковую предварительную проверку ИИ по критериям задачи.
  function handleAiRecheck() {
    const text = answer.trim()
    const nextHints: string[] = []
    if (text.length < 50 || /друз/i.test(text)) {
      nextHints.push("Уточните, относятся ли собеседники к целевой аудитории.")
    }
    if (!/(вывод|очеред|проблем|опыт|студент|прим)/i.test(text)) {
      nextHints.push("Добавьте ответы о прошлом опыте и выводы о проблеме.")
    }
    setAiFeedback(nextHints)
    setAiPassed(nextHints.length === 0)
    updateTaskDraft(project.id, task.id, answer, files, nextHints)
    setNotice("")
  }

  // Отправляет работу наставнику и возвращает к плану проекта.
  function handleSubmit() {
    submitTaskToMentor(project.id, task.id, answer, files)
    navigate(`/projects/${project.id}`)
  }

  return (
    <div className={styles.page}>
      <Link to={`/projects/${project.id}`} className={styles.backLink}>
        <ChevronLeftIcon className={styles.backIcon} aria-hidden="true" />
        <span>К плану</span>
      </Link>

      <div className={styles.headingCol}>
        <div className={styles.title} role="heading" aria-level={1}>
          {project.brief.name}
        </div>
        <div className={styles.taskTitle}>{task.title}</div>
        <div className={styles.instruction}>{task.instruction}</div>
      </div>

      {task.status === "rework" && task.mentorComment && (
        <div className={styles.reworkBanner}>
          <AlertCircleIcon className={styles.aiIcon} aria-hidden="true" />
          <div className={styles.reworkText}>
            <div className={styles.reworkTitle}>Комментарий наставника на доработку</div>
            <div>{task.mentorComment}</div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <label className={styles.field} htmlFor="task-results-input">
          <span className={styles.fieldLabel}>Результаты</span>
          <textarea
            id="task-results-input"
            rows={5}
            className={styles.textarea}
            value={answer}
            placeholder="Опишите, что сделали, какие наблюдения получили и какие выводы сделали для проекта..."
            onChange={(event) => {
              setAnswer(event.target.value)
              setNotice("")
            }}
          />
        </label>

        <div className={styles.filesSection}>
          <div className={styles.filesHeader}>
            <div className={styles.filesTitle}>Прикреплённые файлы</div>
            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
            >
              Прикрепить файл
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className={styles.hiddenInput}
              onChange={handleFileChange}
            />
          </div>

          {files.length === 0 ? (
            <div className={styles.noFiles}>Файлы не прикреплены</div>
          ) : (
            <div className={styles.filesList}>
              {files.map((file) => (
                <div key={file.id} className={styles.fileItem}>
                  <FileTextIcon className={styles.fileIcon} aria-hidden="true" />
                  <div className={styles.fileMeta}>
                    <div className={styles.fileName}>{file.name}</div>
                    <div className={styles.fileSize}>{file.size}</div>
                  </div>
                  <button
                    type="button"
                    className={styles.removeFileBtn}
                    aria-label={`Удалить файл ${file.name}`}
                    onClick={() => removeFile(file.id)}
                  >
                    <CloseIcon className={styles.removeIcon} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {aiFeedback.length > 0 && (
          <div className={styles.aiBox}>
            <div className={styles.aiTitle}>Предварительная проверка ИИ</div>
            <div className={styles.aiList}>
              {aiFeedback.map((item) => (
                <div key={item} className={styles.aiRow}>
                  <AlertCircleIcon className={styles.aiIcon} aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {aiPassed && (
          <div className={styles.successBox}>
            <CheckIcon className={styles.successIcon} aria-hidden="true" />
            <span>Предварительная проверка пройдена: замечаний нет. Можно отправлять наставнику.</span>
          </div>
        )}

        {notice && <div className={styles.noticeBox}>{notice}</div>}
      </div>

      <div className={styles.actionsRow}>
        <button type="button" className={styles.outlineBtn} onClick={handleSave}>
          Сохранить
        </button>
        <button type="button" className={styles.outlineBtn} onClick={handleAiRecheck}>
          Проверить снова
        </button>
        <button type="button" className={styles.primaryBtn} onClick={handleSubmit}>
          Отправить наставнику
        </button>
      </div>
    </div>
  )
}

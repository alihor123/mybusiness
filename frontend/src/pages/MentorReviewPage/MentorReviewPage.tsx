import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import ChevronLeftIcon from "../../assets/icons/chevron-left.svg?react"
import FileTextIcon from "../../assets/icons/file-text.svg?react"
import DownloadIcon from "../../assets/icons/download.svg?react"
import { useApp } from "../../contexts/AppContext"
import styles from "./MentorReviewPage.module.css"

// Позволяет наставнику проверить ответ ученика, скачать материалы и вынести решение.
export default function MentorReviewPage() {
  const { projectId, taskId } = useParams()
  const { projects, reviewStudentTask } = useApp()

  const project = projects.find((item) => item.id === projectId) ?? projects[0]
  const task = project.tasks.find((item) => item.id === taskId) ?? project.tasks[1] ?? project.tasks[0]

  // Комментарий наставника и уведомление о принятом решении.
  const [comment, setComment] = useState(
    task.mentorComment || "Добавьте конкретные примеры и уточните выводы.",
  )
  const [statusNotice, setStatusNotice] = useState("")

  // Определяет подпись бейджа статуса проверки в шапке.
  function getBadgeLabel() {
    if (task.status === "completed") return "Принято"
    if (task.status === "rework") return "На доработке"
    return "На проверке"
  }

  // Сохраняет решение наставника по текущей задаче.
  function handleDecision(decision: "completed" | "rework") {
    reviewStudentTask(project.id, task.id, decision, comment)
    setStatusNotice(
      decision === "completed"
        ? "Результат принят. Прогресс проекта обновлён."
        : "Работа возвращена ученику на доработку с вашим комментарием.",
    )
  }

  // Имитирует скачивание прикреплённого файла ученика.
  function handleDownload(fileName: string) {
    setStatusNotice(`Файл «${fileName}» подготовлен к скачиванию (мок).`)
  }

  const studentAnswer =
    task.answer.trim() ||
    "Провёл 5 интервью со студентами. Трое покупают кофе перед парами и жалуются на очередь."

  const attachedFiles =
    task.files.length > 0
      ? task.files
      : [{ id: "mock-pdf", name: "Интервью.pdf", size: "1,2 МБ" }]

  return (
    <div className={styles.page}>
      <Link to="/mentor/projects" className={styles.backLink}>
        <ChevronLeftIcon className={styles.backIcon} aria-hidden="true" />
        <span>К списку проектов</span>
      </Link>

      <div className={styles.headerRow}>
        <div className={styles.headingCol}>
          <div className={styles.title} role="heading" aria-level={1}>
            ПРОВЕРКА РАБОТ
          </div>
          <div className={styles.context}>
            {project.brief.name} / {task.title}
          </div>
        </div>

        <div
          className={`${styles.statusBadge} ${task.status === "completed" ? styles.statusBadgeSuccess : ""}`}
        >
          {getBadgeLabel()}
        </div>
      </div>

      <div className={styles.criteriaCard}>
        <div className={styles.cardHeadingSmall}>Задача</div>
        <div className={styles.criteriaText}>{task.criteriaText}</div>
      </div>

      <div className={styles.reviewGrid}>
        <div className={styles.panelCard}>
          <div className={styles.cardHeading}>Ответ ученика</div>

          <div className={styles.answerBox}>{studentAnswer}</div>

          <div className={styles.filesList}>
            {attachedFiles.map((file) => (
              <div key={file.id} className={styles.fileRow}>
                <FileTextIcon className={styles.fileIcon} aria-hidden="true" />
                <div className={styles.fileMeta}>
                  <div className={styles.fileName}>{file.name}</div>
                  <div className={styles.fileSize}>{file.size}</div>
                </div>
                <button
                  type="button"
                  className={styles.downloadBtn}
                  aria-label={`Скачать ${file.name}`}
                  onClick={() => handleDownload(file.name)}
                >
                  <DownloadIcon className={styles.downloadIcon} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.panelCard}>
          <label className={styles.commentLabel} htmlFor="mentor-comment-input">
            Комментарий наставника
          </label>
          <textarea
            id="mentor-comment-input"
            className={styles.commentTextarea}
            value={comment}
            placeholder="Напишите обратную связь по критериям задачи..."
            onChange={(event) => {
              setComment(event.target.value)
              setStatusNotice("")
            }}
          />

          <div className={styles.decisionRow}>
            <button
              type="button"
              className={styles.outlineBtn}
              onClick={() => handleDecision("rework")}
            >
              На доработку
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => handleDecision("completed")}
            >
              Принять результат
            </button>
          </div>
        </div>
      </div>

      {statusNotice && <div className={styles.noticeBox}>{statusNotice}</div>}
    </div>
  )
}

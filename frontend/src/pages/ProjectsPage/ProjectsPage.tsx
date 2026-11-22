import { useNavigate } from "react-router-dom"
import PlusIcon from "../../assets/icons/plus.svg?react"
import GraduationIcon from "../../assets/icons/graduation.svg?react"
import FileTextIcon from "../../assets/icons/file-text.svg?react"
import SendIcon from "../../assets/icons/send.svg?react"
import UserIcon from "../../assets/icons/user.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import { useApp } from "../../contexts/AppContext"
import { useIsMobile } from "../../hooks/useIsMobile"
import type { ProjectItem } from "../../data/mockData"
import styles from "./ProjectsPage.module.css"

// Показывает список проектов ученика с фиксированной шапкой и компактной мобильной версией.
export default function ProjectsPage() {
  const { projects, deleteProject } = useApp()
  const navigate = useNavigate()
  const isMobile = useIsMobile(768)

  // Определяет маршрут при клике по основной кнопке карточки проекта.
  function openProject(project: ProjectItem) {
    if (project.status === "draft") {
      navigate(`/projects/${project.id}/brief`)
      return
    }
    if (project.status === "pending_mentor") {
      navigate(`/projects/${project.id}/mentors`)
      return
    }
    navigate(`/projects/${project.id}`)
  }

  // Возвращает текст статуса и подпись для нижней строки карточки.
  function getStatusMeta(project: ProjectItem) {
    if (project.status === "draft") {
      return {
        badge: "Черновик",
        badgeTone: "soft" as const,
        detail: "Дополнить анкету",
        buttonLabel: "Дополнить анкету",
      }
    }
    if (project.status === "pending_mentor") {
      return {
        badge: "Ожидает наставника",
        badgeTone: "tint" as const,
        detail: "Заявка отправлена",
        buttonLabel: "Открыть",
      }
    }
    const doneCount = project.tasks.filter((task) => task.status === "completed").length
    return {
      badge: "Сопровождение",
      badgeTone: "tint" as const,
      detail: `${doneCount} из ${project.tasks.length} задач`,
      buttonLabel: "Открыть",
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.stickyTop}>
        <div className={styles.headerRow}>
          <div className={styles.title} role="heading" aria-level={1}>
            МОИ ПРОЕКТЫ
          </div>

          {!isMobile && (
            <button
              type="button"
              className={styles.newBtn}
              onClick={() => navigate("/projects/new")}
            >
              <PlusIcon className={styles.plusIcon} aria-hidden="true" />
              <span>Новый проект</span>
            </button>
          )}
        </div>

        <div className={styles.hintBanner}>
          <GraduationIcon className={styles.hintIcon} aria-hidden="true" />
          <span>Новые проекты можно создавать без повторного обучения</span>
        </div>
      </div>

      <div className={styles.scrollArea}>
        {projects.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>У вас пока нет проектов</div>
            <div className={styles.emptyDesc}>
              Нажмите «{isMobile ? "+" : "Новый проект"}», чтобы заполнить анкету и подобрать наставника.
            </div>
          </div>
        ) : (
          <div className={styles.grid}>
            {projects.map((project) => {
              const meta = getStatusMeta(project)
              return (
                <div key={project.id} className={styles.card}>
                  <div className={styles.cardTopRow}>
                    <div className={styles.cardTitle}>{project.brief.name}</div>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      aria-label={`Удалить проект ${project.brief.name}`}
                      title="Удалить проект"
                      onClick={() => deleteProject(project.id)}
                    >
                      <CloseIcon className={styles.deleteIcon} aria-hidden="true" />
                    </button>
                  </div>

                  <div
                    className={`${styles.statusPill} ${meta.badgeTone === "tint" ? styles.statusTint : styles.statusSoft}`}
                  >
                    {meta.badge}
                  </div>

                  <div className={styles.cardDesc}>{project.shortDescription}</div>

                  <div className={styles.spacer} />
                  <div className={styles.divider} />

                  <div className={styles.detailRow}>
                    {project.status === "draft" && <FileTextIcon className={styles.detailIcon} aria-hidden="true" />}
                    {project.status === "pending_mentor" && <SendIcon className={styles.detailIcon} aria-hidden="true" />}
                    {project.status === "accompaniment" && <UserIcon className={styles.detailIcon} aria-hidden="true" />}
                    <span>{meta.detail}</span>
                  </div>

                  <button
                    type="button"
                    className={styles.cardBtn}
                    onClick={() => openProject(project)}
                  >
                    {meta.buttonLabel}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {isMobile && (
        <button
          type="button"
          className={styles.fabBtn}
          aria-label="Новый проект"
          onClick={() => navigate("/projects/new")}
        >
          <PlusIcon className={styles.fabIcon} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

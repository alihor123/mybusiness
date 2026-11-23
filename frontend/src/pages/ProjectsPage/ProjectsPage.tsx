import { useNavigate } from "react-router-dom"
import PlusIcon from "../../assets/icons/plus.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import { useToast } from "../../contexts/ToastContext"
import { useIsMobile } from "../../hooks/useIsMobile"
import useResource from "../../hooks/useResource"
import { LoadingSkeleton, ResourceError, EmptyState } from "../../components/AsyncState/AsyncState"
import { createProject, deleteProject, listProjects } from "../../api/projects"
import { fetchLearningProgress } from "../../api/learning"
import type { ProjectOut } from "../../api/projects"
import styles from "./ProjectsPage.module.css"

// Показывает проекты ученика и использует серверный прогресс для допуска к созданию.
export default function ProjectsPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile(768)
  const { showToast } = useToast()
  const projects = useResource("projects", listProjects)
  const progress = useResource("learning-progress", fetchLearningProgress)
  const canCreate = progress.data?.can_create_project ?? false

  async function startProject() {
    try {
      const project = await createProject()
      navigate(`/projects/${project.id}/brief`)
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось создать проект",
        type: "error",
      })
      progress.reload()
    }
  }

  async function removeProject(project: ProjectOut) {
    if (project.status !== "draft") return
    try {
      await deleteProject(project.id)
      projects.setData((items) => items?.filter((item) => item.id !== project.id) ?? [])
      showToast({ message: "Черновик удалён", type: "success" })
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось удалить проект",
        type: "error",
      })
    }
  }

  function openProject(project: ProjectOut) {
    navigate(
      project.status === "draft"
        ? `/projects/${project.id}/brief`
        : project.status === "waiting_mentor"
          ? `/projects/${project.id}/mentors`
          : `/projects/${project.id}`,
    )
  }

  function statusLabel(project: ProjectOut) {
    if (project.status === "draft") return "Черновик"
    if (project.status === "waiting_mentor") return "Ожидает наставника"
    if (project.status === "archived") return "В архиве"
    return "Сопровождение"
  }

  return (
    <div className={styles.page}>
      <div className={styles.stickyTop}>
        <div className={styles.headerRow}>
          <div className={styles.title} role="heading" aria-level={1}>
            МОИ ПРОЕКТЫ
          </div>
          {canCreate && (
            <button type="button" className={styles.newBtn} onClick={startProject}>
              <PlusIcon className={styles.plusIcon} aria-hidden="true" />
              <span>Новый проект</span>
            </button>
          )}
        </div>
        <div className={styles.hintBanner}>Завершите обязательные шаги обучения, чтобы создать проект.</div>
      </div>
      <div className={styles.scrollArea}>
        {projects.loading && <LoadingSkeleton variant="cards" />}
        {projects.error && <ResourceError message={projects.error} retry={projects.reload} />}
        {!projects.loading && !projects.error && projects.data?.length === 0 && (
          <EmptyState message="У вас пока нет проектов.">
            {canCreate && (
              <button type="button" className={styles.newBtn} onClick={startProject}>
                {isMobile ? "+ Создать проект" : "Новый проект"}
              </button>
            )}
          </EmptyState>
        )}
        {!projects.loading && !projects.error && (projects.data?.length ?? 0) > 0 && (
          <div className={styles.grid}>
            {projects.data?.map((project) => (
              <div key={project.id} className={styles.card}>
                <div className={styles.cardTopRow}>
                  <div className={styles.cardTitle}>{project.title || "Новый проект"}</div>
                  {project.status === "draft" && (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      aria-label="Удалить черновик"
                      onClick={() => void removeProject(project)}
                    >
                      <CloseIcon className={styles.deleteIcon} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className={styles.statusPill}>{statusLabel(project)}</div>
                <div className={styles.cardDesc}>
                  {project.problem || "Заполните анкету проекта, чтобы подобрать наставника."}
                </div>
                <div className={styles.spacer} />
                <div className={styles.divider} />
                <div className={styles.detailRow}>
                  {project.status === "draft"
                    ? "Дополнить анкету"
                    : project.status === "waiting_mentor"
                      ? "Заявки наставникам"
                      : "Открыть план проекта"}
                </div>
                <button type="button" className={styles.cardBtn} onClick={() => openProject(project)}>
                  {project.status === "draft" ? "Дополнить анкету" : "Открыть"}
                </button>
              </div>
            ))}
          </div>
        )}
        {progress.error && (
          <div role="status">
            Не удалось проверить доступ к созданию.{" "}
            <button type="button" onClick={progress.reload}>
              Повторить
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

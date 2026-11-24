import { useId, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button, Dialog, Modal, ModalOverlay } from "react-aria-components"
import PlusIcon from "../../assets/icons/plus.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import { useToast } from "../../contexts/ToastContext"
import useResource from "../../hooks/useResource"
import { LoadingSkeleton, ResourceError, EmptyState } from "../../components/AsyncState/AsyncState"
import { createProject, deleteProject, listProjects } from "../../api/projects"
import { ApiError } from "../../api/client"
import { fetchLearningProgress } from "../../api/learning"
import type { ProjectOut } from "../../api/projects"
import styles from "./ProjectsPage.module.css"
import { useApp } from "../../contexts/AppContext"

// Показывает проекты ученика и использует серверный прогресс для допуска к созданию.
export default function ProjectsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { session } = useApp()
  const projects = useResource("projects", listProjects)
  const audience = session.status === "ready" ? session.profile.audience : "student"
  const progress = useResource(`learning-progress-${audience}`, (signal) => fetchLearningProgress(signal, audience))
  const canCreate = progress.data?.can_create_project ?? false
  // Хранит скрытые карточки, в том числе на случай позднего ответа со старым списком.
  const [projectToDelete, setProjectToDelete] = useState<ProjectOut | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set())
  const dialogTitleId = useId()
  const dialogDescriptionId = useId()
  const visibleProjects = projects.data?.filter((project) => !hiddenIds.has(project.id))

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

  async function confirmRemoveProject() {
    if (!projectToDelete || projectToDelete.status !== "draft" || hiddenIds.has(projectToDelete.id)) return
    const id = projectToDelete.id
    setHiddenIds((current) => new Set(current).add(id))
    setProjectToDelete(null)
    try {
      await deleteProject(id)
      projects.setData((items) => items?.filter((item) => item.id !== id) ?? [])
      showToast({ message: "Черновик удалён", type: "neutral" })
    } catch (error) {
      setHiddenIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
      if (error instanceof ApiError && [0, 502, 504].includes(error.status)) projects.reload()
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
            <button type="button" className={styles.newBtn} aria-label="Новый проект" onClick={startProject}>
              <PlusIcon className={styles.plusIcon} aria-hidden="true" />
              <span className={styles.newBtnLabel}>Новый проект</span>
            </button>
          )}
        </div>
        {progress.data && !canCreate && (
          <div className={styles.hintBanner}>Завершите обязательные шаги обучения, чтобы создать проект.</div>
        )}
      </div>
      <div className={styles.scrollArea}>
        {projects.loading && !projects.data && <LoadingSkeleton variant="cards" />}
        {projects.error && <ResourceError message={projects.error} retry={projects.reload} />}
        {visibleProjects?.length === 0 && (
          <EmptyState message="У вас пока нет проектов." />
        )}
        {visibleProjects && visibleProjects.length > 0 && (
          <div className={styles.grid}>
            {visibleProjects.map((project) => (
              <div key={project.id} className={styles.card}>
                <div className={styles.cardTopRow}>
                  <div className={styles.cardTitle}>{project.title || "Новый проект"}</div>
                  {project.status === "draft" && (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      aria-label="Удалить черновик"
                      onClick={() => setProjectToDelete(project)}
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
      <ModalOverlay
        className={styles.modalOverlay}
        isOpen={projectToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setProjectToDelete(null)
        }}
        isDismissable
      >
        <Modal className={styles.modal}>
          <Dialog
            className={styles.dialog}
            role="alertdialog"
            aria-labelledby={dialogTitleId}
            aria-describedby={dialogDescriptionId}
          >
            <div id={dialogTitleId} className={styles.modalTitle} role="heading" aria-level={2}>
              Удалить черновик?
            </div>
            <p id={dialogDescriptionId} className={styles.modalText}>
              Черновик «{projectToDelete?.title || "Новый проект"}» будет удалён.
              Это действие нельзя отменить.
            </p>
            <div className={styles.modalActions}>
              <Button
                className={styles.cancelBtn}
                autoFocus
                onPress={() => setProjectToDelete(null)}
              >
                Отмена
              </Button>
              <Button
                className={styles.confirmBtn}
                onPress={() => void confirmRemoveProject()}
              >
                Удалить
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  )
}

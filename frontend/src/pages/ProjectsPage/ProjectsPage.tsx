import { useId, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button, Dialog, Modal, ModalOverlay } from "react-aria-components"
import PlusIcon from "../../assets/icons/plus.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import { useToast } from "../../contexts/ToastContext"
import useResource from "../../hooks/useResource"
import { LoadingSkeleton, ResourceError, EmptyState } from "../../components/AsyncState/AsyncState"
import { createProject, deleteProject, listProjects } from "../../api/projects"
import { fetchLearningProgress } from "../../api/learning"
import type { ProjectOut } from "../../api/projects"
import styles from "./ProjectsPage.module.css"

// Показывает проекты ученика и использует серверный прогресс для допуска к созданию.
export default function ProjectsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const projects = useResource("projects", listProjects)
  const progress = useResource("learning-progress", fetchLearningProgress)
  const canCreate = progress.data?.can_create_project ?? false
  // Хранит выбранный черновик до подтверждения и блокирует повторное удаление.
  const [projectToDelete, setProjectToDelete] = useState<ProjectOut | null>(null)
  const [deleting, setDeleting] = useState(false)
  const dialogTitleId = useId()
  const dialogDescriptionId = useId()

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
    if (!projectToDelete || deleting || projectToDelete.status !== "draft") return
    setDeleting(true)
    try {
      await deleteProject(projectToDelete.id)
      projects.setData((items) => items?.filter((item) => item.id !== projectToDelete.id) ?? [])
      setProjectToDelete(null)
      showToast({ message: "Черновик удалён", type: "neutral" })
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось удалить проект",
        type: "error",
      })
    } finally {
      setDeleting(false)
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
        {projects.loading && <LoadingSkeleton variant="cards" />}
        {projects.error && <ResourceError message={projects.error} retry={projects.reload} />}
        {!projects.loading && !projects.error && projects.data?.length === 0 && (
          <EmptyState message="У вас пока нет проектов." />
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
          if (!open && !deleting) setProjectToDelete(null)
        }}
        isDismissable={!deleting}
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
                isDisabled={deleting}
                onPress={() => setProjectToDelete(null)}
              >
                Отмена
              </Button>
              <Button
                className={styles.confirmBtn}
                isDisabled={deleting}
                onPress={() => void confirmRemoveProject()}
              >
                {deleting ? "Удаление…" : "Удалить"}
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  )
}

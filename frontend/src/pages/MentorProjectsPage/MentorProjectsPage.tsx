import { useNavigate } from "react-router-dom"
import UserIcon from "../../assets/icons/user.svg?react"
import ArrowRightIcon from "../../assets/icons/arrow-right.svg?react"
import { useApp } from "../../contexts/AppContext"
import styles from "./MentorProjectsPage.module.css"

// Показывает проекты на сопровождении у наставника и переводит к проверке работ.
export default function MentorProjectsPage() {
  const { projects } = useApp()
  const navigate = useNavigate()

  const activeProjects = projects.filter((item) => item.status === "accompaniment")
  const visibleProjects = activeProjects.length > 0 ? activeProjects : projects.slice(0, 2)

  return (
    <div className={styles.page}>
      <div className={styles.headingCol}>
        <div className={styles.title} role="heading" aria-level={1}>
          МОИ ПРОЕКТЫ
        </div>
        <div className={styles.subtitle}>
          Выберите проект и задачу ученика, чтобы проверить результат и оставить комментарий.
        </div>
      </div>

      <div className={styles.grid}>
        {visibleProjects.map((project) => {
          const doneCount = project.tasks.filter((task) => task.status === "completed").length
          const reviewTask =
            project.tasks.find((task) => task.status === "review") ??
            project.tasks.find((task) => task.status === "current") ??
            project.tasks[0]

          return (
            <div key={project.id} className={styles.card}>
              <div className={styles.cardTitle}>{project.brief.name}</div>
              <div className={styles.statusPill}>
                {reviewTask.status === "review" ? "Есть работа на проверке" : "Сопровождение"}
              </div>
              <div className={styles.cardDesc}>{project.shortDescription}</div>

              <div className={styles.metaRow}>
                <UserIcon className={styles.metaIcon} aria-hidden="true" />
                <span>Прогресс: {doneCount} из {project.tasks.length} задач</span>
              </div>

              <button
                type="button"
                className={styles.reviewBtn}
                onClick={() => navigate(`/mentor/projects/${project.id}/tasks/${reviewTask.id}`)}
              >
                <span>Проверить: {reviewTask.title}</span>
                <ArrowRightIcon className={styles.arrowIcon} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

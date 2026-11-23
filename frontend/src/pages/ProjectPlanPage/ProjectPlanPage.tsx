import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import ChevronLeftIcon from "../../assets/icons/chevron-left.svg?react"
import SidePanel from "../../components/SidePanel/SidePanel"
import MentorDetailsContent from "../../components/MentorDetailsContent/MentorDetailsContent"
import { LoadingSkeleton, ResourceError, EmptyState } from "../../components/AsyncState/AsyncState"
import useResource from "../../hooks/useResource"
import {
  getProject,
  getMentor,
  getProjectPlan,
  getProjectMeeting,
  type ProjectTask,
} from "../../api/projects"
import styles from "./ProjectPlanPage.module.css"

type PlanTab = "plan" | "meetings" | "about"

// Показывает серверный план задач, данные проекта и назначенную встречу.
export default function ProjectPlanPage() {
  const { projectId = "" } = useParams()
  const navigate = useNavigate()
  const project = useResource(projectId, (signal) => getProject(projectId, signal))
  const plan = useResource(projectId, (signal) => getProjectPlan(projectId, signal))
  const meeting = useResource(projectId, (signal) => getProjectMeeting(projectId, signal))
  const mentor = useResource(project.data?.mentor_id ?? null, (signal) =>
    getMentor(project.data!.mentor_id!, signal),
  )
  const [activeTab, setActiveTab] = useState<PlanTab>("plan")
  const [mentorPanelOpen, setMentorPanelOpen] = useState(false)
  const tasks = plan.data?.tasks ?? []
  const completed = tasks.filter((task) => task.status === "accepted").length
  const progressPercent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0

  function taskStatus(task: ProjectTask) {
    if (task.status === "accepted") return "Завершено"
    if (task.status === "submitted") return "На проверке"
    if (task.status === "revision_requested") return "На доработке"
    return "К выполнению"
  }

  if (project.loading && !project.data) return (
    <div className={styles.page}>
      <Link to="/projects" className={styles.backLink}>
        <ChevronLeftIcon className={styles.backIcon} aria-hidden="true" />
        <span>К списку проектов</span>
      </Link>
      <div className={styles.title} role="heading" aria-level={1}>Проект</div>
      <LoadingSkeleton variant="lesson" />
    </div>
  )
  if (project.error && !project.data) return <ResourceError message={project.error} retry={project.reload} />
  if (!project.data) return <EmptyState message="Проект не найден." />

  const projectData = project.data
  const dateText = meeting.data?.starts_at
    ? new Date(meeting.data.starts_at).toLocaleString("ru-RU")
    : "Не назначена"
  return (
    <div className={styles.page}>
      <Link to="/projects" className={styles.backLink}>
        <ChevronLeftIcon className={styles.backIcon} aria-hidden="true" />
        <span>К списку проектов</span>
      </Link>
      <div className={styles.title} role="heading" aria-level={1}>
        {project.data.title || "Проект"}
      </div>
      <div className={styles.tabsRow} role="tablist" aria-label="Разделы проекта">
        {(["plan", "meetings", "about"] as PlanTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "plan" ? "План" : tab === "meetings" ? "Встречи" : "О проекте"}
          </button>
        ))}
      </div>
      <div className={styles.layout}>
        <div className={styles.mainCol}>
          {activeTab === "plan" && (
            <div className={styles.planCard}>
              <div className={styles.progressHeader}>
                <div className={styles.progressTitle}>
                  Прогресс: {completed} из {tasks.length} задач
                </div>
                <div className={styles.progressBarRow}>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div className={styles.progressPercent}>{progressPercent}%</div>
                </div>
              </div>
              {plan.loading && !plan.data && <LoadingSkeleton variant="list" />}
              {plan.error && <ResourceError message={plan.error} retry={plan.reload} />}
              {!plan.loading && !plan.error && tasks.length === 0 && (
                <EmptyState message="План задач пока недоступен." />
              )}
              <div className={styles.tasksList}>
                {tasks.map((task) => (
                  <div key={task.id} className={styles.taskRow}>
                    <div
                      className={`${styles.taskNumber} ${plan.data?.next_task_id === task.id ? styles.taskNumberCurrent : ""}`}
                    >
                      {task.position}
                    </div>
                    <button
                      type="button"
                      className={`${styles.taskCard} ${plan.data?.next_task_id === task.id ? styles.taskCardCurrent : ""} ${task.status === "accepted" ? styles.taskCardCompleted : ""}`}
                      onClick={() => navigate(`/projects/${projectData.id}/tasks/${task.id}`)}
                    >
                      <div className={styles.taskCardBody}>
                        <div className={styles.taskTitle}>{task.title}</div>
                        <div className={styles.taskDesc}>{task.condition}</div>
                      </div>
                      <div className={styles.taskFooter}>
                        <span className={styles.taskStatus}>{taskStatus(task)}</span>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === "meetings" && (
            <div className={styles.planCard}>
              <div className={styles.subSectionTitle}>Встреча с наставником</div>
              {meeting.loading && !meeting.data && <LoadingSkeleton variant="list" />}
              {meeting.error && <ResourceError message={meeting.error} retry={meeting.reload} />}
              {!meeting.loading && !meeting.error && !meeting.data && (
                <EmptyState message="Наставник пока не назначил встречу." />
              )}
              {meeting.data && (
                <div className={styles.meetingItem}>
                  <div className={styles.meetingInfo}>
                    <div className={styles.meetingDate}>{dateText}</div>
                    <div className={styles.meetingTopic}>{meeting.data.title}</div>
                  </div>
                  <a
                    href={meeting.data.url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.meetingLinkBtn}
                  >
                    Перейти
                  </a>
                </div>
              )}
            </div>
          )}
          {activeTab === "about" && (
            <div className={styles.planCard}>
              <div className={styles.aboutHeaderRow}>
                <div className={styles.subSectionTitle}>Анкета проекта</div>
                <button
                  type="button"
                  className={styles.editBriefBtn}
                  onClick={() => navigate(`/projects/${projectData.id}/brief`)}
                >
                  Редактировать
                </button>
              </div>
              <div className={styles.briefGrid}>
                {[
                  ["Отрасль", projectData.industry],
                  ["Стадия", projectData.stage],
                  ["Целевая аудитория", projectData.audience],
                  ["Проблема", projectData.problem],
                  ["Польза решения", projectData.solution_benefit],
                  ["Запрос наставнику", projectData.mentor_request],
                ].map(([label, value]) => (
                  <div key={label} className={styles.briefItemFull}>
                    <div className={styles.briefLabel}>{label}</div>
                    <div className={styles.briefValue}>{value || "Не указано"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className={styles.sideCol}>
          {project.data.mentor_id && (
            <div className={styles.mentorCard}>
              <div className={styles.mentorCardHeading}>Ваш наставник</div>
              {mentor.loading && !mentor.data && <LoadingSkeleton variant="list" />}
              {mentor.error && <ResourceError message={mentor.error} retry={mentor.reload} />}
              {mentor.data && (
                <>
                  <div className={styles.mentorPhotoWrap}>
                    <img src={mentor.data.portrait_url} alt="" className={styles.mentorPhoto} />
                  </div>
                  <div className={styles.mentorName}>{mentor.data.name}</div>
                  <div className={styles.mentorRole}>{mentor.data.headline}</div>
                  <button
                    type="button"
                    className={styles.mentorOutlineBtn}
                    onClick={() => setMentorPanelOpen(true)}
                  >
                    Открыть профиль
                  </button>
                </>
              )}
            </div>
          )}
          <div className={styles.nextMeetingCard}>
            <div className={styles.nextMeetingLabel}>Следующая встреча</div>
            <div className={styles.nextMeetingDate}>{dateText}</div>
            <div className={styles.nextMeetingFormat}>
              {meeting.data?.title ?? "Согласуйте время с наставником"}
            </div>
          </div>
        </div>
      </div>
      {mentor.data && (
        <SidePanel
          open={mentorPanelOpen}
          title={mentor.data.name}
          subtitle={mentor.data.headline}
          onClose={() => setMentorPanelOpen(false)}
        >
          <MentorDetailsContent mentor={mentor.data} />
        </SidePanel>
      )}
    </div>
  )
}

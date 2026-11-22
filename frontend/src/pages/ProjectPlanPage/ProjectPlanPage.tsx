import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import ChevronLeftIcon from "../../assets/icons/chevron-left.svg?react"
import ArrowRightIcon from "../../assets/icons/arrow-right.svg?react"
import MaxChatIcon from "../../assets/icons/max-chat.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import { useApp } from "../../contexts/AppContext"
import type { ProjectTask } from "../../data/mockData"
import styles from "./ProjectPlanPage.module.css"

type PlanTab = "plan" | "meetings" | "about"

// Отображает план сопровождения проекта, вкладки встреч и анкеты, а также карточку наставника.
export default function ProjectPlanPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { projects, mentors } = useApp()

  const project = projects.find((item) => item.id === projectId) ?? projects[0]
  const mentor = mentors.find((item) => item.id === project.mentorId) ?? mentors[0]

  // Управляет активной вкладкой экрана и модальным окном профиля наставника.
  const [activeTab, setActiveTab] = useState<PlanTab>("plan")
  const [mentorModalOpen, setMentorModalOpen] = useState(false)

  const completedCount = project.tasks.filter((task) => task.status === "completed").length
  const totalCount = project.tasks.length
  const progressPercent = Math.round((completedCount / totalCount) * 100)
  const nextMeeting = project.meetings[0]

  // Возвращает текстовую подпись статуса задачи для правой части карточки.
  function getTaskStatusLabel(task: ProjectTask) {
    if (task.status === "completed") return "Завершено"
    if (task.status === "review") return "На проверке"
    if (task.status === "rework") return "На доработке"
    return ""
  }

  return (
    <div className={styles.page}>
      <Link to="/projects" className={styles.backLink}>
        <ChevronLeftIcon className={styles.backIcon} aria-hidden="true" />
        <span>К списку проектов</span>
      </Link>

      <div className={styles.title} role="heading" aria-level={1}>
        {project.brief.name}
      </div>

      <div className={styles.tabsRow} role="tablist" aria-label="Разделы проекта">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "plan"}
          className={`${styles.tabBtn} ${activeTab === "plan" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("plan")}
        >
          План
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "meetings"}
          className={`${styles.tabBtn} ${activeTab === "meetings" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("meetings")}
        >
          Встречи
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "about"}
          className={`${styles.tabBtn} ${activeTab === "about" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("about")}
        >
          О проекте
        </button>
      </div>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          {activeTab === "plan" && (
            <div className={styles.planCard}>
              <div className={styles.progressHeader}>
                <div className={styles.progressTitle}>
                  Прогресс: {completedCount} из {totalCount} задач
                </div>
                <div className={styles.progressBarRow}>
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className={styles.progressPercent}>{progressPercent}%</div>
                </div>
              </div>

              <div className={styles.tasksList}>
                {project.tasks.map((task) => {
                  const isCurrent = task.status === "current" || task.status === "rework"
                  const isCompleted = task.status === "completed"
                  const statusLabel = getTaskStatusLabel(task)

                  return (
                    <div key={task.id} className={styles.taskRow}>
                      <div
                        className={`${styles.taskNumber} ${isCurrent ? styles.taskNumberCurrent : ""}`}
                      >
                        {task.number}
                      </div>

                      <button
                        type="button"
                        className={[
                          styles.taskCard,
                          isCurrent ? styles.taskCardCurrent : "",
                          isCompleted ? styles.taskCardCompleted : "",
                        ].join(" ")}
                        onClick={() => navigate(`/projects/${project.id}/tasks/${task.id}`)}
                      >
                        <div className={styles.taskCardBody}>
                          <div className={styles.taskTitle}>{task.title}</div>
                          <div className={styles.taskDesc}>{task.shortDescription}</div>
                        </div>

                        <div className={styles.taskFooter}>
                          {statusLabel && (
                            <span className={styles.taskStatus}>{statusLabel}</span>
                          )}
                          <ArrowRightIcon
                            className={`${styles.taskArrow} ${isCurrent || isCompleted ? styles.taskArrowAccent : ""}`}
                            aria-hidden="true"
                          />
                        </div>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === "meetings" && (
            <div className={styles.planCard}>
              <div className={styles.subSectionTitle}>Запланированные встречи</div>
              {project.meetings.length === 0 ? (
                <div className={styles.emptyBlock}>
                  Наставник пока не назначил встречу. Напишите ему в MAX, чтобы согласовать удобное время.
                </div>
              ) : (
                <div className={styles.meetingsList}>
                  {project.meetings.map((meeting) => (
                    <div key={meeting.id} className={styles.meetingItem}>
                      <div className={styles.meetingInfo}>
                        <div className={styles.meetingDate}>{meeting.dateLabel}</div>
                        <div className={styles.meetingTopic}>{meeting.topic}</div>
                        <div className={styles.meetingFormat}>{meeting.format}</div>
                      </div>
                      <a
                        href={meeting.link}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.meetingLinkBtn}
                      >
                        Перейти
                      </a>
                    </div>
                  ))}
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
                  onClick={() => navigate(`/projects/${project.id}/brief`)}
                >
                  Редактировать
                </button>
              </div>

              <div className={styles.briefGrid}>
                <div className={styles.briefItem}>
                  <div className={styles.briefLabel}>Отрасль</div>
                  <div className={styles.briefValue}>{project.brief.industry}</div>
                </div>
                <div className={styles.briefItem}>
                  <div className={styles.briefLabel}>Стадия</div>
                  <div className={styles.briefValue}>{project.brief.stage}</div>
                </div>
                <div className={styles.briefItem}>
                  <div className={styles.briefLabel}>Целевая аудитория</div>
                  <div className={styles.briefValue}>{project.brief.audience}</div>
                </div>
                <div className={styles.briefItem}>
                  <div className={styles.briefLabel}>Время в неделю</div>
                  <div className={styles.briefValue}>{project.brief.weeklyHours}</div>
                </div>
                <div className={styles.briefItemFull}>
                  <div className={styles.briefLabel}>Проблема</div>
                  <div className={styles.briefValue}>{project.brief.problem}</div>
                </div>
                <div className={styles.briefItemFull}>
                  <div className={styles.briefLabel}>Польза решения</div>
                  <div className={styles.briefValue}>{project.brief.value}</div>
                </div>
                <div className={styles.briefItemFull}>
                  <div className={styles.briefLabel}>Что уже сделано</div>
                  <div className={styles.briefValue}>{project.brief.doneSoFar}</div>
                </div>
                <div className={styles.briefItemFull}>
                  <div className={styles.briefLabel}>Запрос наставнику</div>
                  <div className={styles.briefValue}>{project.brief.mentorRequest}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.sideCol}>
          <div className={styles.mentorCard}>
            <div className={styles.mentorCardHeading}>Ваш наставник</div>
            <img src={mentor.photo} alt={mentor.name} className={styles.mentorPhoto} />
            <div className={styles.mentorName}>{mentor.name}</div>
            <div className={styles.mentorRole}>{mentor.fullRole}</div>

            <div className={styles.mentorBtns}>
              <button
                type="button"
                className={styles.mentorOutlineBtn}
                onClick={() => setMentorModalOpen(true)}
              >
                Открыть профиль
              </button>
              <a
                href={mentor.contactUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.mentorPrimaryBtn}
              >
                <span>Написать в MAX</span>
                <MaxChatIcon className={styles.maxIcon} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className={styles.nextMeetingCard}>
            <div className={styles.nextMeetingLabel}>Следующая встреча</div>
            <div className={styles.nextMeetingDate}>
              {nextMeeting ? nextMeeting.dateLabel : "Не назначена"}
            </div>
            <div className={styles.nextMeetingFormat}>
              {nextMeeting ? nextMeeting.format : "Согласуйте время с наставником"}
            </div>
          </div>
        </div>
      </div>

      {mentorModalOpen && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label={`Профиль наставника ${mentor.name}`}
          onClick={() => setMentorModalOpen(false)}
        >
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              aria-label="Закрыть окно"
              onClick={() => setMentorModalOpen(false)}
            >
              <CloseIcon className={styles.modalCloseIcon} aria-hidden="true" />
            </button>

            <div className={styles.modalHeader}>
              <img src={mentor.photo} alt={mentor.name} className={styles.modalPhoto} />
              <div className={styles.modalMeta}>
                <div className={styles.modalName}>{mentor.name}</div>
                <div className={styles.modalRole}>{mentor.fullRole}</div>
                <div className={styles.modalSub}>{mentor.experience} · {mentor.format}</div>
              </div>
            </div>

            <div className={styles.modalAboutTitle}>О себе</div>
            <div className={styles.modalAboutText}>{mentor.about}</div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import ChevronLeftIcon from "../../assets/icons/chevron-left.svg?react"
import GraduationIcon from "../../assets/icons/graduation.svg?react"
import BriefcaseIcon from "../../assets/icons/briefcase.svg?react"
import PlayIcon from "../../assets/icons/play.svg?react"
import LockIcon from "../../assets/icons/lock.svg?react"
import CheckIcon from "../../assets/icons/check.svg?react"
import SidePanel from "../../components/SidePanel/SidePanel"
import MentorDetailsContent from "../../components/MentorDetailsContent/MentorDetailsContent"
import { useApp } from "../../contexts/AppContext"
import { useIsMobile } from "../../hooks/useIsMobile"
import styles from "./MentorMatchingPage.module.css"

// Показывает рекомендованных ИИ наставников: split-view на десктопе и сетку + шторку на мобилке.
export default function MentorMatchingPage() {
  const { projectId } = useParams()
  const { projects, mentors, applyToMentor, cancelMentorApplication } = useApp()
  const isMobile = useIsMobile(768)

  const project = projects.find((item) => item.id === projectId) ?? projects[0]
  const recommendedMentors = mentors.filter((item) => item.recommended)

  // Хранит выбранного наставника и состояние мобильной шторки подробностей.
  const [selectedMentorId, setSelectedMentorId] = useState(
    project.mentorId ?? recommendedMentors[0]?.id ?? mentors[0].id,
  )
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

  const selectedMentor =
    recommendedMentors.find((item) => item.id === selectedMentorId) ?? recommendedMentors[0]

  const isAppliedToSelected =
    project.status === "pending_mentor" && project.mentorId === selectedMentor.id

  // Выбирает наставника и на мобильном экране сразу открывает шторку с профилем.
  function selectMentor(mentorId: string) {
    setSelectedMentorId(mentorId)
    if (isMobile) {
      setMobileSheetOpen(true)
    }
  }

  // Отправляет заявку выбранному наставнику.
  function handleApply() {
    applyToMentor(project.id, selectedMentor.id)
  }

  // Рендерит кнопку отправки или отмены заявки для панели наставника.
  function renderApplyActions() {
    if (isAppliedToSelected) {
      return (
        <div className={styles.appliedBox}>
          <div className={styles.appliedStatus}>
            <CheckIcon className={styles.appliedIcon} aria-hidden="true" />
            <span>Заявка отправлена наставнику</span>
          </div>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => cancelMentorApplication(project.id)}
          >
            Отменить заявку
          </button>
        </div>
      )
    }
    return (
      <button type="button" className={styles.applyBtn} onClick={handleApply}>
        Отправить заявку
      </button>
    )
  }

  return (
    <div className={styles.page}>
      <Link to={`/projects/${project.id}/brief`} className={styles.backLink}>
        <ChevronLeftIcon className={styles.backIcon} aria-hidden="true" />
        <span>К проекту</span>
      </Link>

      <div className={styles.projectBanner}>
        <GraduationIcon className={styles.projectIcon} aria-hidden="true" />
        <div className={styles.projectBannerText}>
          <div className={styles.projectBannerLabel}>Проект</div>
          <div className={styles.projectBannerName}>{project.brief.name}</div>
        </div>
      </div>

      <div className={styles.headingCol}>
        <div className={styles.title} role="heading" aria-level={1}>
          ВЫБЕРИТЕ НАСТАВНИКА
        </div>
        <div className={styles.subtitle}>
          Мы подобрали наставников, которые подходят под ваш проект и цели.
        </div>
      </div>

      <div className={styles.sectionLabel}>Рекомендации ИИ по анкете проекта</div>

      <div className={styles.layout}>
        <div className={styles.mentorsGrid}>
          {recommendedMentors.map((mentor) => {
            const isSelected = mentor.id === selectedMentor.id
            return (
              <button
                key={mentor.id}
                type="button"
                className={`${styles.mentorCard} ${isSelected ? styles.mentorCardSelected : ""}`}
                onClick={() => selectMentor(mentor.id)}
              >
                <div className={styles.cardPhotoWrap}>
                  <img src={mentor.photo} alt="" loading="lazy" className={styles.cardPhoto} />
                </div>
                <div className={styles.cardName}>{mentor.name}</div>
                <div className={styles.cardRole}>{mentor.role}</div>
                <div className={styles.cardExp}>{mentor.experience}</div>
              </button>
            )
          })}
        </div>

        {!isMobile && (
          <div className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <div className={styles.detailPhotoWrap}>
                <img src={selectedMentor.photo} alt="" className={styles.detailPhoto} />
              </div>
              <div className={styles.detailMeta}>
                <div className={styles.detailName}>{selectedMentor.name}</div>
                <div className={styles.detailRole}>{selectedMentor.fullRole}</div>

                <div className={styles.metaRow}>
                  <BriefcaseIcon className={styles.metaIcon} aria-hidden="true" />
                  <span>{selectedMentor.experience}</span>
                </div>

                <div className={styles.metaRow}>
                  <PlayIcon className={styles.metaIcon} aria-hidden="true" />
                  <span>{selectedMentor.format}</span>
                </div>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.aboutSection}>
              <div className={styles.aboutTitle}>О себе</div>
              <div className={styles.aboutText}>{selectedMentor.about}</div>
            </div>

            <div className={styles.detailActions}>{renderApplyActions()}</div>
          </div>
        )}
      </div>

      <div className={styles.lockBanner}>
        <LockIcon className={styles.lockIcon} aria-hidden="true" />
        <span>Сопровождение откроется после принятия заявки наставником.</span>
      </div>

      {isMobile && (
        <SidePanel
          open={mobileSheetOpen}
          title={selectedMentor.name}
          subtitle={selectedMentor.industry}
          onClose={() => setMobileSheetOpen(false)}
          footer={renderApplyActions()}
        >
          <MentorDetailsContent mentor={selectedMentor} />
        </SidePanel>
      )}
    </div>
  )
}

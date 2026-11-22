import BriefcaseIcon from "../../assets/icons/briefcase.svg?react"
import PlayIcon from "../../assets/icons/play.svg?react"
import type { Mentor } from "../../data/mockData"
import styles from "./MentorDetailsContent.module.css"

type MentorDetailsContentProps = {
  mentor: Mentor
  hint?: string
}

// Единый блок подробностей наставника для панелей и шторок на всех экранах.
export default function MentorDetailsContent({ mentor, hint }: MentorDetailsContentProps) {
  return (
    <div className={styles.content}>
      <div className={styles.photoWrap}>
        <img src={mentor.photo} alt="" className={styles.photo} />
      </div>

      <div className={styles.meta}>
        <div className={styles.role}>{mentor.fullRole}</div>
        <div className={styles.infoRow}>
          <BriefcaseIcon className={styles.infoIcon} aria-hidden="true" />
          <span>{mentor.experience}</span>
        </div>
        <div className={styles.infoRow}>
          <PlayIcon className={styles.infoIcon} aria-hidden="true" />
          <span>{mentor.format}</span>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.aboutBlock}>
        <div className={styles.aboutTitle}>О себе</div>
        <div className={styles.aboutText}>{mentor.about}</div>
      </div>

      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  )
}

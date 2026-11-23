import BriefcaseIcon from "../../assets/icons/briefcase.svg?react"
import PlayIcon from "../../assets/icons/play.svg?react"
import type { MentorOut } from "../../api/projects"
import { formatLabels, industryLabels } from "./mentorLabels"
import styles from "./MentorDetailsContent.module.css"

type MentorDetailsContentProps = { mentor: MentorOut, hint?: string }

// Показывает подробности наставника из серверного каталога.
export default function MentorDetailsContent({ mentor, hint }: MentorDetailsContentProps) {
  return (
    <div className={styles.content}>
      <div className={styles.photoWrap}>
        <img src={mentor.portrait_url} alt="" className={styles.photo} />
      </div>
      <div className={styles.meta}>
        <div className={styles.role}>{mentor.headline}</div>
        <div className={styles.infoRow}>
          <BriefcaseIcon className={styles.infoIcon} aria-hidden="true" />
          <span>{mentor.experience_label}</span>
        </div>
        <div className={styles.infoRow}>
          <PlayIcon className={styles.infoIcon} aria-hidden="true" />
          <span>{formatLabels[mentor.meeting_format] ?? "Уточнить формат"}</span>
        </div>
      </div>
      <div className={styles.divider} />
      {mentor.industry_codes.length > 0 && (
        <div className={styles.aboutBlock}>
          <div className={styles.aboutTitle}>Отрасли</div>
          <div className={styles.aboutText}>
            {mentor.industry_codes.map((code) => industryLabels[code] ?? "Другая отрасль").join(", ")}
          </div>
        </div>
      )}
      <div className={styles.aboutBlock}>
        <div className={styles.aboutTitle}>О себе</div>
        <div className={styles.aboutText}>{mentor.about}</div>
      </div>
      {mentor.help_topics.length > 0 && (
        <div className={styles.aboutBlock}>
          <div className={styles.aboutTitle}>Помощь с темами</div>
          <div className={styles.aboutText}>{mentor.help_topics.join(", ")}</div>
        </div>
      )}
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  )
}

import { Fragment, useId, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import type { LearningBlock } from "../../api/learning"
import UsersIcon from "../../assets/icons/users.svg?react"
import FileTextIcon from "../../assets/icons/file-text.svg?react"
import AlertCircleIcon from "../../assets/icons/alert-circle.svg?react"
import ArrowRightIcon from "../../assets/icons/arrow-right.svg?react"
import CheckIcon from "../../assets/icons/check.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import ChevronDownIcon from "../../assets/icons/chevron-down.svg?react"
import LessonVideo from "./LessonVideo"
import styles from "./TrackLessonPage.module.css"

const diagramIcons: Record<string, typeof UsersIcon> = {
  client: UsersIcon,
  situation: FileTextIcon,
  problem: AlertCircleIcon,
}

// Выводит содержимое урока с карточками схем из исходного макета.
export default function LessonMaterial({
  block,
  onVideoError,
}: {
  block: LearningBlock
  onVideoError: () => void
}) {
  if (block.type === "text") {
    if (block.is_video_summary) return <VideoSummary title={block.title} text={block.text} />
    return (
      <div className={styles.textBlock}>
        {block.title && (
          <div className={styles.sectionTitle} role="heading" aria-level={3}>
            {block.title}
          </div>
        )}
        <div className={styles.bodyText}>{block.text}</div>
      </div>
    )
  }
  if (block.type === "image")
    return (
      <figure className={styles.lessonImageWrap}>
        <img src={block.url} alt={block.alt} className={styles.lessonImage} loading="lazy" decoding="async" />
        {block.caption && <figcaption className={styles.imageCaption}>{block.caption}</figcaption>}
      </figure>
    )
  if (block.type === "video")
    return (
      block.url && (
        <LessonVideo url={block.url} poster={block.poster_url} onError={onVideoError} />
      )
    )
  if (block.type === "attachment")
    return (
      <a href={block.url} className={styles.backLink}>
        {block.title}
      </a>
    )
  if (block.type === "examples")
    return (
      <div className={styles.compareRow}>
        {block.items.map((item) => {
          const strong = item.variant === "strong"
          const Icon = strong ? CheckIcon : CloseIcon

          return (
            <div key={item.title} className={strong ? styles.compareGood : styles.compareBad}>
              <Icon
                className={strong ? styles.compareIconAccent : styles.compareIconInk}
                aria-hidden="true"
              />
              <div className={styles.compareTextCol}>
                <div className={strong ? styles.compareLabelAccent : styles.compareLabelInk}>
                  {item.title}
                </div>
                <div className={strong ? styles.compareDescAccent : styles.compareDescInk}>{item.text}</div>
              </div>
            </div>
          )
        })}
      </div>
    )
  return (
    <div className={styles.flowRow}>
      {block.items.map((item, index) => {
        const Icon = diagramIcons[item.icon] ?? FileTextIcon
        const accent = index % 2 === 0

        return (
          <Fragment key={item.title}>
            {index > 0 && <ArrowRightIcon className={styles.flowArrow} aria-hidden="true" />}
            <div className={`${styles.flowCard} ${accent ? styles.flowCardTint : styles.flowCardSoft}`}>
              <Icon className={accent ? styles.flowIconAccent : styles.flowIconInk} aria-hidden="true" />
              <div className={styles.flowTextCol}>
                <div className={accent ? styles.flowTitleAccent : styles.flowTitleInk}>{item.title}</div>
                <div className={accent ? styles.flowSubAccent : styles.flowSubInk}>{item.text}</div>
              </div>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

// Показывает конспект под видео по нажатию на заголовок.
function VideoSummary({ title, text }: { title?: string | null, text: string }) {
  // Конспект свёрнут при входе в урок.
  const [open, setOpen] = useState(false)
  const reducedMotion = useReducedMotion()
  const panelId = useId()

  return (
    <section className={styles.transcriptBox}>
      <button
        type="button"
        className={styles.transcriptHeader}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <FileTextIcon className={styles.transcriptIcon} aria-hidden="true" />
        <span className={styles.transcriptTitle}>{title || "Конспект"}</span>
        <ChevronDownIcon
          className={`${styles.transcriptChevron} ${open ? styles.transcriptChevronOpen : ""}`}
          aria-hidden="true"
        />
      </button>
      <motion.div
        id={panelId}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.22 }}
        style={{ overflow: "hidden" }}
        aria-hidden={!open}
      >
        <div className={styles.transcriptBody}>
          {text.split(/\n\s*\n/u).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </motion.div>
    </section>
  )
}

import { Fragment } from "react"
import type { LearningBlock } from "../../api/learning"
import UsersIcon from "../../assets/icons/users.svg?react"
import FileTextIcon from "../../assets/icons/file-text.svg?react"
import AlertCircleIcon from "../../assets/icons/alert-circle.svg?react"
import ArrowRightIcon from "../../assets/icons/arrow-right.svg?react"
import CheckIcon from "../../assets/icons/check.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
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
  onVideoEnded,
  onVideoError,
  onVideoOpenedExternally,
  onVideoHalfway,
}: {
  block: LearningBlock
  onVideoEnded: () => void
  onVideoError: () => void
  onVideoOpenedExternally: () => void
  onVideoHalfway: () => void
}) {
  if (block.type === "text")
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
        <LessonVideo
          url={block.url}
          poster={block.poster_url}
          onEnded={onVideoEnded}
          onError={onVideoError}
          onOpenedExternally={onVideoOpenedExternally}
          onHalfway={onVideoHalfway}
        />
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

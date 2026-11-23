import { useEffect, useRef } from "react"
import type { ReactNode, Ref } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import CloseIcon from "../../assets/icons/close.svg?react"
import SidePanel from "../SidePanel/SidePanel"
import MentorDetailsContent from "../MentorDetailsContent/MentorDetailsContent"
import { useIsMobile } from "../../hooks/useIsMobile"
import type { MentorOut } from "../../api/projects"
import styles from "./MentorDirectory.module.css"

type MentorDirectoryProps = {
  mentors: MentorOut[]
  selected: MentorOut | null
  onSelect: (mentor: MentorOut | null) => void
  scrollRef?: Ref<HTMLDivElement>
  listBefore?: ReactNode
  listAfter?: ReactNode
  panelHint?: string
  panelFooter?: ReactNode
  renderCardExtra?: (mentor: MentorOut) => ReactNode
}

export function MentorDirectorySkeleton() {
  return (
    <div className={styles.grid} role="status" aria-label="Загружаем наставников">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className={styles.card} aria-hidden="true">
          <div className={styles.photoWrap} />
          <div className={`${styles.placeholder} ${styles.namePlaceholder}`} />
          <div className={`${styles.placeholder} ${styles.rolePlaceholder}`} />
          <div className={`${styles.placeholder} ${styles.buttonPlaceholder}`} />
        </div>
      ))}
    </div>
  )
}

export default function MentorDirectory({
  mentors,
  selected,
  onSelect,
  scrollRef,
  listBefore,
  listAfter,
  panelHint,
  panelFooter,
  renderCardExtra,
}: MentorDirectoryProps) {
  const isMobile = useIsMobile(768)
  const compactPanel = useIsMobile(1150)
  const reducedMotion = useReducedMotion()
  const closePanel = useRef<HTMLButtonElement>(null)
  const openedBy = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!selected || isMobile) return
    closePanel.current?.focus({ preventScroll: true })
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismissPanel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selected, isMobile])

  function dismissPanel() {
    onSelect(null)
    openedBy.current?.focus({ preventScroll: true })
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.scrollArea} ref={scrollRef}>
        {listBefore}
        <div className={styles.grid}>
          {mentors.map((mentor) => {
            const isSelected = selected?.id === mentor.id
            return (
              <div key={mentor.id} className={`${styles.card} ${isSelected && !isMobile ? styles.cardSelected : ""}`}>
                <div className={styles.photoWrap}>
                  <img src={mentor.portrait_url} alt="" loading="lazy" className={styles.photo} />
                </div>
                <div className={styles.cardName}>{mentor.name}</div>
                <div className={styles.cardRole}>{mentor.headline}</div>
                <div className={styles.cardExp}>Опыт: {mentor.experience_label}</div>
                {renderCardExtra?.(mentor)}
                <div className={styles.cardFooter}>
                  <button
                    type="button"
                    className={styles.moreBtn}
                    aria-expanded={isSelected}
                    onClick={(event) => {
                      if (isSelected) dismissPanel()
                      else {
                        openedBy.current = event.currentTarget
                        onSelect(mentor)
                      }
                    }}
                  >
                    {isSelected && !isMobile ? "Скрыть" : "Подробнее"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        {listAfter}
      </div>
      <AnimatePresence initial={false}>
        {!isMobile && selected && (
          <motion.div
            className={styles.pushPanelWrap}
            initial={{ width: 0, opacity: 0, marginLeft: 0 }}
            animate={{ width: compactPanel ? 304 : 390, opacity: 1, marginLeft: 18 }}
            exit={{ width: 0, opacity: 0, marginLeft: 0 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 34 }}
          >
            <div className={styles.pushPanel} role="region" aria-label={`Наставник: ${selected.name}`}>
              <div className={styles.pushHeader}>
                <div className={styles.pushHeaderText}>
                  <div className={styles.pushTitle}>{selected.name}</div>
                  <div className={styles.pushSubtitle}>{selected.headline}</div>
                </div>
                <button ref={closePanel} type="button" className={styles.pushCloseBtn} aria-label="Закрыть панель" onClick={dismissPanel}>
                  <CloseIcon className={styles.pushCloseIcon} aria-hidden="true" />
                </button>
              </div>
              <div className={styles.pushBody}>
                <MentorDetailsContent mentor={selected} hint={panelHint} />
              </div>
              {panelFooter && <div className={styles.pushFooter}>{panelFooter}</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isMobile && (
        <SidePanel open={Boolean(selected)} title={selected?.name} subtitle={selected?.headline} onClose={dismissPanel} dragHandleOnly footer={panelFooter}>
          {selected && <MentorDetailsContent mentor={selected} hint={panelHint} />}
        </SidePanel>
      )}
    </div>
  )
}

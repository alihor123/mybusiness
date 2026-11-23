import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type { PanInfo } from "motion/react"
import CloseIcon from "../../assets/icons/close.svg?react"
import { useIsMobile } from "../../hooks/useIsMobile"
import styles from "./SidePanel.module.css"

type SidePanelProps = {
  open: boolean
  title?: string
  subtitle?: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}

// Анимированная панель на motion: выезжает справа на десктопе и шторкой снизу на мобилке (со свайпом).
export default function SidePanel({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children,
}: SidePanelProps) {
  const isMobile = useIsMobile(768)
  const reducedMotion = useReducedMotion()
  // Хранит панель и актуальный обработчик без повторного переноса фокуса.
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return

    const previousFocus = document.activeElement
    const prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus())

    // Закрывает панель с клавиатуры и удерживает Tab внутри диалога.
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        closeRef.current()
      }
      if (event.key !== "Tab" || !dialogRef.current) return
      const dialog = dialogRef.current
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      )).filter((element) => element.getClientRects().length > 0)
      const first = focusable[0]
      const last = focusable.at(-1)
      const current = document.activeElement
      if (event.shiftKey && (current === first || current === dialog || !dialog.contains(current))) {
        event.preventDefault()
        const target = last ?? dialog
        target.focus()
      } else if (!event.shiftKey && (current === last || !dialog.contains(current))) {
        event.preventDefault()
        const target = first ?? dialog
        target.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = prevBodyOverflow
      window.removeEventListener("keydown", handleKeyDown)
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [open])

  // Закрывает нижнюю шторку, если пользователь смахнул её вниз.
  function handleDragEnd(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.y > 90 || info.velocity.y > 450) {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dialogRef}
          tabIndex={-1}
          className={`${styles.backdrop} ${isMobile ? styles.backdropMobile : styles.backdropDesktop}`}
          role="dialog"
          aria-modal="true"
          aria-label={title ?? "Подробная информация"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          onClick={onClose}
        >
          {isMobile ? (
            <motion.div
              className={`${styles.panel} ${styles.sheetMobile}`}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 36 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.35 }}
              onDragEnd={handleDragEnd}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.sheetHandle} aria-hidden="true" />
              <div className={styles.header}>
                <div className={styles.headerText}>
                  {title && <div className={styles.title}>{title}</div>}
                  {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
                </div>
                <button
                  type="button"
                  className={styles.closeBtn}
                  aria-label="Закрыть панель"
                  onClick={onClose}
                >
                  <CloseIcon className={styles.closeIcon} aria-hidden="true" />
                </button>
              </div>
              <div className={styles.body}>{children}</div>
              {footer && <div className={styles.footer}>{footer}</div>}
            </motion.div>
          ) : (
            <motion.div
              className={`${styles.panel} ${styles.drawerDesktop}`}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 36 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.header}>
                <div className={styles.headerText}>
                  {title && <div className={styles.title}>{title}</div>}
                  {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
                </div>
                <button
                  type="button"
                  className={styles.closeBtn}
                  aria-label="Закрыть панель"
                  onClick={onClose}
                >
                  <CloseIcon className={styles.closeIcon} aria-hidden="true" />
                </button>
              </div>
              <div className={styles.body}>{children}</div>
              {footer && <div className={styles.footer}>{footer}</div>}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

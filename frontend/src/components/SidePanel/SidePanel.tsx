import { useEffect } from "react"
import type { ReactNode } from "react"
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

// Показывает выезжающую панель справа на десктопе и шторку снизу на мобилке с блокировкой фона.
export default function SidePanel({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children,
}: SidePanelProps) {
  const isMobile = useIsMobile(768)

  useEffect(() => {
    if (!open) return

    const prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = prevBodyOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={`${styles.backdrop} ${isMobile ? styles.backdropMobile : styles.backdropDesktop}`}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Подробная информация"}
      onClick={onClose}
    >
      <div
        className={`${styles.panel} ${isMobile ? styles.sheetMobile : styles.drawerDesktop}`}
        onClick={(event) => event.stopPropagation()}
      >
        {isMobile && <div className={styles.sheetHandle} aria-hidden="true" />}

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
      </div>
    </div>
  )
}

import type { ReactNode } from "react"
import SpinnerIcon from "../../assets/icons/spinner.svg?react"
import styles from "./AsyncState.module.css"
import spinnerStyles from "./Spinner.module.css"

type SkeletonVariant = "cards" | "form" | "lesson" | "list"

// Сохраняет размеры основных блоков экрана до получения данных.
export function LoadingSkeleton({ variant = "cards", count }: { variant?: SkeletonVariant, count?: number }) {
  const rows = count ?? (variant === "cards" ? 3 : variant === "list" ? 4 : 1)
  return (
    <div className={`${styles.skeleton} ${styles[variant]}`} role="status" aria-label="Загрузка" aria-busy="true">
      <div className={styles.skeletonGrid} aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className={styles.block}>
            <div className={styles.image} />
            <div className={styles.line} />
            <div className={styles.shortLine} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Показывает загрузку, когда форма будущих данных ещё неизвестна.
export function Loader({ label = "Загрузка" }: { label?: string }) {
  return (
    <div className={styles.loader} role="status" aria-label={label}>
      <SpinnerIcon className={spinnerStyles.spinner} aria-hidden="true" />
    </div>
  )
}

// Показывает ошибку первой загрузки и повтор запроса.
export function ResourceError({ message, retry }: { message: string, retry: () => void }) {
  return (
    <div className={styles.state}>
      <div role="alert">{message}</div>
      <button type="button" className={styles.retry} onClick={retry}>Повторить</button>
    </div>
  )
}

// Показывает, что сервер уже подтвердил отсутствие данных.
export function EmptyState({ message, children }: { message: string, children?: ReactNode }) {
  return <div className={styles.state}><div>{message}</div>{children}</div>
}

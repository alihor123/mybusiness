import SpinnerIcon from "../../assets/icons/spinner.svg?react"
import styles from "./AiActivity.module.css"
import spinnerStyles from "./Spinner.module.css"

type AiActivityProps = {
  status: "checking" | "check_unavailable" | "completed"
  message?: string
  onRetry?: () => void
  retrying?: boolean
  compact?: boolean
}

// Показывает состояние AI-запроса рядом с действием или его результатом.
export default function AiActivity({
  status,
  message,
  onRetry,
  retrying = false,
  compact = false,
}: AiActivityProps) {
  const label =
    message ??
    {
      checking: "ИИ проверяет результат",
      check_unavailable: "Проверка временно недоступна",
      completed: "Проверка завершена",
    }[status]

  return (
    <div
      className={`${styles.activity} ${compact ? styles.compact : ""} ${status === "check_unavailable" ? styles.error : ""}`}
      role={status === "check_unavailable" ? "alert" : "status"}
      aria-live={status === "check_unavailable" ? "assertive" : "polite"}
    >
      {status === "checking" && (
        <SpinnerIcon className={`${spinnerStyles.spinner} ${styles.spinner}`} aria-hidden="true" />
      )}
      <span>{label}</span>
      {status === "check_unavailable" && onRetry && (
        <button type="button" onClick={onRetry} disabled={retrying}>
          {retrying ? "Запускаем…" : "Повторить"}
        </button>
      )}
    </div>
  )
}

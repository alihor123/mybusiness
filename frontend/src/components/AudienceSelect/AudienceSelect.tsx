import styles from "./AudienceSelect.module.css"

export type Audience = "student" | "self_employed" | "startup"

export const audienceOptions: Array<{ value: Audience, label: string }> = [
  { value: "student", label: "Предприниматель-студент" },
  { value: "self_employed", label: "Самозанятый" },
  { value: "startup", label: "Стартапер" },
]

export function audienceLabel(value: Audience) {
  return audienceOptions.find((item) => item.value === value)?.label ?? audienceOptions[0].label
}

export default function AudienceSelect({
  value,
  onChange,
  disabled = false,
  id = "audience",
  label = "Ваша аудитория",
}: {
  value: Audience
  onChange: (value: Audience) => void
  disabled?: boolean
  id?: string
  label?: string
}) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.label}>{label}</span>
      <select
        className={styles.select}
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as Audience)}
      >
        {audienceOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

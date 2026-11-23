import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components"
import ChevronDownIcon from "../../assets/icons/chevron-down.svg?react"
import CheckIcon from "../../assets/icons/check.svg?react"
import styles from "./CustomSelect.module.css"

export type SelectOption = {
  id: string
  label: string
}

type CustomSelectProps = {
  label?: string
  ariaLabel?: string
  placeholder?: string
  value: string
  options: SelectOption[]
  variant?: "field" | "pill"
  disabled?: boolean
  onChange: (value: string) => void
}

// Кастомный доступный выпадающий список на React Aria Components вместо нативного select.
export default function CustomSelect({
  label,
  ariaLabel,
  placeholder = "Выберите значение",
  value,
  options,
  variant = "field",
  disabled = false,
  onChange,
}: CustomSelectProps) {
  return (
    <Select
      className={styles.root}
      aria-label={label ? undefined : (ariaLabel ?? placeholder)}
      placeholder={placeholder}
      selectedKey={value || null}
      isDisabled={disabled}
      onSelectionChange={(key) => {
        if (key !== null) {
          onChange(String(key))
        }
      }}
    >
      {label && <Label className={styles.label}>{label}</Label>}

      <Button
        className={`${styles.trigger} ${variant === "pill" ? styles.triggerPill : styles.triggerField}`}
      >
        <SelectValue className={styles.valueText} />
        <ChevronDownIcon className={styles.chevron} aria-hidden="true" />
      </Button>

      <Popover className={variant === "pill" ? `${styles.popover} ${styles.pillPopover}` : styles.popover} offset={6}>
        <ListBox className={styles.listBox}>
          {options.map((option) => (
            <ListBoxItem key={option.id} id={option.id} textValue={option.label} className={styles.item}>
              {({ isSelected }) => (
                <>
                  <span className={styles.itemLabel}>{option.label}</span>
                  {isSelected && <CheckIcon className={styles.checkIcon} aria-hidden="true" />}
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  )
}

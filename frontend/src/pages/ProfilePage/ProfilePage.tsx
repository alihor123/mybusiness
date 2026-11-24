import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import LogoutIcon from "../../assets/icons/logout.svg?react"
import type { EditableProfileFields, Profile } from "../../api/auth"
import { errorMessage } from "../../api/client"
import { useApp } from "../../contexts/AppContext"
import { useToast } from "../../contexts/ToastContext"
import styles from "./ProfilePage.module.css"
import AudienceSelect from "../../components/AudienceSelect/AudienceSelect"

const fields = [
  { name: "first_name", title: "Имя", type: "text", autoComplete: "given-name", maxLength: 100 },
  { name: "last_name", title: "Фамилия", type: "text", autoComplete: "family-name", maxLength: 100 },
  {
    name: "occupation",
    title: "Учёба или работа",
    type: "text",
    autoComplete: "organization",
    maxLength: 200,
  },
] as const

// Связывает форму с профилем текущего аккаунта.
export default function ProfilePage() {
  const { session } = useApp()
  return session.profile && <ProfileForm key={session.profile.id} profile={session.profile} />
}

// Сохраняет личные данные на сервере и завершает сессию по кнопке выхода.
function ProfileForm({ profile }: { profile: Profile }) {
  const { updateProfile, signOut } = useApp()
  const { showToast } = useToast()
  const navigate = useNavigate()

  // Черновик профиля живёт на странице, а действия взаимно блокируют друг друга.
  const [form, setForm] = useState<EditableProfileFields>(profile)
  const [pending, setPending] = useState<"save" | "logout" | null>(null)

  // Отправляет только редактируемые поля и принимает нормализованные сервером данные.
  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending("save")
    const dismiss = showToast({ message: "Сохраняем профиль", persistent: true })
    try {
      const next = await updateProfile({
        first_name: form.first_name,
        last_name: form.last_name,
        occupation: form.occupation,
        audience: form.audience,
      })
      setForm(next)
      showToast({ message: "Профиль сохранён", type: "success" })
    } catch (error) {
      showToast({ message: errorMessage(error, "Не удалось сохранить профиль"), type: "error" })
    } finally {
      dismiss()
      setPending(null)
    }
  }

  // После серверного выхода вкладка возвращается на форму входа.
  async function handleLogout() {
    if (pending) return
    setPending("logout")
    const dismiss = showToast({ message: "Завершаем сеанс", persistent: true })
    try {
      await signOut()
      navigate("/login", { replace: true })
    } catch (error) {
      showToast({ message: errorMessage(error, "Не удалось выйти"), type: "error" })
    } finally {
      dismiss()
      setPending(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.title} role="heading" aria-level={1}>
          МОЙ ПРОФИЛЬ
        </div>
        <button type="button" className={styles.logoutBtn} onClick={handleLogout} disabled={pending !== null}>
          <LogoutIcon className={styles.logoutIcon} aria-hidden="true" />
          <span>{pending === "logout" ? "Выходим…" : "Выйти"}</span>
        </button>
      </div>

      <form className={styles.card} onSubmit={handleSave} aria-busy={pending === "save"}>
        <div className={styles.cardTitle}>Личные данные</div>
        <div className={styles.cardDesc}>{profile.role === "teacher" ? "Наставник" : "Ученик"}</div>

        <label className={styles.field} htmlFor="profile-email">
          <span className={styles.label}>Почта</span>
          <input
            id="profile-email"
            type="email"
            className={styles.input}
            autoComplete="email"
            value={profile.email}
            disabled
          />
        </label>

        {fields.map((field) => (
          <label key={field.name} className={styles.field} htmlFor={`profile-${field.name}`}>
            <span className={styles.label}>{field.title}</span>
            <input
              id={`profile-${field.name}`}
              type={field.type}
              className={styles.input}
              autoComplete={field.autoComplete}
              maxLength={field.maxLength}
              value={form[field.name] ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
              disabled={pending !== null}
            />
          </label>
        ))}

        {profile.role === "student" && (
          <AudienceSelect
            id="profile-audience"
            value={form.audience}
            disabled={pending !== null}
            onChange={(audience) => setForm((current) => ({ ...current, audience }))}
          />
        )}

        <div className={styles.actionsRow}>
          <button type="submit" className={styles.primaryBtn} disabled={pending !== null}>
            {pending === "save" ? "Сохраняем…" : "Сохранить изменения"}
          </button>
        </div>
      </form>
    </div>
  )
}

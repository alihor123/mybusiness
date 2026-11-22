import { useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import CloseIcon from "../../assets/icons/close.svg?react"
import LogoutIcon from "../../assets/icons/logout.svg?react"
import { useApp } from "../../contexts/AppContext"
import styles from "./ProfilePage.module.css"

// Отображает и сохраняет личные данные пользователя, а также смену пароля и выход.
export default function ProfilePage() {
  const { profile, updateProfile, logoutMock } = useApp()
  const navigate = useNavigate()

  // Локальное состояние полей профиля и модального окна смены пароля.
  const [form, setForm] = useState(profile)
  const [savedNotice, setSavedNotice] = useState("")
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [passwordNotice, setPasswordNotice] = useState("")

  // Сохраняет изменения личных данных в моковом состоянии.
  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateProfile(form)
    setSavedNotice("Изменения профиля сохранены.")
  }

  // Имитирует смену пароля и закрывает модальное окно.
  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPassword.trim().length < 6) {
      setPasswordNotice("Новый пароль должен содержать минимум 6 символов.")
      return
    }
    setCurrentPassword("")
    setNewPassword("")
    setPasswordNotice("")
    setPasswordModalOpen(false)
    setSavedNotice("Пароль успешно обновлён.")
  }

  // Завершает сессию и переводит пользователя на экран входа.
  function handleLogout() {
    logoutMock()
    navigate("/login")
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.title} role="heading" aria-level={1}>
          МОЙ ПРОФИЛЬ
        </div>

        <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
          <LogoutIcon className={styles.logoutIcon} aria-hidden="true" />
          <span>Выйти</span>
        </button>
      </div>

      <form className={styles.card} onSubmit={handleSave}>
        <div className={styles.cardTitle}>Личные данные</div>
        <div className={styles.cardDesc}>
          Эти данные используются в профиле и для связи в рамках проектов.
        </div>

        <label className={styles.field} htmlFor="profile-first-name">
          <span className={styles.label}>Имя</span>
          <input
            id="profile-first-name"
            type="text"
            className={styles.input}
            value={form.firstName}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, firstName: event.target.value }))
              setSavedNotice("")
            }}
          />
        </label>

        <label className={styles.field} htmlFor="profile-last-name">
          <span className={styles.label}>Фамилия</span>
          <input
            id="profile-last-name"
            type="text"
            className={styles.input}
            value={form.lastName}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, lastName: event.target.value }))
              setSavedNotice("")
            }}
          />
        </label>

        <label className={styles.field} htmlFor="profile-email">
          <span className={styles.label}>Почта</span>
          <input
            id="profile-email"
            type="email"
            className={styles.input}
            value={form.email}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, email: event.target.value }))
              setSavedNotice("")
            }}
          />
        </label>

        <label className={styles.field} htmlFor="profile-org">
          <span className={styles.label}>Учёба или работа</span>
          <input
            id="profile-org"
            type="text"
            className={styles.input}
            value={form.organization}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, organization: event.target.value }))
              setSavedNotice("")
            }}
          />
        </label>

        {savedNotice && <div className={styles.savedBox}>{savedNotice}</div>}

        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.outlineBtn}
            onClick={() => setPasswordModalOpen(true)}
          >
            Изменить пароль
          </button>

          <button type="submit" className={styles.primaryBtn}>
            Сохранить изменения
          </button>
        </div>
      </form>

      {passwordModalOpen && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Смена пароля"
          onClick={() => setPasswordModalOpen(false)}
        >
          <form
            className={styles.modalCard}
            onSubmit={handlePasswordSubmit}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Изменить пароль</div>
              <button
                type="button"
                className={styles.modalClose}
                aria-label="Закрыть окно"
                onClick={() => setPasswordModalOpen(false)}
              >
                <CloseIcon className={styles.closeIcon} aria-hidden="true" />
              </button>
            </div>

            <label className={styles.field} htmlFor="pass-current">
              <span className={styles.label}>Текущий пароль</span>
              <input
                id="pass-current"
                type="password"
                className={styles.input}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>

            <label className={styles.field} htmlFor="pass-new">
              <span className={styles.label}>Новый пароль</span>
              <input
                id="pass-new"
                type="password"
                className={styles.input}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>

            {passwordNotice && <div className={styles.errorBox}>{passwordNotice}</div>}

            <button type="submit" className={styles.primaryBtn}>
              Обновить пароль
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

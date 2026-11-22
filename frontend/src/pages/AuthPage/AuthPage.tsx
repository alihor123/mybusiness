import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import logoUrl from "../../assets/brand/logo.svg"
import UserIcon from "../../assets/icons/user.svg?react"
import MailIcon from "../../assets/icons/mail.svg?react"
import LockIcon from "../../assets/icons/lock.svg?react"
import EyeIcon from "../../assets/icons/eye.svg?react"
import EyeOffIcon from "../../assets/icons/eye-off.svg?react"
import { useApp } from "../../contexts/AppContext"
import styles from "./AuthPage.module.css"

type AuthMode = "register" | "login"

// Отображает страницы регистрации и входа в фирменном стиле «Мой бизнес Югра».
export default function AuthPage({ mode }: { mode: AuthMode }) {
  const { loginMock, registerMock } = useApp()
  const navigate = useNavigate()

  // Поля формы и переключение видимости пароля.
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errorText, setErrorText] = useState("")

  const isRegister = mode === "register"

  // Проверяет заполнение полей и выполняет моковый вход или регистрацию.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorText("")

    if (!email.trim() || !password.trim()) {
      setErrorText("Заполните электронную почту и пароль.")
      return
    }

    if (isRegister) {
      if (!firstName.trim() || !lastName.trim()) {
        setErrorText("Укажите имя и фамилию.")
        return
      }
      if (password !== confirmPassword) {
        setErrorText("Пароли не совпадают.")
        return
      }
      registerMock({ firstName, lastName, email })
      navigate("/learning/test")
      return
    }

    loginMock(email)
    navigate("/learning")
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.brandHeader}>
          <img src={logoUrl} alt="Мой бизнес Югра" className={styles.logo} />
        </div>

        <div className={styles.headingBlock}>
          <div className={styles.title} role="heading" aria-level={1}>
            {isRegister ? "РЕГИСТРАЦИЯ" : "ВХОД В ПЛАТФОРМУ"}
          </div>
          <div className={styles.subtitle}>
            {isRegister
              ? "Создайте аккаунт, чтобы проходить обучение, развивать идеи и работать с наставниками."
              : "Войдите в аккаунт «Мой бизнес», чтобы продолжить обучение и работу над проектами."}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.illustrationCol}>
            <img
              src="/images/tracks/idea-check.svg"
              alt=""
              className={styles.illustration}
            />
          </div>

          <form className={styles.formCol} onSubmit={handleSubmit} noValidate>
            {isRegister && (
              <>
                <label className={styles.field} htmlFor="auth-first-name">
                  <UserIcon className={styles.fieldIcon} aria-hidden="true" />
                  <input
                    id="auth-first-name"
                    type="text"
                    className={styles.input}
                    placeholder="Имя"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </label>

                <label className={styles.field} htmlFor="auth-last-name">
                  <UserIcon className={styles.fieldIcon} aria-hidden="true" />
                  <input
                    id="auth-last-name"
                    type="text"
                    className={styles.input}
                    placeholder="Фамилия"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </label>
              </>
            )}

            <label className={styles.field} htmlFor="auth-email">
              <MailIcon className={styles.fieldIcon} aria-hidden="true" />
              <input
                id="auth-email"
                type="email"
                className={styles.input}
                placeholder="Электронная почта"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className={styles.field} htmlFor="auth-password">
              <LockIcon className={styles.fieldIcon} aria-hidden="true" />
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                className={styles.input}
                placeholder="Пароль"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? (
                  <EyeOffIcon className={styles.eyeIcon} aria-hidden="true" />
                ) : (
                  <EyeIcon className={styles.eyeIcon} aria-hidden="true" />
                )}
              </button>
            </label>

            {isRegister && (
              <label className={styles.field} htmlFor="auth-confirm-password">
                <LockIcon className={styles.fieldIcon} aria-hidden="true" />
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  className={styles.input}
                  placeholder="Повторите пароль"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  aria-label={showConfirmPassword ? "Скрыть пароль" : "Показать пароль"}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? (
                    <EyeOffIcon className={styles.eyeIcon} aria-hidden="true" />
                  ) : (
                    <EyeIcon className={styles.eyeIcon} aria-hidden="true" />
                  )}
                </button>
              </label>
            )}

            {errorText && <div className={styles.errorBox}>{errorText}</div>}

            <button type="submit" className={styles.submitBtn}>
              {isRegister ? "Зарегистрироваться" : "Войти"}
            </button>

            <div className={styles.switchRow}>
              <span className={styles.switchMuted}>
                {isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}
              </span>
              <Link
                to={isRegister ? "/login" : "/register"}
                className={styles.switchLink}
              >
                {isRegister ? "Войдите" : "Зарегистрируйтесь"}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

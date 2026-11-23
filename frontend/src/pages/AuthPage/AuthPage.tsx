import { useRef, useState } from "react"
import type { FormEvent } from "react"
import { Link, useLocation } from "react-router-dom"
import logoUrl from "../../assets/brand/logo.svg"
import UserIcon from "../../assets/icons/user.svg?react"
import MailIcon from "../../assets/icons/mail.svg?react"
import LockIcon from "../../assets/icons/lock.svg?react"
import EyeIcon from "../../assets/icons/eye.svg?react"
import EyeOffIcon from "../../assets/icons/eye-off.svg?react"
import { useApp } from "../../contexts/AppContext"
import { useToast } from "../../contexts/ToastContext"
import { ApiError, errorMessage } from "../../api/client"
import styles from "./AuthPage.module.css"

type AuthMode = "register" | "login"
type AuthField = "first_name" | "last_name" | "email" | "password"
type FieldErrors = Partial<Record<AuthField, string>>

const emailPattern =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/u
const namePattern = /^[\p{L}\p{M}]+(?:[- '’][\p{L}\p{M}]+)*$/u
const simplifiedRegistration = import.meta.env.VITE_SIMPLIFIED_REGISTRATION

// Собирает формы входа и регистрации с режимом проверки из сборки.
export default function AuthPage({ mode }: { mode: AuthMode }) {
  const { signIn, signUp } = useApp()
  const { showToast } = useToast()
  const location = useLocation()
  // Поля, показ пароля и сообщения проверки. Данные формы остаются на экране при ошибке API.
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [fieldsError, setFieldsError] = useState<FieldErrors>({})
  const [pending, setPending] = useState(false)
  const dismissError = useRef<(() => void) | null>(null)
  const isRegister = mode === "register"
  const canSubmit = !pending

  // Проверяет обязательные поля до отправки запроса.
  function validate() {
    const errors: FieldErrors = {}
    if (isRegister) {
      const first = firstName.trim()
      const last = lastName.trim()
      if (
        !simplifiedRegistration &&
        (!first || first.length > 100 || !namePattern.test(first) || !/[\p{L}]/u.test(first))
      )
        errors.first_name = "Введите имя: буквы, пробел, дефис или апостроф"
      if (
        !simplifiedRegistration &&
        (!last || last.length > 100 || !namePattern.test(last) || !/[\p{L}]/u.test(last))
      )
        errors.last_name = "Введите фамилию: буквы, пробел, дефис или апостроф"
    }
    const normalizedEmail = email.trim()
    const [localPart = "", domain = ""] = normalizedEmail.split("@")
    if (
      !normalizedEmail ||
      normalizedEmail.length > 254 ||
      (!simplifiedRegistration &&
        (localPart.length > 64 ||
          domain.split(".").some((part) => part.length > 63) ||
          !emailPattern.test(normalizedEmail)))
    )
      errors.email = simplifiedRegistration ? "Введите почту" : "Введите корректный адрес почты"
    const requiresLongPassword = isRegister && !simplifiedRegistration
    if (
      !password.trim() ||
      password.length > 256 ||
      (requiresLongPassword && (password.length < 8 || !/\p{L}/u.test(password) || !/[0-9]/.test(password)))
    )
      errors.password = requiresLongPassword
        ? "Введите не менее 8 символов, включая букву и цифру"
        : "Введите пароль длиной не более 256 символов"
    return errors
  }

  // Отправляет форму серверу и связывает его ошибки с полями.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    dismissError.current?.()
    const errors = validate()
    setFieldsError(errors)
    if (Object.keys(errors).length) return

    setPending(true)
    try {
      if (isRegister)
        await signUp({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
        })
      else await signIn("login", email.trim().toLowerCase(), password)
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_EXISTS") {
        setFieldsError({ email: "Эта почта уже зарегистрирована" })
        return
      }
      const message =
        !isRegister && error instanceof ApiError && error.status === 401
          ? "Неверная почта или пароль"
          : errorMessage(error, isRegister ? "Не удалось создать аккаунт" : "Не удалось войти")
      dismissError.current = showToast({ message, type: "error" })
    } finally {
      setPending(false)
    }
  }

  // Привязывает сообщение об ошибке к полю через aria-describedby.
  function inputError(field: AuthField) {
    return fieldsError[field] ? (
      <span className={styles.fieldError} id={`auth-${field}-error`}>
        {fieldsError[field]}
      </span>
    ) : null
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
              src="/images/auth/illustration-780.webp"
              srcSet="/images/auth/illustration-384.webp 384w, /images/auth/illustration-780.webp 780w"
              sizes="(max-width: 768px) 170px, 380px"
              width={780}
              height={520}
              alt=""
              className={styles.illustration}
            />
          </div>
          <form className={styles.formCol} onSubmit={handleSubmit} noValidate aria-busy={pending}>
            {isRegister && (
              <>
                <label className={styles.fieldGroup} htmlFor="auth-first-name">
                  <span className={styles.field}>
                    <UserIcon className={styles.fieldIcon} aria-hidden="true" />
                    <input
                      id="auth-first-name"
                      className={styles.input}
                      placeholder="Имя"
                      aria-label="Имя"
                      autoComplete="given-name"
                      maxLength={100}
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      aria-invalid={Boolean(fieldsError.first_name)}
                      aria-describedby={fieldsError.first_name ? "auth-first_name-error" : undefined}
                    />
                  </span>
                  {inputError("first_name")}
                </label>
                <label className={styles.fieldGroup} htmlFor="auth-last-name">
                  <span className={styles.field}>
                    <UserIcon className={styles.fieldIcon} aria-hidden="true" />
                    <input
                      id="auth-last-name"
                      className={styles.input}
                      placeholder="Фамилия"
                      aria-label="Фамилия"
                      autoComplete="family-name"
                      maxLength={100}
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      aria-invalid={Boolean(fieldsError.last_name)}
                      aria-describedby={fieldsError.last_name ? "auth-last_name-error" : undefined}
                    />
                  </span>
                  {inputError("last_name")}
                </label>
              </>
            )}
            <label className={styles.fieldGroup} htmlFor="auth-email">
              <span className={styles.field}>
                <MailIcon className={styles.fieldIcon} aria-hidden="true" />
                <input
                  id="auth-email"
                  type={simplifiedRegistration ? "text" : "email"}
                  className={styles.input}
                  placeholder="Почта"
                  aria-label="Почта"
                  autoComplete={isRegister ? "email" : "username"}
                  autoCapitalize="none"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(fieldsError.email)}
                  aria-describedby={fieldsError.email ? "auth-email-error" : undefined}
                />
              </span>
              {inputError("email")}
            </label>
            <label className={styles.fieldGroup} htmlFor="auth-password">
              <span className={styles.field}>
                <LockIcon className={styles.fieldIcon} aria-hidden="true" />
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  className={styles.input}
                  placeholder="Пароль"
                  aria-label="Пароль"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  maxLength={256}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(fieldsError.password)}
                  aria-describedby={fieldsError.password ? "auth-password-error" : undefined}
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
              </span>
              {inputError("password")}
            </label>
            <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
              {pending ? "Подождите…" : isRegister ? "Зарегистрироваться" : "Войти"}
            </button>
            <div className={styles.switchRow}>
              <span className={styles.switchMuted}>{isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}</span>
              <Link
                to={isRegister ? "/login" : "/register"}
                state={location.state}
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

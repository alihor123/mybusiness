import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import ChevronLeftIcon from "../../assets/icons/chevron-left.svg?react"
import AlertCircleIcon from "../../assets/icons/alert-circle.svg?react"
import { useApp } from "../../contexts/AppContext"
import { INDUSTRY_OPTIONS, STAGE_OPTIONS, WEEKLY_HOURS_OPTIONS } from "../../data/mockData"
import type { ProjectBrief } from "../../data/mockData"
import styles from "./ProjectBriefPage.module.css"

const DEFAULT_NEW_BRIEF: ProjectBrief = {
  name: "",
  industry: INDUSTRY_OPTIONS[0],
  stage: STAGE_OPTIONS[0],
  audience: "",
  weeklyHours: WEEKLY_HOURS_OPTIONS[1],
  problem: "",
  value: "",
  doneSoFar: "",
  mentorRequest: "",
}

// Форма анкеты проекта для сохранения черновика и перехода к подбору наставника.
export default function ProjectBriefPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { projects, saveProjectBrief } = useApp()

  const existingProject = projectId ? projects.find((item) => item.id === projectId) : undefined

  // Состояние полей анкеты и уведомления о сохранении черновика.
  const [form, setForm] = useState<ProjectBrief>(existingProject?.brief ?? DEFAULT_NEW_BRIEF)
  const [savedMessage, setSavedMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  // Обновляет отдельное поле анкеты проекта.
  function updateField<K extends keyof ProjectBrief>(key: K, value: ProjectBrief[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSavedMessage("")
    setErrorMessage("")
  }

  // Сохраняет анкету как черновик без перехода к подбору наставника.
  function handleSaveDraft() {
    const safeBrief: ProjectBrief = {
      ...form,
      name: form.name.trim() || "Новый проект",
    }
    const savedId = saveProjectBrief(existingProject?.id ?? null, safeBrief)
    setSavedMessage("Черновик анкеты сохранён.")
    if (!existingProject) {
      navigate(`/projects/${savedId}/brief`, { replace: true })
    }
  }

  // Проверяет обязательные поля, сохраняет анкету и открывает подбор наставника.
  function handleMatchMentor() {
    if (!form.name.trim() || !form.problem.trim() || !form.mentorRequest.trim()) {
      setErrorMessage("Заполните название проекта, описание проблемы и запрос наставнику.")
      return
    }
    const savedId = saveProjectBrief(existingProject?.id ?? null, form)
    navigate(`/projects/${savedId}/mentors`)
  }

  return (
    <div className={styles.page}>
      <Link to="/projects" className={styles.backLink}>
        <ChevronLeftIcon className={styles.backIcon} aria-hidden="true" />
        <span>К списку проектов</span>
      </Link>

      <div className={styles.headingCol}>
        <div className={styles.title} role="heading" aria-level={1}>
          ОПИСАНИЕ ПРОЕКТА
        </div>
        <div className={styles.subtitle}>
          Заполните информацию о вашем проекте, чтобы мы подобрали подходящего наставника.
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.infoBanner}>
          <AlertCircleIcon className={styles.infoIcon} aria-hidden="true" />
          <span>Данные из обучения уже сохранены. При необходимости вы можете их уточнить.</span>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.col}>
            <label className={styles.field} htmlFor="brief-name">
              <span className={styles.label}>Название проекта</span>
              <input
                id="brief-name"
                type="text"
                className={styles.input}
                value={form.name}
                placeholder="Например, Кофе между парами"
                onChange={(event) => updateField("name", event.target.value)}
              />
            </label>

            <label className={styles.field} htmlFor="brief-industry">
              <span className={styles.label}>Отрасль</span>
              <select
                id="brief-industry"
                className={styles.select}
                value={form.industry}
                onChange={(event) => updateField("industry", event.target.value)}
              >
                {INDUSTRY_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className={styles.field} htmlFor="brief-stage">
              <span className={styles.label}>Стадия проекта</span>
              <select
                id="brief-stage"
                className={styles.select}
                value={form.stage}
                onChange={(event) => updateField("stage", event.target.value)}
              >
                {STAGE_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className={styles.field} htmlFor="brief-audience">
              <span className={styles.label}>Для кого ваш продукт или услуга?</span>
              <input
                id="brief-audience"
                type="text"
                className={styles.input}
                value={form.audience}
                placeholder="Например, студенты университета"
                onChange={(event) => updateField("audience", event.target.value)}
              />
            </label>

            <label className={styles.field} htmlFor="brief-hours">
              <span className={styles.label}>Время, которое вы готовы уделять проекту в неделю</span>
              <select
                id="brief-hours"
                className={styles.select}
                value={form.weeklyHours}
                onChange={(event) => updateField("weeklyHours", event.target.value)}
              >
                {WEEKLY_HOURS_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.col}>
            <label className={styles.field} htmlFor="brief-problem">
              <span className={styles.label}>В чём проблема?</span>
              <input
                id="brief-problem"
                type="text"
                className={styles.input}
                value={form.problem}
                placeholder="Опишите главную трудность клиента"
                onChange={(event) => updateField("problem", event.target.value)}
              />
            </label>

            <label className={styles.field} htmlFor="brief-value">
              <span className={styles.label}>В чём польза вашего решения?</span>
              <input
                id="brief-value"
                type="text"
                className={styles.input}
                value={form.value}
                placeholder="Как ваш продукт решает проблему?"
                onChange={(event) => updateField("value", event.target.value)}
              />
            </label>

            <label className={styles.field} htmlFor="brief-done">
              <span className={styles.label}>Что уже сделано?</span>
              <textarea
                id="brief-done"
                rows={3}
                className={styles.textarea}
                value={form.doneSoFar}
                placeholder="Расскажите о выполненных шагах"
                onChange={(event) => updateField("doneSoFar", event.target.value)}
              />
            </label>

            <label className={styles.field} htmlFor="brief-request">
              <span className={styles.label}>Чем может помочь наставник?</span>
              <textarea
                id="brief-request"
                rows={3}
                className={styles.textarea}
                value={form.mentorRequest}
                placeholder="Сформулируйте конкретный запрос"
                onChange={(event) => updateField("mentorRequest", event.target.value)}
              />
            </label>
          </div>
        </div>

        {errorMessage && <div className={styles.errorBox}>{errorMessage}</div>}
        {savedMessage && <div className={styles.savedBox}>{savedMessage}</div>}

        <div className={styles.actionsRow}>
          <button type="button" className={styles.outlineBtn} onClick={handleSaveDraft}>
            Сохранить черновик
          </button>
          <button type="button" className={styles.primaryBtn} onClick={handleMatchMentor}>
            Подобрать наставника
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import ChevronLeftIcon from "../../assets/icons/chevron-left.svg?react"
import AlertCircleIcon from "../../assets/icons/alert-circle.svg?react"
import { useToast } from "../../contexts/ToastContext"
import useResource from "../../hooks/useResource"
import useDraftAutosave from "../../hooks/useDraftAutosave"
import { LoadingSkeleton, ResourceError } from "../../components/AsyncState/AsyncState"
import { createProject, getProject, updateProject, type ProjectQuestionnaire } from "../../api/projects"
import { fetchLearningProgress } from "../../api/learning"
import styles from "./ProjectBriefPage.module.css"
import AudienceSelect, { type Audience } from "../../components/AudienceSelect/AudienceSelect"
import { useApp } from "../../contexts/AppContext"

const blankBrief: Omit<ProjectQuestionnaire, "project_audience"> & { project_audience: Audience } = {
  title: "",
  industry: "",
  stage: "",
  audience: "",
  problem: "",
  solution_benefit: "",
  mentor_request: "",
  project_audience: "student",
}

// Сохраняет анкету проекта только в полях, которые принимает сервер.
export default function ProjectBriefPage() {
  const { projectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { session } = useApp()
  const profileAudience = session.status === "ready" ? session.profile.audience : "student"
  const project = useResource(projectId ?? null, (signal) => getProject(projectId!, signal))
  const progress = useResource(projectId ? null : `learning-progress-${profileAudience}`, (signal) =>
    fetchLearningProgress(signal, profileAudience),
  )
  // Поля анкеты редактируются локально до сохранения очередного снимка.
  const [form, setForm] = useState<ProjectQuestionnaire>({ ...blankBrief, project_audience: profileAudience })
  const [busy, setBusy] = useState(false)
  // Сохраняет ID, если создание прошло, а обновление анкеты завершилось ошибкой.
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)
  const autosave = useDraftAutosave()
  const isAccompaniment = project.data ? Boolean(project.data.mentor_id) : location.state?.fromAbout === true
  const returnToAbout = `/projects/${projectId}?tab=about`

  useEffect(() => {
    if (!project.data) return
    setForm({
      title: project.data.title ?? "",
      industry: project.data.industry ?? "",
      stage: project.data.stage ?? "",
      audience: project.data.audience ?? "",
      problem: project.data.problem ?? "",
      solution_benefit: project.data.solution_benefit ?? "",
      mentor_request: project.data.mentor_request ?? "",
      project_audience: project.data.project_audience ?? profileAudience,
    })
  }, [project.data])

  // Создаёт проект перед первым сохранением анкеты.
  async function ensureProject() {
    if (projectId) return projectId
    if (createdProjectId) return createdProjectId
    if (!progress.data?.can_create_project) throw new Error("Сначала завершите обязательные шаги обучения")
    const created = await createProject()
    setCreatedProjectId(created.id)
    return created.id
  }

  // Явное сохранение отправляет всю анкету, включая последние изменения.
  async function save(next: "create" | "mentors") {
    if (next === "mentors" && (!canMatch || isAccompaniment)) return
    setBusy(true)
    try {
      const id = await ensureProject()
      await updateProject(id, { ...form, saved_at_ms: Date.now() })
      autosave.cancel()
      if (isAccompaniment) navigate(returnToAbout, { replace: true })
      else if (next === "mentors") navigate(`/projects/${id}/mentors`)
      else navigate(`/projects/${id}/brief`, { replace: true })
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось сохранить анкету",
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  // Изменения существующего проекта уходят через короткую паузу.
  function field(key: keyof ProjectQuestionnaire, value: string) {
    const next = { ...form, [key]: value }
    const id = projectId ?? createdProjectId
    setForm(next)
    if (id) {
      const savedAt = Date.now()
      autosave.schedule(() => updateProject(id, { ...next, saved_at_ms: savedAt }))
    }
  }

  const fields: Array<{
    key: keyof ProjectQuestionnaire
    label: string
    multiline?: boolean
    placeholder: string
  }> = [
    { key: "title", label: "Название проекта", placeholder: "Например, Кофе между парами" },
    { key: "industry", label: "Отрасль", placeholder: "Например, образование" },
    { key: "stage", label: "Стадия проекта", placeholder: "Идея, проверка, первые продажи" },
    {
      key: "audience",
      label: "Целевая аудитория",
      placeholder: "Для кого ваш продукт или услуга?",
      multiline: true,
    },
    { key: "problem", label: "Проблема", placeholder: "Какую проблему решает проект?", multiline: true },
    {
      key: "solution_benefit",
      label: "Польза решения",
      placeholder: "Какую пользу получит аудитория?",
      multiline: true,
    },
    {
      key: "mentor_request",
      label: "Запрос наставнику",
      placeholder: "Чем может помочь наставник?",
      multiline: true,
    },
  ]

  const canCreate = Boolean(projectId || progress.data?.can_create_project)
  const canMatch = canCreate && fields.every(({ key }) => Boolean(form[key]?.trim()))

  return (
    <div className={styles.page}>
      <Link
        to={isAccompaniment ? returnToAbout : "/projects"}
        className={styles.backLink}
        onClick={isAccompaniment ? async (event) => {
          if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          await autosave.flush()
          navigate(returnToAbout, { replace: true })
        } : undefined}
      >
        <ChevronLeftIcon className={styles.backIcon} aria-hidden="true" />
        <span>{isAccompaniment ? "К проекту" : "К списку проектов"}</span>
      </Link>
      <div className={styles.headingCol}>
        <div className={styles.title} role="heading" aria-level={1}>
          ОПИСАНИЕ ПРОЕКТА
        </div>
        <div className={styles.subtitle}>
          {isAccompaniment ? "Обновите информацию о проекте." : "Заполните информацию, чтобы подобрать подходящего наставника."}
        </div>
      </div>

      {project.loading && !project.data && <LoadingSkeleton variant="form" />}
      {project.error && <ResourceError message={project.error} retry={project.reload} />}
      {!projectId && progress.loading && <LoadingSkeleton variant="form" />}
      {!projectId && progress.error && <ResourceError message={progress.error} retry={progress.reload} />}

      {(project.data || (!projectId && progress.data)) && (
        <div className={styles.card}>
          {!isAccompaniment && (
            <div className={styles.infoBanner}>
              <AlertCircleIcon className={styles.infoIcon} aria-hidden="true" />
              <span>Для подбора наставника нужны все семь полей.</span>
            </div>
          )}
          <div className={styles.formGrid}>
            <AudienceSelect
              id="project-audience"
              label="Аудитория проекта"
              value={form.project_audience as Audience}
              disabled={busy || isAccompaniment}
              onChange={(value) => field("project_audience", value)}
            />
            {isAccompaniment && <div className={styles.infoBanner} role="note">Аудитория проекта закреплена при начале сопровождения и уже не меняется.</div>}
            {fields.map(({ key, label, multiline, placeholder }) => (
              <label key={key} className={styles.field}>
                <span className={styles.label}>{label}</span>
                {multiline ? (
                  <textarea
                    rows={3}
                    className={styles.textarea}
                    readOnly={busy}
                    value={form[key] ?? ""}
                    maxLength={2000}
                    placeholder={placeholder}
                    onChange={(event) => field(key, event.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    className={styles.input}
                    readOnly={busy}
                    value={form[key] ?? ""}
                    maxLength={200}
                    placeholder={placeholder}
                    onChange={(event) => field(key, event.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          {!projectId && progress.data?.can_create_project === false && (
            <div className={styles.errorBox}>Завершите обязательные шаги обучения, чтобы создать проект.</div>
          )}
          <div className={styles.actionsRow}>
            {!projectId && (
              <button
                type="button"
                className={styles.outlineBtn}
                disabled={busy || !canCreate}
                onClick={() => void save("create")}
              >
                Создать проект
              </button>
            )}
            {projectId && isAccompaniment && (
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={busy}
                onClick={() => void save("create")}
              >
                Сохранить изменения
              </button>
            )}
            {!isAccompaniment && (
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={busy || !canMatch}
                onClick={() => void save("mentors")}
              >
                Подобрать наставника
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

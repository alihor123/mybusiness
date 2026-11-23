import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import ChevronLeftIcon from "../../assets/icons/chevron-left.svg?react"
import AlertCircleIcon from "../../assets/icons/alert-circle.svg?react"
import { useToast } from "../../contexts/ToastContext"
import useResource from "../../hooks/useResource"
import { LoadingSkeleton, ResourceError } from "../../components/AsyncState/AsyncState"
import { createProject, getProject, updateProject, type ProjectQuestionnaire } from "../../api/projects"
import { fetchLearningProgress } from "../../api/learning"
import styles from "./ProjectBriefPage.module.css"

const blankBrief: ProjectQuestionnaire = {
  title: "",
  industry: "",
  stage: "",
  audience: "",
  problem: "",
  solution_benefit: "",
  mentor_request: "",
}

// Сохраняет анкету проекта только в полях, которые принимает сервер.
export default function ProjectBriefPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const project = useResource(projectId ?? null, (signal) => getProject(projectId!, signal))
  const progress = useResource(projectId ? null : "learning-progress", fetchLearningProgress)
  const [form, setForm] = useState<ProjectQuestionnaire>(blankBrief)
  const [busy, setBusy] = useState(false)
  // Сохраняет ID, если создание прошло, а обновление анкеты завершилось ошибкой.
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)

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
    })
  }, [project.data])

  async function ensureProject() {
    if (projectId) return projectId
    if (createdProjectId) return createdProjectId
    if (!progress.data?.can_create_project) throw new Error("Сначала завершите обязательные шаги обучения")
    const created = await createProject()
    setCreatedProjectId(created.id)
    return created.id
  }

  async function save(next: "draft" | "mentors") {
    setBusy(true)
    try {
      const id = await ensureProject()
      await updateProject(id, form)
      if (next === "mentors") navigate(`/projects/${id}/mentors`)
      else {
        showToast({ message: "Черновик анкеты сохранён", type: "success" })
        if (!projectId) navigate(`/projects/${id}/brief`, { replace: true })
      }
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось сохранить анкету",
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  function field(key: keyof ProjectQuestionnaire, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
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
        <div className={styles.subtitle}>Заполните информацию, чтобы подобрать подходящего наставника.</div>
      </div>

      {project.loading && <LoadingSkeleton variant="form" />}
      {project.error && <ResourceError message={project.error} retry={project.reload} />}
      {!projectId && progress.loading && <LoadingSkeleton variant="form" />}
      {!projectId && progress.error && <ResourceError message={progress.error} retry={progress.reload} />}

      {!project.loading && !project.error && (projectId || progress.data) && (
        <div className={styles.card}>
          <div className={styles.infoBanner}>
            <AlertCircleIcon className={styles.infoIcon} aria-hidden="true" />
            <span>
              Сохранить черновик можно до заполнения всех полей. Для подбора наставника нужны все семь полей.
            </span>
          </div>
          <div className={styles.formGrid}>
            {fields.map(({ key, label, multiline, placeholder }) => (
              <label key={key} className={styles.field}>
                <span className={styles.label}>{label}</span>
                {multiline ? (
                  <textarea
                    rows={3}
                    className={styles.textarea}
                    value={form[key] ?? ""}
                    maxLength={2000}
                    placeholder={placeholder}
                    onChange={(event) => field(key, event.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    className={styles.input}
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
            <button
              type="button"
              className={styles.outlineBtn}
              disabled={busy || !canCreate}
              onClick={() => void save("draft")}
            >
              Сохранить черновик
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy || !canCreate}
              onClick={() => void save("mentors")}
            >
              Подобрать наставника
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { getProjectMeeting, getProjectPlan, listProjects, type ProjectMeeting, type ProjectOut } from "../../api/projects"
import { saveMeeting } from "../../api/accompaniment"
import { errorMessage } from "../../api/client"
import useResource from "../../hooks/useResource"
import { LoadingSkeleton, ResourceError, EmptyState } from "../../components/AsyncState/AsyncState"
import { useToast } from "../../contexts/ToastContext"
import styles from "./MentorProjectsPage.module.css"

const taskLabels = {
  todo: "К выполнению",
  submitted: "Проверить",
  revision_requested: "На доработке",
  accepted: "Принято",
}

// Форматирует дату сервера для поля локального времени.
function toLocalTime(timestamp: string) {
  const moment = new Date(timestamp)
  return new Date(moment.getTime() - moment.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

// Сохраняет ближайшую встречу для одного проекта.
function MeetingForm({ projectId, meeting }: { projectId: string, meeting: ProjectMeeting | null }) {
  const { showToast } = useToast()
  // Сервер хранит время с часовым поясом, ввод остаётся локальным для наставника.
  const [form, setForm] = useState({
    title: meeting?.title ?? "",
    starts_at: meeting ? toLocalTime(meeting.starts_at) : "",
    url: meeting?.url ?? "",
  })
  const [saving, setSaving] = useState(false)

  // Передаёт точный момент встречи в ISO и показывает результат запроса.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    const dismiss = showToast({ message: "Сохраняем встречу", persistent: true })
    try {
      const saved = await saveMeeting(projectId, {
        ...form,
        starts_at: new Date(form.starts_at).toISOString(),
      })
      setForm({ title: saved.title, starts_at: toLocalTime(saved.starts_at), url: saved.url })
      showToast({ message: "Встреча сохранена", type: "success" })
    } catch (error) {
      showToast({ message: errorMessage(error, "Не удалось сохранить встречу"), type: "error" })
    } finally {
      dismiss()
      setSaving(false)
    }
  }

  return (
    <form className={styles.meetingForm} onSubmit={submit} aria-busy={saving}>
      <div className={styles.meetingTitle}>Встреча с учеником</div>
      <label>
        Тема встречи
        <input required value={form.title} maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} />
      </label>
      <label>
        Время встречи
        <input required type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} />
      </label>
      <label>
        Ссылка на встречу
        <input required type="url" placeholder="https://" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} />
      </label>
      <button type="submit" className={styles.reviewBtn} disabled={saving}>
        {saving ? "Сохраняем…" : "Сохранить встречу"}
      </button>
    </form>
  )
}

// Загружает задачи и встречу независимо, чтобы сбой одного запроса не скрывал другой раздел.
function MentorProjectCard({ project }: { project: ProjectOut }) {
  const plan = useResource(project.id, (signal) => getProjectPlan(project.id, signal))
  const meeting = useResource(project.id, (signal) => getProjectMeeting(project.id, signal))
  const isArchived = project.status === "archived"
  const pending = plan.data?.tasks.some((task) => task.status === "submitted")

  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>{project.title || "Проект без названия"}</div>
      <div className={styles.statusPill}>
        {isArchived ? "Архив" : pending ? "Есть работа на проверке" : "Сопровождение"}
      </div>
      <div className={styles.cardDesc}>{project.problem || project.mentor_request || "Описание проекта не заполнено"}</div>
      {plan.loading && !plan.data && <LoadingSkeleton variant="list" count={2} />}
      {plan.error && <ResourceError message={plan.error} retry={plan.reload} />}
      {plan.data && (
        <>
          <div className={styles.metaRow}>Прогресс: {plan.data.accepted_count} из {plan.data.tasks.length} задач</div>
          {plan.data.tasks.map((task) => (
            <Link key={task.id} className={styles.reviewBtn} to={`/mentor/projects/${project.id}/tasks/${task.id}`}>
              {task.title} · {taskLabels[task.status]}
            </Link>
          ))}
        </>
      )}
      {meeting.loading && !meeting.data && <LoadingSkeleton variant="form" />}
      {meeting.error && <ResourceError message={meeting.error} retry={meeting.reload} />}
      {!meeting.loading && !meeting.error && (isArchived
        ? meeting.data && <a href={meeting.data.url} target="_blank" rel="noreferrer">{meeting.data.title}</a>
        : <MeetingForm key={meeting.data?.starts_at ?? "new"} projectId={project.id} meeting={meeting.data} />)}
    </section>
  )
}

// Показывает подтверждённые сервером проекты наставника.
export default function MentorProjectsPage() {
  const { data, loading, error, reload } = useResource("mentor-projects", listProjects)
  const projects = (data ?? []).filter((project) => project.status === "accompaniment" || project.status === "archived")

  return (
    <div className={styles.page}>
      <div className={styles.headingCol}>
        <div className={styles.title} role="heading" aria-level={1}>МОИ ПРОЕКТЫ</div>
        <div className={styles.subtitle}>Проекты учеников и работы, ожидающие проверки.</div>
      </div>
      {error && <ResourceError message={error} retry={reload} />}
      {loading && !data && <LoadingSkeleton variant="cards" count={2} />}
      {data && (projects.length === 0
        ? <EmptyState message="Пока нет проектов на сопровождении" />
        : <div className={styles.grid}>{projects.map((project) => <MentorProjectCard key={project.id} project={project} />)}</div>)}
    </div>
  )
}

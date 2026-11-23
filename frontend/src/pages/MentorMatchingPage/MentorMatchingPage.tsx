import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import ChevronLeftIcon from "../../assets/icons/chevron-left.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import MentorDirectory, { MentorDirectorySkeleton } from "../../components/MentorDirectory/MentorDirectory"
import useResource from "../../hooks/useResource"
import { LoadingSkeleton, ResourceError, EmptyState } from "../../components/AsyncState/AsyncState"
import AiActivity from "../../components/AsyncState/AiActivity"
import { useToast } from "../../contexts/ToastContext"
import {
  applyToMentor,
  getMentors,
  getProject,
  getRecommendations,
  listApplications,
  withdrawApplication,
  type MentorOut,
} from "../../api/projects"
import styles from "./MentorMatchingPage.module.css"

// Показывает рекомендации и позволяет подать несколько заявок, включая ручной подбор.
export default function MentorMatchingPage() {
  const { projectId = "" } = useParams()
  const { showToast } = useToast()
  const project = useResource(projectId, (signal) => getProject(projectId, signal))
  const mentors = useResource("mentors", getMentors)
  const applications = useResource(projectId, (signal) => listApplications(projectId, signal))
  const [selected, setSelected] = useState<MentorOut | null>(null)
  // Сохраняет рекомендации при переключении между подбором и полным каталогом.
  const [recommendations, setRecommendations] = useState<{ reasons: Record<string, string>, visible: boolean } | null>(null)
  const [matching, setMatching] = useState(false)
  const [matchingError, setMatchingError] = useState(false)
  const [applying, setApplying] = useState(false)
  const complete = Boolean(
    project.data?.title &&
      project.data.industry &&
      project.data.stage &&
      project.data.audience &&
      project.data.problem &&
      project.data.solution_benefit &&
      project.data.mentor_request,
  )
  const visibleReasons = recommendations?.visible ? recommendations.reasons : null
  const candidates = useMemo(
    () =>
      (mentors.data ?? []).filter(
        (mentor) => mentor.active && (visibleReasons === null || mentor.id in visibleReasons),
      ),
    [mentors.data, visibleReasons],
  )

  async function match() {
    if (!project.data || !complete || matching || recommendations) return
    setMatching(true)
    setMatchingError(false)
    try {
      const result = await getRecommendations(projectId, {
        title: project.data.title,
        industry: project.data.industry,
        stage: project.data.stage,
        audience: project.data.audience,
        problem: project.data.problem,
        solution_benefit: project.data.solution_benefit,
        mentor_request: project.data.mentor_request,
      })
      if (result.recommendations.length) {
        setSelected(null)
        setRecommendations({
          reasons: Object.fromEntries(result.recommendations.map((item) => [item.mentor_id, item.reason])),
          visible: true,
        })
      }
    } catch (error) {
      setMatchingError(true)
    } finally {
      setMatching(false)
    }
  }

  // Переключает список для уже полученного результата подбора.
  function toggleRecommendations() {
    setSelected(null)
    setRecommendations((current) => current && { ...current, visible: !current.visible })
  }

  async function apply(mentor: MentorOut) {
    if (applying) return
    setApplying(true)
    try {
      const application = await applyToMentor(projectId, mentor.id)
      applications.setData((current) => [...(current ?? []).filter((item) => item.id !== application.id), application])
      showToast({ message: `Заявка наставнику ${mentor.name} отправлена`, type: "success" })
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось отправить заявку",
        type: "error",
      })
    } finally {
      setApplying(false)
    }
  }

  async function withdraw(applicationId: string) {
    if (applying) return
    setApplying(true)
    try {
      await withdrawApplication(applicationId)
      applications.setData((current) => current?.filter((item) => item.id !== applicationId) ?? [])
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось отозвать заявку",
        type: "error",
      })
    } finally {
      setApplying(false)
    }
  }

  function mentorById(id: string) {
    return mentors.data?.find((mentor) => mentor.id === id)
  }
  const visibleApplications = applications.data?.filter((item) => item.status !== "withdrawn") ?? []
  const selectedApplication =
    selected && visibleApplications.find((item) => item.mentor_id === selected.id && item.status === "pending")
  const mentorAssigned = project.data?.status === "accompaniment" || project.data?.status === "archived"
  function applicationStatus(status: string) {
    if (status === "pending") return "Ожидает ответа"
    if (status === "accepted") return "Наставник принял заявку"
    if (status === "rejected") return "Отказ"
    return "Закрыта: выбран другой наставник"
  }

  const heading = (
    <div className={styles.headingRow}>
      <div className={styles.headingCol}>
        <div className={styles.title} role="heading" aria-level={1}>
          ВЫБЕРИТЕ НАСТАВНИКА
        </div>
        <div className={styles.subtitle}>Получите рекомендации или выберите специалиста вручную.</div>
      </div>
      {project.data && (
        mentorAssigned ? (
          <Link className={styles.headingAction} to={`/projects/${projectId}`}>
            Перейти к плану проекта
          </Link>
        ) : (
          <button
            type="button"
            className={styles.headingAction}
            disabled={!recommendations && (!complete || matching)}
            onClick={recommendations ? toggleRecommendations : () => void match()}
          >
            {recommendations
              ? (recommendations.visible ? "Показать весь каталог" : "Показать рекомендации")
              : (matching ? "Подбираем…" : "Подобрать наставников")}
          </button>
        )
      )}
    </div>
  )

  return (
    <div className={styles.page}>
      <Link to={`/projects/${projectId}/brief`} className={styles.backLink}>
        <ChevronLeftIcon className={styles.backIcon} aria-hidden="true" />
        <span>К анкете проекта</span>
      </Link>
      {project.loading && !project.data && (
        <div className={styles.projectBanner}>
          <div className={styles.projectBannerLabel}>Проект</div>
          <div className={styles.projectNamePlaceholder} aria-hidden="true" />
        </div>
      )}
      {project.error && <ResourceError message={project.error} retry={project.reload} />}
      {project.data && (
        <div className={styles.projectBanner}>
          <div className={styles.projectBannerText}>
            <div className={styles.projectBannerLabel}>Проект</div>
            <div className={styles.projectBannerName}>{project.data.title || "Новый проект"}</div>
          </div>
        </div>
      )}
      {project.data ? (
        <MentorDirectory
          mentors={candidates}
          selected={selected}
          onSelect={setSelected}
          recommendationReason={selected ? recommendations?.reasons[selected.id] : undefined}
          panelHint={
            mentorAssigned
              ? "Наставник уже назначен этому проекту."
              : selectedApplication
                ? "Вы уже отправили этому наставнику заявку."
                  : undefined
          }
          listBefore={
            <>
              <div className={styles.directoryHeading}>
                {heading}
                {!complete && (
                  <div className={styles.lockBanner}>
                    Заполните все семь полей анкеты для подбора и подачи заявки.
                  </div>
                )}
                {matching && (
                  <AiActivity status="checking" compact message="Подбираем наставников по анкете проекта" />
                )}
                {matchingError && (
                  <AiActivity
                    status="check_unavailable"
                    compact
                    message="Подбор временно недоступен. Выберите наставника из каталога."
                    onRetry={() => void match()}
                  />
                )}
                <div className={styles.sectionLabel}>
                  {visibleReasons ? "Рекомендованные наставники" : "Каталог наставников"}
                </div>
              </div>
              {mentors.loading && <MentorDirectorySkeleton />}
              {mentors.error && <ResourceError message={mentors.error} retry={mentors.reload} />}
              {!mentors.loading && !mentors.error && candidates.length === 0 && (
                <EmptyState message="Наставников по этим критериям нет." />
              )}
            </>
          }
          listAfter={
            <section className={styles.applications} aria-label="Ваши заявки">
              <div className={styles.sectionLabel}>Ваши заявки</div>
              {applications.loading && <LoadingSkeleton variant="list" />}
              {applications.error && <ResourceError message={applications.error} retry={applications.reload} />}
              {!applications.loading && !applications.error && !visibleApplications.length && (
                <EmptyState message="Заявок пока нет." />
              )}
              {visibleApplications.length > 0 && (
                <div className={styles.applicationCards}>
                  {visibleApplications.map((application) => (
                    <div key={application.id} className={styles.appliedBox}>
                      <div className={styles.applicationInfo}>
                        <div className={styles.applicationName}>{mentorById(application.mentor_id)?.name ?? "Наставник"}</div>
                        <div className={styles.applicationStatus}>{applicationStatus(application.status)}</div>
                      </div>
                      {application.status === "pending" && (
                        <button
                          type="button"
                          className={styles.withdrawIconBtn}
                          aria-label="Отозвать заявку"
                          title="Отозвать заявку"
                          disabled={applying}
                          onClick={() => void withdraw(application.id)}
                        >
                          <CloseIcon aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          }
          panelFooter={
            mentorAssigned ? (
              <Link className={styles.applyBtn} to={`/projects/${projectId}`}>
                Перейти к плану проекта
              </Link>
            ) : selectedApplication ? (
              <button
                type="button"
                className={styles.cancelBtn}
                disabled={applying}
                onClick={() => void withdraw(selectedApplication.id)}
              >
                Отозвать отправленную заявку
              </button>
            ) : (
              selected &&
              complete && (
                <button
                  type="button"
                  className={styles.applyBtn}
                  disabled={applying}
                  onClick={() => void apply(selected)}
                >
                  {applying ? "Отправляем…" : "Отправить заявку"}
                </button>
              )
            )
          }
        />
      ) : heading}
    </div>
  )
}

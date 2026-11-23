import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import ChevronLeftIcon from "../../assets/icons/chevron-left.svg?react"
import CheckIcon from "../../assets/icons/check.svg?react"
import SidePanel from "../../components/SidePanel/SidePanel"
import MentorDetailsContent from "../../components/MentorDetailsContent/MentorDetailsContent"
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
  const [recommendedIds, setRecommendedIds] = useState<string[] | null>(null)
  const [recommendationReasons, setRecommendationReasons] = useState<Record<string, string>>({})
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
  const candidates = useMemo(
    () =>
      (mentors.data ?? []).filter(
        (mentor) => mentor.active && (recommendedIds === null || recommendedIds.includes(mentor.id)),
      ),
    [mentors.data, recommendedIds],
  )

  async function match() {
    if (!project.data) return
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
      const ids = result.recommendations.map((item) => item.mentor_id)
      setRecommendedIds(ids.length ? ids : null)
      setRecommendationReasons(
        Object.fromEntries(result.recommendations.map((item) => [item.mentor_id, item.reason])),
      )
    } catch (error) {
      setRecommendedIds(null)
      setRecommendationReasons({})
      setMatchingError(true)
    } finally {
      setMatching(false)
    }
  }

  async function apply(mentor: MentorOut) {
    setApplying(true)
    try {
      await applyToMentor(projectId, mentor.id)
      applications.reload()
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
    try {
      await withdrawApplication(applicationId)
      applications.reload()
      showToast({ message: "Заявка отозвана", type: "success" })
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось отозвать заявку",
        type: "error",
      })
    }
  }

  function mentorById(id: string) {
    return mentors.data?.find((mentor) => mentor.id === id)
  }
  const selectedApplication =
    selected && applications.data?.find((item) => item.mentor_id === selected.id && item.status === "pending")
  const mentorAssigned = project.data?.status === "accompaniment" || project.data?.status === "archived"
  function applicationStatus(status: string) {
    if (status === "pending") return "Ожидает ответа"
    if (status === "accepted") return "Наставник принял заявку"
    if (status === "rejected") return "Отказ"
    if (status === "withdrawn") return "Отозвана"
    return "Закрыта: выбран другой наставник"
  }

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
      <div className={styles.headingCol}>
        <div className={styles.title} role="heading" aria-level={1}>
          ВЫБЕРИТЕ НАСТАВНИКА
        </div>
        <div className={styles.subtitle}>Получите рекомендации или выберите специалиста вручную.</div>
      </div>
      {project.data && (
        <>
          {mentorAssigned ? (
            <div className={styles.detailActions}>
              <Link className={styles.applyBtn} to={`/projects/${projectId}`}>
                Перейти к плану проекта
              </Link>
            </div>
          ) : (
            <div className={styles.detailActions}>
              <button
                type="button"
                className={styles.applyBtn}
                disabled={!complete || matching}
                onClick={() => void match()}
              >
                {matching ? "Подбираем…" : "Подобрать наставников"}
              </button>
            </div>
          )}
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
            {recommendedIds !== null ? "Рекомендованные наставники" : "Каталог наставников"}
          </div>
          {recommendedIds !== null && (
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => {
                setRecommendedIds(null)
                setRecommendationReasons({})
              }}
            >
              Показать весь каталог
            </button>
          )}
          {mentors.loading && <LoadingSkeleton variant="cards" />}
          {mentors.error && <ResourceError message={mentors.error} retry={mentors.reload} />}
          {!mentors.loading && !mentors.error && candidates.length === 0 && (
            <EmptyState message="Наставников по этим критериям нет." />
          )}
          <div className={styles.layout}>
            <div className={styles.mentorsGrid}>
              {candidates.map((mentor) => {
                const application = applications.data?.find(
                  (item) => item.mentor_id === mentor.id && item.status === "pending",
                )
                return (
                  <button
                    key={mentor.id}
                    type="button"
                    className={`${styles.mentorCard} ${selected?.id === mentor.id ? styles.mentorCardSelected : ""}`}
                    onClick={() => setSelected(mentor)}
                  >
                    <div className={styles.cardPhotoWrap}>
                      <img src={mentor.portrait_url} alt="" className={styles.cardPhoto} />
                    </div>
                    <div className={styles.cardName}>{mentor.name}</div>
                    <div className={styles.cardRole}>{mentor.headline}</div>
                    <div className={styles.cardExp}>Опыт: {mentor.experience_label}</div>
                    {recommendationReasons[mentor.id] && (
                      <div className={styles.cardExp}>{recommendationReasons[mentor.id]}</div>
                    )}
                    {application ? (
                      <span>
                        <CheckIcon aria-hidden="true" /> Заявка отправлена
                      </span>
                    ) : (
                      <span>Подробнее</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          <div className={styles.sectionLabel}>Ваши заявки</div>
          {applications.loading && <LoadingSkeleton variant="list" />}
          {applications.error && <ResourceError message={applications.error} retry={applications.reload} />}
          {!applications.loading && !applications.error && !applications.data?.length && (
            <EmptyState message="Заявок пока нет." />
          )}
          {applications.data?.map((application) => (
            <div key={application.id} className={styles.appliedBox}>
              <span>
                {mentorById(application.mentor_id)?.name ?? "Наставник"} ·{" "}
                {applicationStatus(application.status)}
              </span>
              {application.status === "pending" && (
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => void withdraw(application.id)}
                >
                  Отозвать заявку
                </button>
              )}
            </div>
          ))}
          <SidePanel
            open={Boolean(selected)}
            title={selected?.name}
            subtitle={selected?.headline}
            onClose={() => setSelected(null)}
            footer={
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
          >
            {selected && (
              <MentorDetailsContent
                mentor={selected}
                hint={
                  mentorAssigned
                    ? "Наставник уже назначен этому проекту."
                    : selectedApplication
                      ? "Вы уже отправили этому наставнику заявку."
                      : undefined
                }
              />
            )}
          </SidePanel>
        </>
      )}
    </div>
  )
}

import { useState } from "react"
import {
  getMentorApplications,
  getApplication,
  decideApplication,
  type AccompanimentApplication,
  type ApplicationDetail,
} from "../../api/accompaniment"
import useResource from "../../hooks/useResource"
import { LoadingSkeleton, ResourceError, EmptyState } from "../../components/AsyncState/AsyncState"
import { useToast } from "../../contexts/ToastContext"
import SidePanel from "../../components/SidePanel/SidePanel"
import styles from "./MentorRequestsPage.module.css"

export default function MentorRequestsPage() {
  const { data, loading, error, reload, setData } = useResource("mentor-applications", (signal) =>
    getMentorApplications(signal),
  )
  const { showToast } = useToast()
  const [detail, setDetail] = useState<ApplicationDetail | null>(null)
  const [busy, setBusy] = useState(false)
  async function open(item: AccompanimentApplication) {
    try {
      setDetail(await getApplication(item.id))
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось открыть заявку",
        type: "error",
      })
    }
  }
  async function decide(decision: "accept" | "reject") {
    if (!detail) return
    setBusy(true)
    try {
      const result = await decideApplication(detail.id, decision, detail.project.questionnaire_version)
      setData((items) => (items ?? []).map((item) => (item.id === result.id ? { ...item, ...result } : item)))
      setDetail(null)
      showToast({ message: decision === "accept" ? "Заявка принята" : "Заявка отклонена", type: "success" })
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Не удалось сохранить решение",
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }
  const requests = (data ?? []).filter((item) => item.status === "pending")
  return (
    <div className={styles.page}>
      <div className={styles.stickyTop}>
        <div className={styles.title} role="heading" aria-level={1}>
          ЗАЯВКИ НА СОПРОВОЖДЕНИЕ
        </div>
      </div>
      <div className={styles.scrollArea}>
        {loading && !data ? <LoadingSkeleton variant="list" /> : error ? (
          <ResourceError message={error} retry={reload} />
        ) : requests.length === 0 ? (
          <EmptyState message="Новых заявок пока нет" />
        ) : (
          <div className={styles.list}>
            {requests.map((item) => (
              <article key={item.id} className={styles.card}>
                <div className={styles.projectCol}>
                  <div className={styles.projectName}>{item.project_title || "Заявка на сопровождение"}</div>
                  <div className={styles.metaRow}>{item.applicant_name || "Ученик"}</div>
                  {item.industry && <div className={styles.metaRow}>Отрасль: {item.industry}</div>}
                  {item.stage && <div className={styles.metaRow}>Стадия: {item.stage}</div>}
                  <div className={styles.metaRow}>
                    Заявка от {new Date(item.created_at).toLocaleDateString("ru-RU")}
                  </div>
                </div>
                <div className={styles.divider} />
                <div className={styles.requestCol}>
                  <div className={styles.requestLabel}>Запрос наставнику</div>
                  <div className={styles.requestText}>{item.mentor_request || "Не указан"}</div>
                </div>
                <div className={styles.actionCol}>
                  <button type="button" className={styles.openBtn} onClick={() => void open(item)}>
                    Открыть заявку
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <SidePanel
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.project.title || "Анкета проекта"}
        footer={
          detail && (
            <div className={styles.panelActions}>
              <button
                type="button"
                className={styles.rejectBtn}
                disabled={busy}
                onClick={() => void decide("reject")}
              >
                Отклонить
              </button>
              <button
                type="button"
                className={styles.acceptBtn}
                disabled={busy}
                onClick={() => void decide("accept")}
              >
                Принять заявку
              </button>
            </div>
          )
        }
      >
        {detail && (
          <div className={styles.briefList}>
            {(
              [
                ["Отрасль", detail.project.industry],
                ["Стадия", detail.project.stage],
                ["Аудитория", detail.project.audience],
                ["Проблема", detail.project.problem],
                ["Польза решения", detail.project.solution_benefit],
                ["Запрос наставнику", detail.project.mentor_request],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className={styles.briefItem}>
                <div className={styles.briefLabel}>{label}</div>
                <div className={styles.briefValue}>{value || "Не указано"}</div>
              </div>
            ))}
          </div>
        )}
      </SidePanel>
    </div>
  )
}

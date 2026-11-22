import { useState } from "react"
import UserIcon from "../../assets/icons/user.svg?react"
import GridIcon from "../../assets/icons/grid.svg?react"
import PinIcon from "../../assets/icons/pin.svg?react"
import SidePanel from "../../components/SidePanel/SidePanel"
import { useApp } from "../../contexts/AppContext"
import type { MentorRequest } from "../../data/mockData"
import styles from "./MentorRequestsPage.module.css"

// Показывает поступающие наставнику заявки и открывает полную анкету в выезжающей панели.
export default function MentorRequestsPage() {
  const { mentorRequests, decideMentorRequest } = useApp()

  // Хранит заявку, открытую в выезжающей панели просмотра полной анкеты.
  const [activeRequest, setActiveRequest] = useState<MentorRequest | null>(null)

  const pendingRequests = mentorRequests.filter((req) => req.status === "pending")

  // Принимает или отклоняет заявку и закрывает панель анкеты.
  function handleDecision(decision: "accepted" | "rejected") {
    if (!activeRequest) return
    decideMentorRequest(activeRequest.id, decision)
    setActiveRequest(null)
  }

  return (
    <div className={styles.page}>
      <div className={styles.stickyTop}>
        <div className={styles.title} role="heading" aria-level={1}>
          ЗАЯВКИ НА СОПРОВОЖДЕНИЕ
        </div>
      </div>

      <div className={styles.scrollArea}>
        {pendingRequests.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>Новых заявок пока нет</div>
            <div className={styles.emptyDesc}>
              Все поступившие обращения рассмотрены. Принятые проекты находятся в разделе «Мои проекты».
            </div>
          </div>
        ) : (
          <div className={styles.list}>
            {pendingRequests.map((request) => (
              <div key={request.id} className={styles.card}>
                <div className={styles.projectCol}>
                  <div className={styles.projectName}>{request.projectName}</div>
                  <div className={styles.metaRow}>
                    <UserIcon className={styles.metaIcon} aria-hidden="true" />
                    <span>{request.authorName}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <GridIcon className={styles.metaIcon} aria-hidden="true" />
                    <span>{request.industry}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <PinIcon className={styles.metaIcon} aria-hidden="true" />
                    <span>{request.stage}</span>
                  </div>
                </div>

                <div className={styles.divider} />

                <div className={styles.requestCol}>
                  <div className={styles.requestLabel}>ЗАПРОС НАСТАВНИКУ</div>
                  <div className={styles.requestText}>{request.requestText}</div>
                </div>

                <div className={styles.actionCol}>
                  <button
                    type="button"
                    className={styles.openBtn}
                    onClick={() => setActiveRequest(request)}
                  >
                    Открыть анкету
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SidePanel
        open={activeRequest !== null}
        title={activeRequest?.projectName}
        subtitle={
          activeRequest
            ? `${activeRequest.authorName} · ${activeRequest.industry} · ${activeRequest.stage}`
            : undefined
        }
        onClose={() => setActiveRequest(null)}
        footer={
          <div className={styles.panelActions}>
            <button
              type="button"
              className={styles.rejectBtn}
              onClick={() => handleDecision("rejected")}
            >
              Отклонить
            </button>
            <button
              type="button"
              className={styles.acceptBtn}
              onClick={() => handleDecision("accepted")}
            >
              Принять заявку
            </button>
          </div>
        }
      >
        {activeRequest && (
          <div className={styles.briefList}>
            <div className={styles.briefItem}>
              <div className={styles.briefLabel}>Целевая аудитория</div>
              <div className={styles.briefValue}>{activeRequest.brief.audience}</div>
            </div>
            <div className={styles.briefItem}>
              <div className={styles.briefLabel}>Время в неделю</div>
              <div className={styles.briefValue}>{activeRequest.brief.weeklyHours}</div>
            </div>
            <div className={styles.briefItem}>
              <div className={styles.briefLabel}>Проблема</div>
              <div className={styles.briefValue}>{activeRequest.brief.problem}</div>
            </div>
            <div className={styles.briefItem}>
              <div className={styles.briefLabel}>Польза решения</div>
              <div className={styles.briefValue}>{activeRequest.brief.value}</div>
            </div>
            <div className={styles.briefItem}>
              <div className={styles.briefLabel}>Что уже сделано</div>
              <div className={styles.briefValue}>{activeRequest.brief.doneSoFar}</div>
            </div>
            <div className={styles.briefItem}>
              <div className={styles.briefLabel}>Запрос наставнику</div>
              <div className={styles.briefValue}>{activeRequest.brief.mentorRequest}</div>
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  )
}

import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { motion, useReducedMotion } from "motion/react"
import { ResourceError } from "../../components/AsyncState/AsyncState"
import AiActivity from "../../components/AsyncState/AiActivity"
import CustomSelect from "../../components/CustomSelect/CustomSelect"
import { createRequestId, errorMessage } from "../../api/client"
import { useApp } from "../../contexts/AppContext"
import { useToast } from "../../contexts/ToastContext"
import { useCachedTrack, useLearningCache } from "../../contexts/LearningCacheContext"
import { useIsMobile } from "../../hooks/useIsMobile"
import useDraftAutosave from "../../hooks/useDraftAutosave"
import {
  completeLearningStep,
  requestLearningHelp,
  saveLearningDraft,
  submitLearningAnswer,
  type LearningAnswer,
  type LearningStep,
  type TrackStep,
} from "../../api/learning"
import ChevronLeftIcon from "../../assets/icons/chevron-left.svg?react"
import ArrowRightIcon from "../../assets/icons/arrow-right.svg?react"
import BookIcon from "../../assets/icons/book.svg?react"
import PlayIcon from "../../assets/icons/play.svg?react"
import PencilIcon from "../../assets/icons/pencil.svg?react"
import FlagIcon from "../../assets/icons/flag.svg?react"
import CheckIcon from "../../assets/icons/check.svg?react"
import AlertCircleIcon from "../../assets/icons/alert-circle.svg?react"
import LightbulbIcon from "../../assets/icons/lightbulb.svg?react"
import LockIcon from "../../assets/icons/lock.svg?react"
import LessonMaterial from "./LessonMaterial"
import buttonStyles from "../../styles/ButtonContent.module.css"
import styles from "./TrackLessonPage.module.css"

const stepIcons: Record<TrackStep["type"], typeof BookIcon> = {
  theory: BookIcon,
  video: PlayIcon,
  choice: PencilIcon,
  matching: PencilIcon,
  written: PencilIcon,
  final: FlagIcon,
}
const lockedStepMessage = "Сначала завершите предыдущий обязательный шаг"

// Доступны зачтённые и следующие обязательные шаги.
function canOpenStep(step: TrackStep) {
  return step.credited || step.can_credit
}

// Оставляет навигацию на месте и загружает содержимое трека целиком.
export default function TrackLessonPage() {
  const { trackId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isMobile = useIsMobile(768)
  const { tracks } = useLearningCache()
  const resource = useCachedTrack(trackId)
  const track = resource.data?.track
  const title = track?.title ?? tracks.data?.find((item) => item.id === trackId)?.title
  const requestedId = searchParams.get("step") ?? track?.current_step_id
  const requested = track?.steps.find((step) => step.id === requestedId)
  const requestedIsLocked = Boolean(requested && !canOpenStep(requested))
  const selectedId = requestedIsLocked ? track?.next_required_step_id : requestedId
  const selected = resource.data?.lessons.find((step) => step.id === selectedId && canOpenStep(step))
  // Прокручивает только панель урока при смене шага.
  const scrollBody = useRef<HTMLDivElement>(null)
  const stepsNav = useRef<HTMLDivElement>(null)
  // Предупреждение относится только к попытке нажать на закрытый шаг.
  const dismissLockNotice = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    scrollBody.current?.scrollTo({ top: 0 })
    if (isMobile) window.scrollTo({ top: 0 })
    const active = stepsNav.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    const nav = stepsNav.current
    if (active && nav) {
      const buttonBox = active.getBoundingClientRect()
      const navBox = nav.getBoundingClientRect()
      if (buttonBox.left < navBox.left || buttonBox.right > navBox.right) {
        nav.scrollLeft += buttonBox.left - navBox.left - (nav.clientWidth - buttonBox.width) / 2
      }
    }
  }, [selectedId, track?.id, isMobile])

  useEffect(() => {
    if (selected && (requestedIsLocked || !searchParams.has("step"))) {
      setSearchParams({ step: selected.id }, { replace: true })
    }
  }, [selected?.id, requestedIsLocked, searchParams, setSearchParams])

  useEffect(() => () => dismissLockNotice.current?.(), [])

  // Берёт первый доступный следующий шаг с учётом только что сохранённого зачёта.
  function advance(nextRequiredId?: string | null) {
    if (!selected || !track) return
    dismissLockNotice.current?.()
    const following = track.steps.find((step) => step.position > selected.position && (
      canOpenStep(step) || step.id === nextRequiredId
    ))
    const nextId = following?.id ?? nextRequiredId ?? track.next_required_step_id
    if (nextId && nextId !== selected.id) setSearchParams({ step: nextId })
    else navigate("/learning")
  }

  return (
    <div className={styles.page}>
      <div className={styles.fixedTop}>
        <Link to="/learning" className={styles.backLink}>
          <ChevronLeftIcon className={styles.backIcon} aria-hidden="true" />
          Все треки
        </Link>
        {title ? (
          <div className={styles.title} role="heading" aria-level={1}>
            {title.toUpperCase()}
          </div>
        ) : (
          resource.loading && (
            <div className={`${styles.placeholder} ${styles.titlePlaceholder}`} aria-hidden="true" />
          )
        )}
        {track && (
          <nav ref={stepsNav} className={styles.stepsNav} aria-label="Шаги трека">
            {track.steps.map((step) => {
              const locked = !canOpenStep(step)
              const Icon = stepIcons[step.type]
              const current = step.id === selectedId
              const credit =
                step.credit_source === "diagnostic"
                  ? " · Зачтено входным тестом"
                  : step.credited
                    ? " · Пройдено"
                    : ""

              return (
                <button
                  key={step.id}
                  type="button"
                  aria-pressed={current}
                  aria-label={`${step.position}. ${step.title}${locked ? " · Закрыто" : credit}`}
                  title={locked ? `${step.title}. ${lockedStepMessage}` : step.title}
                  className={`${styles.stepBtn} ${step.credited ? styles.stepBtnDone : ""} ${current ? styles.stepBtnActive : ""} ${locked ? styles.stepBtnLocked : ""}`}
                  onClick={() => {
                    if (locked) {
                      dismissLockNotice.current = showToast({ message: lockedStepMessage })
                    } else {
                      dismissLockNotice.current?.()
                      if (!current) setSearchParams({ step: step.id })
                    }
                  }}
                >
                  <Icon className={styles.stepIcon} aria-hidden="true" />
                  {step.credited && (
                    <span className={styles.doneBadge}>
                      <CheckIcon className={styles.doneBadgeIcon} aria-hidden="true" />
                    </span>
                  )}
                  {locked && <span className={styles.doneBadge}><LockIcon className={styles.doneBadgeIcon} aria-hidden="true" /></span>}
                </button>
              )
            })}
          </nav>
        )}
        {resource.loading && (
          <div className={styles.stepsNav} aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className={`${styles.stepBtn} ${styles.placeholder}`} />
            ))}
          </div>
        )}
      </div>
      <div className={styles.scrollBody} ref={scrollBody}>
        {resource.loading ? (
          <div className={styles.card} role="status" aria-label="Загружаем материалы трека">
            <div className={`${styles.placeholder} ${styles.badgePlaceholder}`} />
            <div className={`${styles.placeholder} ${styles.headingPlaceholder}`} />
            <div className={`${styles.placeholder} ${styles.linePlaceholder}`} />
            <div className={`${styles.placeholder} ${styles.mediaPlaceholder}`} />
            <div className={`${styles.placeholder} ${styles.linePlaceholder}`} />
          </div>
        ) : selected ? (
          <LessonCard
            key={selected.id}
            step={selected}
            advance={advance}
            onReplay={(behavior) => {
              if (isMobile) scrollBody.current?.scrollIntoView({ behavior, block: "start" })
              else scrollBody.current?.scrollTo({ top: 0, behavior })
            }}
          />
        ) : resource.error ? (
          <ResourceError message={resource.error} retry={resource.reload} />
        ) : (
          <div className={styles.card}>Шаг не найден в этом треке.</div>
        )}
      </div>
    </div>
  )
}

// Обрабатывает черновик, подсказку и зачёт конкретного шага.
function LessonCard({ step, advance, onReplay }: {
  step: LearningStep
  advance: (nextRequiredId?: string | null) => void
  onReplay: (behavior: ScrollBehavior) => void
}) {
  const { session } = useApp()
  const { showToast } = useToast()
  const { updateStep, updateDraft, updateProgress } = useLearningCache()
  const reducedMotion = useReducedMotion()
  const written = step.type === "written" || step.type === "final"
  const material = step.type === "theory" || step.type === "video"
  const lastAttempt = step.last_attempt
  // Ввод, состояние проверки и подсказка относятся только к выбранному шагу.
  const [answer, setAnswer] = useState<LearningAnswer>(step.draft ?? step.last_attempt?.answer ?? "")
  const [retaking, setRetaking] = useState(step.credited && step.draft !== null)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState("")
  const [hintBusy, setHintBusy] = useState(false)
  const [hintError, setHintError] = useState("")
  const [checkError, setCheckError] = useState("")
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [replayCount, setReplayCount] = useState(0)
  // Уход со страницы не должен переводить пользователя на соседний шаг после позднего ответа.
  const mounted = useRef(false)
  const completing = useRef(false)
  const autosave = useDraftAutosave()
  const editable = !step.credited || retaking
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const videoAvailable = !videoFailed && step.blocks.some((block) => block.type === "video" && block.url)
  const hasAnswer =
    typeof answer === "string"
      ? Boolean(answer.trim())
      : Boolean(step.options?.left?.length && step.options.left.every((item) => answer[item.id]))

  // Сохраняет выбранный ответ и оставляет введённый текст при сбое сети.
  function saveDraft(next: LearningAnswer | null) {
    if (!editable || busy) return
    setAnswer(next ?? "")
    setCheckError("")
    const savedAt = Date.now()
    autosave.schedule(async () => {
      const saved = await saveLearningDraft(step.id, next, savedAt)
      updateDraft(step.track_id, step.id, saved.draft, savedAt)
    })
  }

  // Привязывает повтор запроса к ответу и текущей учётной записи.
  async function checkAnswer() {
    if ((!step.can_credit && !retaking) || !hasAnswer || busy) return
    setBusy(true)
    setCheckError("")
    const storageKey = `learning-request:${session.profile?.id}:${step.id}`
    const serialized = JSON.stringify(answer)
    const existing = sessionStorage.getItem(storageKey)
    const requestId =
      existing && serialized === sessionStorage.getItem(`${storageKey}:answer`)
        ? existing
        : `${step.id}:${createRequestId()}`
    sessionStorage.setItem(storageKey, requestId)
    sessionStorage.setItem(`${storageKey}:answer`, serialized)
    try {
      const { attempt, progress } = await submitLearningAnswer(step.id, answer, requestId, Date.now())
      autosave.cancel()
      updateStep({
        ...step,
        last_attempt: attempt,
        draft: null,
        credited: Boolean(attempt.accepted || step.credited),
        credit_source: attempt.accepted ? "earned" : step.credit_source,
      })
      updateProgress(progress)
      if (step.credited || attempt.accepted) setRetaking(false)
      sessionStorage.removeItem(storageKey)
      sessionStorage.removeItem(`${storageKey}:answer`)
    } catch (error) {
      setCheckError(errorMessage(error, "Не удалось проверить ответ. Попробуйте ещё раз"))
    } finally {
      setBusy(false)
    }
  }

  // Засчитывает материал и применяет серверный прогресс для следующих шагов.
  async function finishMaterial(event: "text_end" | "video_end") {
    if (completing.current || step.credited || !step.can_credit) return
    completing.current = true
    setBusy(true)
    try {
      const progress = await completeLearningStep(step.id, event)
      updateStep({ ...step, credited: true, can_credit: false, credit_source: "earned" })
      updateProgress(progress)
      if (mounted.current) advance(progress.tracks.find((track) => track.track_id === step.track_id)?.next_required_step_id)
    } catch (error) {
      if (mounted.current)
        showToast({ message: errorMessage(error, "Не удалось отметить шаг"), type: "error" })
    } finally {
      completing.current = false
      setBusy(false)
    }
  }

  // Запрашивает подсказку по открытому заданию и текущему ответу.
  async function askHelp() {
    if (!written || hintBusy) return
    setHintBusy(true)
    setHintError("")
    try {
      const result = await requestLearningHelp(
        step.id,
        "Дай подсказку, с чего начать это задание.",
        typeof answer === "string" ? answer : "",
      )
      setHint(result.hint)
    } catch (error) {
      setHintError(errorMessage(error, "Не удалось получить подсказку"))
    } finally {
      setHintBusy(false)
    }
  }

  return (
    <motion.section
      className={styles.card}
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.18 }}
    >
      <div className={styles.badgePill}>
        {step.type === "theory" ? "Теория" : step.type === "video" ? "Видеолекция" : "Практика"}
      </div>
      <div className={styles.sectionTitle} role="heading" aria-level={2}>
        {step.title}
      </div>
      {step.credit_source === "diagnostic" && (
        <div className={styles.draftSaved}>
          <CheckIcon className={styles.draftCheckIcon} aria-hidden="true" /> Зачтено по входному тесту. Можно
          пройти самостоятельно.
        </div>
      )}
      {step.blocks.map((block, index) => (
        <LessonMaterial
          key={`${index}-${replayCount}`}
          block={block}
          onVideoEnded={() => setVideoReady(true)}
          onVideoError={() => setVideoFailed(true)}
          onVideoOpenedExternally={() => setVideoReady(true)}
          onVideoHalfway={() => setVideoReady(true)}
        />
      ))}
      {!material && (
        <div className={styles.practiceContent}>
          {step.prompt && <div className={styles.practicePrompt}>{step.prompt}</div>}
          {written && (
            <textarea
              className={styles.textarea}
              aria-label="Ваш ответ"
              value={typeof answer === "string" ? answer : ""}
              readOnly={!editable || busy}
              onChange={(event) => saveDraft(event.target.value)}
            />
          )}
          {step.type === "choice" && (
            <div className={styles.optionsList} role="group" aria-label="Варианты ответа">
              {step.options?.choices?.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={styles.optionBtn}
                  disabled={!editable || busy}
                  aria-pressed={answer === option.id}
                  onClick={() => saveDraft(option.id)}
                >
                  <span className={styles.choiceMark} aria-hidden="true" />
                  {option.text}
                </button>
              ))}
            </div>
          )}
          {step.type === "matching" && step.options?.left && step.options.right && (
            <div className={styles.optionsList}>
              {step.options.left.map((item) => (
                <CustomSelect
                  key={item.id}
                  label={item.text}
                  placeholder="Выберите соответствие"
                  value={typeof answer === "object" ? (answer[item.id] ?? "") : ""}
                  options={
                    step.options?.right?.map((option) => ({ id: option.id, label: option.text })) ?? []
                  }
                  disabled={!editable || busy}
                  onChange={(value) => {
                    const next = { ...(typeof answer === "object" ? answer : {}) }
                    for (const key of Object.keys(next)) if (next[key] === value) delete next[key]
                    next[item.id] = value
                    saveDraft(next)
                  }}
                />
              ))}
            </div>
          )}
          <div className={styles.practiceToolbar}>
            {editable && (
              <div className={styles.practiceButtons}>
                <button
                  type="button"
                  data-practice-action
                  className={styles.outlineBtn}
                  disabled={(!step.can_credit && !retaking) || !hasAnswer || busy}
                  onClick={checkAnswer}
                >
                  Проверить
                </button>
                {written && (
                  <button
                    type="button"
                    data-practice-action
                    className={`${styles.outlineBtn} ${styles.helpBtn}`}
                    onClick={askHelp}
                    disabled={hintBusy}
                  >
                    <LightbulbIcon aria-hidden="true" />
                    {hintBusy ? "Готовим подсказку…" : "Помочь"}
                  </button>
                )}
              </div>
            )}
            {step.credited && !retaking && (
              <button
                type="button"
                className={styles.outlineBtn}
                disabled={busy}
                onClick={() => {
                  setRetaking(true)
                  setAnswer(step.draft ?? "")
                  setCheckError("")
                }}
              >
                Перепройти
              </button>
            )}
            <button
              type="button"
              className={`${styles.continueBtn} ${buttonStyles.withIcon}`}
              disabled={!step.credited || busy}
              onClick={() => advance()}
            >
              Продолжить
              <ArrowRightIcon aria-hidden="true" />
            </button>
          </div>
          {busy && (
            <AiActivity
              status="checking"
              compact
              message={written ? "ИИ проверяет ответ" : "Проверяем ответ"}
            />
          )}
          {checkError && <AiActivity status="check_unavailable" compact message={checkError} />}
          {lastAttempt && lastAttempt.accepted !== null && !retaking && (
            <div className={`${styles.aiSuccessBox} ${lastAttempt.accepted ? "" : styles.answerIncorrect}`} role="status">
              {lastAttempt.accepted ? <CheckIcon className={styles.aiSuccessIcon} aria-hidden="true" /> : <AlertCircleIcon className={styles.aiSuccessIcon} aria-hidden="true" />}
              {lastAttempt.accepted ? "Ответ верный" : "Ответ неверный"}
              {step.credited && " · Зачёт сохранён"}
            </div>
          )}
          {lastAttempt && !retaking && lastAttempt.remarks.length > 0 ? (
            <div className={`${styles.aiBox} ${lastAttempt.accepted ? styles.answerCorrect : ""}`}>
              <div className={styles.aiTitle}>
                {lastAttempt.accepted
                  ? "Комментарий к ответу"
                  : written
                    ? "Проверка ИИ"
                    : "Результат проверки"}
              </div>
              <div className={styles.aiList}>
                {lastAttempt.remarks.map((remark) => (
                  <div key={remark} className={styles.aiRow}>
                    {lastAttempt.accepted ? <CheckIcon className={styles.aiIcon} aria-hidden="true" /> : <AlertCircleIcon className={styles.aiIcon} aria-hidden="true" />}
                    {remark}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !retaking && !step.credited && lastAttempt?.accepted === false && (
              <div className={styles.aiBox}>
                Ответ пока не зачтён. Проверьте условия задания и попробуйте снова.
              </div>
            )
          )}
          {hintError && <AiActivity status="check_unavailable" compact message={hintError} />}
          {hint && (
            <div className={styles.aiBox}>
              <div className={styles.aiTitle}>Подсказка</div>
              {hint}
            </div>
          )}
          {!step.credited && lastAttempt?.accepted === false && (
            <div className={styles.continueHint}>Исправьте ответ и повторите проверку.</div>
          )}
        </div>
      )}
      {step.type === "video" && !videoAvailable && (
        <div className={styles.continueHint}>Видео пока недоступно.</div>
      )}
      {material && (
        <div className={`${styles.actionsEnd} ${step.credited ? styles.materialActionsReplay : ""}`}>
          {step.credited && (
            <button
              type="button"
              className={styles.outlineBtn}
              onClick={() => {
                if (step.type === "video") {
                  setReplayCount((count) => count + 1)
                  setVideoReady(false)
                  setVideoFailed(false)
                }
                onReplay(reducedMotion ? "instant" : "smooth")
              }}
            >
              Перепройти
            </button>
          )}
          <button
            type="button"
            className={`${styles.primaryBtn} ${buttonStyles.withIcon}`}
            disabled={
              busy ||
              (!step.credited &&
                (!step.can_credit || (step.type === "video" && !videoReady)))
            }
            onClick={() => {
              if (step.credited) advance()
              else void finishMaterial(step.type === "theory" ? "text_end" : "video_end")
            }}
          >
            Продолжить
            <ArrowRightIcon aria-hidden="true" />
          </button>
        </div>
      )}
    </motion.section>
  )
}

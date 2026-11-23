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
import BookIcon from "../../assets/icons/book.svg?react"
import PlayIcon from "../../assets/icons/play.svg?react"
import PencilIcon from "../../assets/icons/pencil.svg?react"
import FlagIcon from "../../assets/icons/flag.svg?react"
import CheckIcon from "../../assets/icons/check.svg?react"
import AlertCircleIcon from "../../assets/icons/alert-circle.svg?react"
import LightbulbIcon from "../../assets/icons/lightbulb.svg?react"
import LockIcon from "../../assets/icons/lock.svg?react"
import LessonMaterial from "./LessonMaterial"
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

// Зачтённый шаг можно открыть повторно, даже если он уже не принимает ответ.
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
  // Прямой переход обрабатывается один раз, пока заменяется адрес страницы.
  const redirectedFrom = useRef<string | undefined>(undefined)

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
    if (!requestedIsLocked) redirectedFrom.current = undefined
    if (!selected) return
    if (requestedIsLocked) {
      if (redirectedFrom.current === requestedId) return
      redirectedFrom.current = requestedId
      if (searchParams.has("step")) showToast({ message: lockedStepMessage })
    }
    if (requestedIsLocked || !searchParams.has("step")) setSearchParams({ step: selected.id }, { replace: true })
  }, [selected?.id, requestedId, requestedIsLocked, searchParams, setSearchParams, showToast])

  // Берёт первый доступный следующий шаг с учётом только что сохранённого зачёта.
  function advance(nextRequiredId?: string | null) {
    if (!selected || !track) return
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
              const Icon = locked ? LockIcon : stepIcons[step.type]
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
                    if (locked) showToast({ message: lockedStepMessage })
                    else if (!current) setSearchParams({ step: step.id })
                  }}
                >
                  <Icon className={styles.stepIcon} aria-hidden="true" />
                  {step.credited && (
                    <span className={styles.doneBadge}>
                      <CheckIcon className={styles.doneBadgeIcon} aria-hidden="true" />
                    </span>
                  )}
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
          <LessonCard key={selected.id} step={selected} advance={advance} />
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
function LessonCard({ step, advance }: { step: LearningStep, advance: (nextRequiredId?: string | null) => void }) {
  const { session } = useApp()
  const { showToast } = useToast()
  const { updateStep, updateProgress } = useLearningCache()
  const reducedMotion = useReducedMotion()
  const written = step.type === "written" || step.type === "final"
  const material = step.type === "theory" || step.type === "video"
  const editable = step.credit_source !== "earned"
  // Ввод, состояние проверки и подсказка относятся только к выбранному шагу.
  const [answer, setAnswer] = useState<LearningAnswer>(step.draft ?? step.last_attempt?.answer ?? "")
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState("")
  const [hintBusy, setHintBusy] = useState(false)
  const [hintError, setHintError] = useState("")
  const [checkError, setCheckError] = useState("")
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoEnded, setVideoEnded] = useState(false)
  const [videoOpenedExternally, setVideoOpenedExternally] = useState(false)
  // Уход со страницы не должен переводить пользователя на соседний шаг после позднего ответа.
  const mounted = useRef(false)
  const completing = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const videoAvailable = !videoFailed && step.blocks.some((block) => block.type === "video" && block.url)
  const saved = step.draft !== null && JSON.stringify(step.draft) === JSON.stringify(answer)
  const hasAnswer =
    typeof answer === "string"
      ? Boolean(answer.trim())
      : Boolean(step.options?.left?.length && step.options.left.every((item) => answer[item.id]))

  // Сохраняет выбранный ответ и оставляет введённый текст при сбое сети.
  async function saveDraft(next: LearningAnswer | null) {
    if (!editable || busy || saving) return
    setAnswer(next ?? "")
    setCheckError("")
    setSaving(true)
    try {
      updateStep(await saveLearningDraft(step.id, next))
    } catch (error) {
      if (mounted.current)
        showToast({ message: errorMessage(error, "Не удалось сохранить черновик"), type: "error" })
    } finally {
      setSaving(false)
    }
  }

  // Привязывает повтор запроса к ответу и текущей учётной записи.
  async function checkAnswer() {
    if (!step.can_credit || !hasAnswer || saving || busy) return
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
      const { attempt, progress } = await submitLearningAnswer(step.id, answer, requestId)
      updateStep({
        ...step,
        last_attempt: attempt,
        draft: attempt.accepted ? null : step.draft,
        credited: Boolean(attempt.accepted || step.credited),
        credit_source: attempt.accepted ? "earned" : step.credit_source,
      })
      updateProgress(progress)
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
          key={index}
          block={block}
          onVideoEnded={() => {
            setVideoEnded(true)
            void finishMaterial("video_end")
          }}
          onVideoError={() => setVideoFailed(true)}
          onVideoOpenedExternally={() => setVideoOpenedExternally(true)}
        />
      ))}
      {step.prompt && (
        <div className={styles.practiceContent}>
          <div className={styles.practicePrompt}>{step.prompt}</div>
          {written && (
            <textarea
              className={styles.textarea}
              aria-label="Ваш ответ"
              value={typeof answer === "string" ? answer : ""}
              readOnly={!editable || busy || saving}
              onChange={(event) => setAnswer(event.target.value)}
              onBlur={(event) => {
                if (!saved && hasAnswer && !event.relatedTarget?.closest("[data-practice-action]"))
                  void saveDraft(answer)
              }}
            />
          )}
          {step.type === "choice" && (
            <div className={styles.optionsList} role="group" aria-label="Варианты ответа">
              {step.options?.choices?.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={styles.optionBtn}
                  disabled={!editable || busy || saving}
                  aria-pressed={answer === option.id}
                  onClick={() => void saveDraft(option.id)}
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
                  disabled={!editable || busy || saving}
                  onChange={(value) => {
                    const next = { ...(typeof answer === "object" ? answer : {}) }
                    for (const key of Object.keys(next)) if (next[key] === value) delete next[key]
                    next[item.id] = value
                    void saveDraft(next)
                  }}
                />
              ))}
            </div>
          )}
          <div className={styles.practiceToolbar}>
            <div className={styles.draftSaved} aria-live="polite">
              {saved && (
                <>
                  <CheckIcon className={styles.draftCheckIcon} aria-hidden="true" />
                  Черновик сохранён
                </>
              )}
              {saving && "Сохраняем черновик…"}
            </div>
            <div className={styles.practiceButtons}>
              {written && editable && (
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
              {editable && (
                <button
                  type="button"
                  data-practice-action
                  className={styles.primaryBtn}
                  disabled={!step.can_credit || !hasAnswer || busy || saving}
                  onClick={checkAnswer}
                >
                  {checkError || step.last_attempt?.accepted === false
                    ? "Проверить снова"
                    : "Отправить на проверку"}
                </button>
              )}
            </div>
          </div>
          {busy && (
            <AiActivity
              status="checking"
              compact
              message={written ? "ИИ проверяет ответ" : "Проверяем ответ"}
            />
          )}
          {checkError && <AiActivity status="check_unavailable" compact message={checkError} />}
          {step.last_attempt?.accepted && (
            <div className={styles.aiSuccessBox} role="status">
              <CheckIcon className={styles.aiSuccessIcon} aria-hidden="true" />
              Ответ принят
            </div>
          )}
          {step.last_attempt?.remarks.length ? (
            <div className={styles.aiBox}>
              <div className={styles.aiTitle}>
                {step.last_attempt.accepted
                  ? "Комментарий к ответу"
                  : written
                    ? "Проверка ИИ"
                    : "Результат проверки"}
              </div>
              <div className={styles.aiList}>
                {step.last_attempt.remarks.map((remark) => (
                  <div key={remark} className={styles.aiRow}>
                    <AlertCircleIcon className={styles.aiIcon} aria-hidden="true" />
                    {remark}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            step.last_attempt?.accepted === false && (
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
        </div>
      )}
      {step.type === "video" && !videoAvailable && (
        <div className={styles.continueHint}>Видео пока недоступно.</div>
      )}
      {material ? (
        <div className={styles.actionsEnd}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={
              busy ||
              (!step.credited &&
                (!step.can_credit ||
                  (step.type === "video" && !videoAvailable && !videoOpenedExternally && !videoEnded)))
            }
            onClick={() => {
              if (step.credited) advance()
              else if (step.type === "theory") void finishMaterial("text_end")
              else if (videoOpenedExternally || videoEnded) void finishMaterial("video_end")
              else showToast({ message: "Посмотрите видео до конца, чтобы завершить шаг" })
            }}
          >
            {step.type === "video" && videoOpenedExternally && !step.credited && !videoEnded
              ? "Я посмотрел видео"
              : "Далее"}
          </button>
        </div>
      ) : (
        <div className={styles.continueRow}>
          <button
            type="button"
            className={styles.continueBtn}
            disabled={!step.credited || busy}
            onClick={() => advance()}
          >
            Продолжить
          </button>
          {!step.credited && step.last_attempt?.accepted === false && (
            <div className={styles.continueHint}>Исправьте ответ и повторите проверку.</div>
          )}
        </div>
      )}
    </motion.section>
  )
}

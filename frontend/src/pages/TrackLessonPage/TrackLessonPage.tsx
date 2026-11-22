import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { motion } from "motion/react"
import StageTabs from "../../components/StageTabs/StageTabs"
import ChevronLeftIcon from "../../assets/icons/chevron-left.svg?react"
import ChevronDownIcon from "../../assets/icons/chevron-down.svg?react"
import BookIcon from "../../assets/icons/book.svg?react"
import PlayIcon from "../../assets/icons/play.svg?react"
import PencilIcon from "../../assets/icons/pencil.svg?react"
import FlagIcon from "../../assets/icons/flag.svg?react"
import CheckIcon from "../../assets/icons/check.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import UsersIcon from "../../assets/icons/users.svg?react"
import FileTextIcon from "../../assets/icons/file-text.svg?react"
import AlertCircleIcon from "../../assets/icons/alert-circle.svg?react"
import ArrowRightIcon from "../../assets/icons/arrow-right.svg?react"
import MaximizeIcon from "../../assets/icons/maximize.svg?react"
import { useApp } from "../../contexts/AppContext"
import type { TrackStep } from "../../data/mockData"
import styles from "./TrackLessonPage.module.css"

// Собирает учебный трек: навигацию по шагам, теорию, видеолекцию и практику с ИИ-проверкой.
export default function TrackLessonPage() {
  const { trackId } = useParams()
  const navigate = useNavigate()
  const { tracks, completeTrackStep } = useApp()

  const track = tracks.find((item) => item.id === trackId) ?? tracks[0]

  // Управляет активным шагом, раскрытием расшифровки, плеером и черновиком практики.
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoProgress, setVideoProgress] = useState(18)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [checkedSteps, setCheckedSteps] = useState<Record<string, { passed: boolean, hints: string[] }>>({
    "idea-7": {
      passed: false,
      hints: [
        "Уточните конкретную группу клиентов.",
        "Опишите проблему, которую решаете.",
        "Объясните пользу по сравнению с альтернативами.",
      ],
    },
  })

  const currentStep = track.steps[activeStepIndex] ?? track.steps[0]
  const currentDraft = drafts[currentStep.id] ?? currentStep.defaultDraft ?? ""
  const currentCheck = checkedSteps[currentStep.id]

  // Возвращает иконку типа учебного шага для верхней навигации.
  function renderStepIcon(kind: TrackStep["kind"]) {
    if (kind === "theory") return <BookIcon className={styles.stepIcon} aria-hidden="true" />
    if (kind === "video") return <PlayIcon className={styles.stepIcon} aria-hidden="true" />
    if (kind === "practice") return <PencilIcon className={styles.stepIcon} aria-hidden="true" />
    return <FlagIcon className={styles.stepIcon} aria-hidden="true" />
  }

  // Переключает шаг трека и сбрасывает временные состояния плеера.
  function selectStep(index: number) {
    setActiveStepIndex(index)
    setTranscriptOpen(false)
    setVideoPlaying(false)
  }

  // Выполняет моковую проверку практического ответа по критериям ИИ.
  function runAiCheck() {
    const text = currentDraft.trim()
    const hints: string[] = []
    if (text.length < 40 || text.toLowerCase().includes("для всех")) {
      hints.push("Уточните конкретную группу клиентов.")
    }
    if (!/(проблем|очеред|время|сложн|меша|неудоб)/i.test(text)) {
      hints.push("Опишите проблему, которую решаете.")
    }
    if (!/(польз|быстр|предзаказ|дешев|удоб|лучше|альтернатив)/i.test(text)) {
      hints.push("Объясните пользу по сравнению с альтернативами.")
    }

    const passed = hints.length === 0
    setCheckedSteps((prev) => ({
      ...prev,
      [currentStep.id]: { passed, hints },
    }))
    if (passed) {
      completeTrackStep(track.id, currentStep.id)
    }
  }

  // Очищает поле ответа и сбрасывает старые замечания ИИ.
  function clearDraft() {
    setDrafts((prev) => ({ ...prev, [currentStep.id]: "" }))
    setCheckedSteps((prev) => ({
      ...prev,
      [currentStep.id]: { passed: false, hints: [] },
    }))
  }

  // Завершает текущий шаг и переходит к следующему или возвращается к трекам.
  function goNextStep() {
    completeTrackStep(track.id, currentStep.id)
    if (activeStepIndex < track.steps.length - 1) {
      selectStep(activeStepIndex + 1)
      return
    }
    navigate("/learning")
  }

  const canContinuePractice =
    currentStep.kind !== "practice" && currentStep.kind !== "final"
      ? true
      : Boolean(currentCheck?.passed || currentStep.completed)

  return (
    <div className={styles.page}>
      <StageTabs active="learning" />

      <Link to="/learning" className={styles.backLink}>
        <ChevronLeftIcon className={styles.backIcon} aria-hidden="true" />
        <span>Все треки</span>
      </Link>

      <div className={styles.title} role="heading" aria-level={1}>
        {track.title.toUpperCase()}
      </div>

      <div className={styles.stepsNav} role="tablist" aria-label="Шаги трека">
        {track.steps.map((step, index) => {
          const isActive = index === activeStepIndex
          const isDone = step.completed
          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              title={step.title}
              className={[
                styles.stepBtn,
                isDone ? styles.stepBtnDone : "",
                isActive ? styles.stepBtnActive : "",
              ].join(" ")}
              onClick={() => selectStep(index)}
            >
              {renderStepIcon(step.kind)}
              {isDone && (
                <span className={styles.doneBadge} aria-label="Выполнено">
                  <CheckIcon className={styles.doneBadgeIcon} aria-hidden="true" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <motion.div
        key={currentStep.id}
        className={styles.card}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className={styles.badgePill}>{currentStep.badge}</div>

        {currentStep.kind === "theory" && (
          <div className={styles.theoryContent}>
            <div className={styles.sectionTitle}>{currentStep.title}</div>
            <div className={styles.bodyText}>
              Целевая аудитория — группа людей, которые сталкиваются с похожей задачей в определённой ситуации. Формулировка «кофе для всех» слишком широкая: у студента между парами, офисного сотрудника утром и туриста на прогулке разные причины покупки. Для первой проверки выберите одну группу, до которой вы можете добраться и с которой сможете поговорить.
            </div>

            <div className={styles.lessonImageWrap}>
              <img
                src="/images/lessons/lesson-coffee.svg"
                alt="Очередь за кофе между парами"
                className={styles.lessonImage}
              />
            </div>

            <div className={styles.sectionTitle}>Как описать проблему</div>
            <div className={styles.bodyText}>
              Начните с ситуации, а не с продукта. Выясните, что человек пытается сделать, что ему мешает и как он справляется сейчас. Например, студент хочет купить кофе за десять минут между занятиями, но очередь занимает почти всю перемену. Проблема здесь — потеря времени. Кофейня, автомат и предзаказ — возможные способы её решения.
            </div>

            <div className={styles.flowRow}>
              <div className={`${styles.flowCard} ${styles.flowCardTint}`}>
                <UsersIcon className={styles.flowIconAccent} aria-hidden="true" />
                <div className={styles.flowTextCol}>
                  <div className={styles.flowTitleAccent}>Клиент</div>
                  <div className={styles.flowSubAccent}>Студент</div>
                </div>
              </div>

              <ArrowRightIcon className={styles.flowArrow} aria-hidden="true" />

              <div className={`${styles.flowCard} ${styles.flowCardSoft}`}>
                <FileTextIcon className={styles.flowIconInk} aria-hidden="true" />
                <div className={styles.flowTextCol}>
                  <div className={styles.flowTitleInk}>Ситуация</div>
                  <div className={styles.flowSubInk}>Перемена 10 минут</div>
                </div>
              </div>

              <ArrowRightIcon className={styles.flowArrow} aria-hidden="true" />

              <div className={`${styles.flowCard} ${styles.flowCardTint}`}>
                <AlertCircleIcon className={styles.flowIconAccent} aria-hidden="true" />
                <div className={styles.flowTextCol}>
                  <div className={styles.flowTitleAccent}>Проблема</div>
                  <div className={styles.flowSubAccent}>Очередь за кофе</div>
                </div>
              </div>
            </div>

            <div className={styles.sectionTitle}>Проверьте предположение</div>
            <div className={styles.bodyTextSmall}>
              Описание проблемы пока является гипотезой. Поговорите с представителями выбранной группы и попросите рассказать о последнем похожем случае. Где они покупали кофе? Сколько ждали? Что делали, когда очередь была длинной? Конкретный прошлый опыт полезнее обещания «я бы купил».
            </div>

            <div className={styles.compareRow}>
              <div className={styles.compareBad}>
                <CloseIcon className={styles.compareIconInk} aria-hidden="true" />
                <div className={styles.compareTextCol}>
                  <div className={styles.compareLabelInk}>Слишком широко:</div>
                  <div className={styles.compareDescInk}>все любители кофе</div>
                </div>
              </div>

              <div className={styles.compareGood}>
                <CheckIcon className={styles.compareIconAccent} aria-hidden="true" />
                <div className={styles.compareTextCol}>
                  <div className={styles.compareLabelAccent}>Конкретнее:</div>
                  <div className={styles.compareDescAccent}>студенты, покупающие кофе между парами</div>
                </div>
              </div>
            </div>

            <div className={styles.actionsEnd}>
              <button type="button" className={styles.primaryBtn} onClick={goNextStep}>
                Далее
              </button>
            </div>
          </div>
        )}

        {currentStep.kind === "video" && (
          <div className={styles.videoContent}>
            <div className={styles.sectionTitle}>{currentStep.title}</div>

            <div className={styles.playerBox}>
              <div className={styles.videoStage}>
                <img
                  src="/images/lessons/lesson-coffee.svg"
                  alt=""
                  className={styles.videoPoster}
                />
                <div className={styles.videoOverlay}>
                  <button
                    type="button"
                    className={styles.bigPlayBtn}
                    aria-label={videoPlaying ? "Поставить на паузу" : "Воспроизвести видео"}
                    onClick={() => setVideoPlaying((prev) => !prev)}
                  >
                    <PlayIcon className={styles.bigPlayIcon} aria-hidden="true" />
                  </button>
                  <div className={styles.videoStatusPill}>
                    {videoPlaying ? "Идёт воспроизведение (мок)" : "Нажмите для просмотра лекции"}
                  </div>
                </div>
              </div>

              <div className={styles.playerControls}>
                <button
                  type="button"
                  className={styles.controlBtn}
                  aria-label={videoPlaying ? "Пауза" : "Воспроизвести"}
                  onClick={() => setVideoPlaying((prev) => !prev)}
                >
                  <PlayIcon className={styles.controlIcon} aria-hidden="true" />
                </button>

                <span className={styles.timeText}>
                  {videoPlaying ? "01:08" : "0:00"} / {currentStep.duration ?? "06:12"}
                </span>

                <input
                  type="range"
                  min={0}
                  max={100}
                  value={videoProgress}
                  aria-label="Перемотка видео"
                  className={styles.seekBar}
                  onChange={(event) => setVideoProgress(Number(event.target.value))}
                />

                <button
                  type="button"
                  className={styles.controlBtn}
                  aria-label="Полноэкранный режим"
                  onClick={() => setVideoProgress((prev) => (prev >= 100 ? 0 : Math.min(100, prev + 15)))}
                >
                  <MaximizeIcon className={styles.controlIcon} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className={styles.transcriptBox}>
              <button
                type="button"
                className={styles.transcriptHeader}
                aria-expanded={transcriptOpen}
                onClick={() => setTranscriptOpen((prev) => !prev)}
              >
                <FileTextIcon className={styles.transcriptIcon} aria-hidden="true" />
                <span className={styles.transcriptTitle}>Расшифровка лекции</span>
                <ChevronDownIcon
                  className={`${styles.transcriptChevron} ${transcriptOpen ? styles.transcriptChevronOpen : ""}`}
                  aria-hidden="true"
                />
              </button>
              {transcriptOpen && (
                <div className={styles.transcriptBody}>
                  {currentStep.transcript}
                </div>
              )}
            </div>

            <div className={styles.actionsEnd}>
              <button type="button" className={styles.primaryBtn} onClick={goNextStep}>
                Далее
              </button>
            </div>
          </div>
        )}

        {(currentStep.kind === "practice" || currentStep.kind === "final") && (
          <div className={styles.practiceContent}>
            <div className={styles.sectionTitle}>{currentStep.title}</div>

            <label className={styles.practiceField} htmlFor={`practice-${currentStep.id}`}>
              <span className={styles.practicePrompt}>{currentStep.prompt}</span>
              <textarea
                id={`practice-${currentStep.id}`}
                rows={4}
                className={styles.textarea}
                value={currentDraft}
                placeholder="Опишите целевую аудиторию, проблему и пользу вашего решения..."
                onChange={(event) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [currentStep.id]: event.target.value,
                  }))
                }
              />
            </label>

            <div className={styles.practiceToolbar}>
              <div className={styles.draftSaved}>
                <CheckIcon className={styles.draftCheckIcon} aria-hidden="true" />
                <span>Черновик сохранён</span>
              </div>

              <div className={styles.practiceButtons}>
                <button type="button" className={styles.outlineBtn} onClick={clearDraft}>
                  Очистить
                </button>
                <button type="button" className={styles.primaryBtn} onClick={runAiCheck}>
                  Проверить снова
                </button>
              </div>
            </div>

            {currentCheck && currentCheck.hints.length > 0 && (
              <div className={styles.aiBox}>
                <div className={styles.aiTitle}>Проверка ИИ</div>
                <div className={styles.aiList}>
                  {currentCheck.hints.map((hint) => (
                    <div key={hint} className={styles.aiRow}>
                      <AlertCircleIcon className={styles.aiIcon} aria-hidden="true" />
                      <span>{hint}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentCheck?.passed && (
              <div className={styles.aiSuccessBox}>
                <CheckIcon className={styles.aiSuccessIcon} aria-hidden="true" />
                <span>Отлично! Ответ соответствует всем критериям. Можно переходить к следующему шагу.</span>
              </div>
            )}

            <div className={styles.continueRow}>
              <button
                type="button"
                className={styles.continueBtn}
                disabled={!canContinuePractice}
                onClick={goNextStep}
              >
                {activeStepIndex === track.steps.length - 1 ? "Завершить трек" : "Продолжить"}
              </button>

              {!canContinuePractice && (
                <div className={styles.continueHint}>
                  <AlertCircleIcon className={styles.continueHintIcon} aria-hidden="true" />
                  <span>Исправьте ответ и повторите проверку.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

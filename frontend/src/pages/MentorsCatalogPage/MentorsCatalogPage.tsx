import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import SearchIcon from "../../assets/icons/search.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import CustomSelect from "../../components/CustomSelect/CustomSelect"
import SidePanel from "../../components/SidePanel/SidePanel"
import MentorDetailsContent from "../../components/MentorDetailsContent/MentorDetailsContent"
import { EmptyState, ResourceError } from "../../components/AsyncState/AsyncState"
import { useIsMobile } from "../../hooks/useIsMobile"
import useResource from "../../hooks/useResource"
import { errorMessage } from "../../api/client"
import { searchMentors, type MentorOut } from "../../api/projects"
import { industryLabels } from "../../components/MentorDetailsContent/mentorLabels"
import styles from "./MentorsCatalogPage.module.css"

const industries = [
  { id: "all", label: "Все отрасли" },
  ...Object.entries(industryLabels).map(([id, label]) => ({ id, label })),
]
const panelHint = "Отправить заявку наставнику можно из анкеты в разделе «Мои проекты»."

// Показывает каталог, поиск и профиль наставника в исходной раскладке.
export default function MentorsCatalogPage() {
  const isMobile = useIsMobile(768)
  const compactPanel = useIsMobile(1150)
  const reducedMotion = useReducedMotion()
  // Ввод и готовый поисковый запрос разделены паузой в 200 мс.
  const [query, setQuery] = useState("")
  const [term, setTerm] = useState("")
  const [industry, setIndustry] = useState("all")
  const [activeMentor, setActiveMentor] = useState<MentorOut | null>(null)
  // Нижняя загрузка сохраняет уже показанные карточки при сбое.
  const [loadingMore, setLoadingMore] = useState(false)
  const [pageError, setPageError] = useState("")
  const scrollArea = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  const closePanel = useRef<HTMLButtonElement>(null)
  const openedBy = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(query.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [query])

  const filter = JSON.stringify([term, industry])
  const params = { q: term, industry: industry === "all" ? "" : industry }
  const results = useResource(filter, (signal) => searchMentors({ ...params, offset: 0 }, signal))
  const nextOffset = results.data?.next_offset

  useEffect(() => {
    scrollArea.current?.scrollTo({ top: 0 })
    setActiveMentor(null)
    setLoadingMore(false)
    setPageError("")
  }, [filter])

  useEffect(() => {
    const root = scrollArea.current
    const target = sentinel.current
    if (!root || !target || nextOffset == null || pageError) return
    const controller = new AbortController()

    async function loadPage(offset: number) {
      setLoadingMore(true)
      try {
        const page = await searchMentors({ ...params, offset }, controller.signal)
        if (controller.signal.aborted) return
        results.setData((current) => {
          if (!current) return current
          const seen = new Set(current.items.map((mentor) => mentor.id))
          return {
            items: [...current.items, ...page.items.filter((mentor) => !seen.has(mentor.id))],
            next_offset: page.next_offset,
          }
        })
      } catch (error) {
        if (!controller.signal.aborted)
          setPageError(errorMessage(error, "Не удалось загрузить ещё наставников"))
      } finally {
        if (!controller.signal.aborted) setLoadingMore(false)
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.unobserve(target)
        void loadPage(nextOffset)
      },
      { root: isMobile ? null : root, rootMargin: "120px" },
    )

    observer.observe(target)
    return () => {
      observer.disconnect()
      controller.abort()
    }
  }, [filter, nextOffset, pageError, isMobile])

  useEffect(() => {
    if (!activeMentor || isMobile) return
    closePanel.current?.focus({ preventScroll: true })
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismissPanel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activeMentor, isMobile])

  // Возвращает фокус на открывавшую профиль кнопку.
  function dismissPanel() {
    setActiveMentor(null)
    openedBy.current?.focus({ preventScroll: true })
  }

  return (
    <div className={styles.page}>
      <div className={styles.stickyTop}>
        <div className={styles.headingCol}>
          <div className={styles.title} role="heading" aria-level={1}>
            НАСТАВНИКИ
          </div>
          <div className={styles.subtitle}>Познакомьтесь со специалистами и их опытом.</div>
        </div>
        <div className={styles.filtersRow}>
          <label className={styles.searchField}>
            <SearchIcon className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              aria-label="Поиск по имени или специализации"
              className={styles.searchInput}
              placeholder="Поиск по имени или специализации"
              value={query}
              maxLength={200}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className={styles.filterWrap}>
            <CustomSelect
              ariaLabel="Фильтр по отрасли"
              variant="pill"
              value={industry}
              options={industries}
              onChange={setIndustry}
            />
          </div>
        </div>
      </div>
      <div className={styles.workspace}>
        <div className={styles.scrollArea} ref={scrollArea}>
          {!results.data && results.loading && (
            <div className={styles.grid} role="status" aria-label="Загружаем наставников">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className={styles.card} aria-hidden="true">
                  <div className={styles.photoWrap} />
                  <div className={`${styles.placeholder} ${styles.namePlaceholder}`} />
                  <div className={`${styles.placeholder} ${styles.rolePlaceholder}`} />
                  <div className={`${styles.placeholder} ${styles.buttonPlaceholder}`} />
                </div>
              ))}
            </div>
          )}
          {results.error && !results.data && <ResourceError message={results.error} retry={results.reload} />}
          {results.data?.items.length === 0 && (
            <EmptyState message="Наставники не найдены.">
              <button
                type="button"
                className={styles.resetBtn}
                onClick={() => {
                  setQuery("")
                  setTerm("")
                  setIndustry("all")
                }}
              >
                Сбросить фильтры
              </button>
            </EmptyState>
          )}
          {Boolean(results.data?.items.length) && (
            <div className={styles.grid}>
              {results.data?.items.map((mentor) => {
                const selected = activeMentor?.id === mentor.id
                return (
                  <div
                    key={mentor.id}
                    className={`${styles.card} ${selected && !isMobile ? styles.cardSelected : ""}`}
                  >
                    <div className={styles.photoWrap}>
                      <img src={mentor.portrait_url} alt="" loading="lazy" className={styles.photo} />
                    </div>
                    <div className={styles.cardName}>{mentor.name}</div>
                    <div className={styles.cardRole}>{mentor.headline}</div>
                    <div className={styles.cardExp}>{mentor.experience_label}</div>
                    <div className={styles.cardFooter}>
                      <button
                        type="button"
                        className={styles.moreBtn}
                        aria-expanded={selected}
                        onClick={(event) => {
                          if (selected) dismissPanel()
                          else {
                            openedBy.current = event.currentTarget
                            setActiveMentor(mentor)
                          }
                        }}
                      >
                        {selected && !isMobile ? "Скрыть" : "Подробнее"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {loadingMore && (
            <div className={styles.moreStatus} role="status">
              Загружаем ещё наставников…
            </div>
          )}
          {pageError && (
            <div className={styles.moreStatus} role="alert">
              {pageError}
              <button type="button" className={styles.resetBtn} onClick={() => setPageError("")}>
                Повторить
              </button>
            </div>
          )}
          {nextOffset != null && <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />}
        </div>
        <AnimatePresence initial={false}>
          {!isMobile && activeMentor && (
            <motion.div
              className={styles.pushPanelWrap}
              initial={{ width: 0, opacity: 0, marginLeft: 0 }}
              animate={{ width: compactPanel ? 304 : 390, opacity: 1, marginLeft: 18 }}
              exit={{ width: 0, opacity: 0, marginLeft: 0 }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 34 }}
            >
              <div className={styles.pushPanel} role="region" aria-label={`Наставник: ${activeMentor.name}`}>
                <div className={styles.pushHeader}>
                  <div className={styles.pushHeaderText}>
                    <div className={styles.pushTitle}>{activeMentor.name}</div>
                    <div className={styles.pushSubtitle}>{activeMentor.headline}</div>
                  </div>
                  <button
                    ref={closePanel}
                    type="button"
                    className={styles.pushCloseBtn}
                    aria-label="Закрыть панель"
                    onClick={dismissPanel}
                  >
                    <CloseIcon className={styles.pushCloseIcon} aria-hidden="true" />
                  </button>
                </div>
                <div className={styles.pushBody}>
                  <MentorDetailsContent mentor={activeMentor} hint={panelHint} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {isMobile && (
        <SidePanel
          open={Boolean(activeMentor)}
          title={activeMentor?.name}
          subtitle={activeMentor?.headline}
          onClose={dismissPanel}
        >
          {activeMentor && <MentorDetailsContent mentor={activeMentor} hint={panelHint} />}
        </SidePanel>
      )}
    </div>
  )
}

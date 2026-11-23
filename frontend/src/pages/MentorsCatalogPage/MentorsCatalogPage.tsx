import { useEffect, useRef, useState } from "react"
import SearchIcon from "../../assets/icons/search.svg?react"
import CustomSelect from "../../components/CustomSelect/CustomSelect"
import MentorDirectory, { MentorDirectorySkeleton } from "../../components/MentorDirectory/MentorDirectory"
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

export default function MentorsCatalogPage() {
  const isMobile = useIsMobile(768)
  const [query, setQuery] = useState("")
  const [term, setTerm] = useState("")
  const [industry, setIndustry] = useState("all")
  const [activeMentor, setActiveMentor] = useState<MentorOut | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pageError, setPageError] = useState("")
  const scrollArea = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)

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
          return { items: [...current.items, ...page.items.filter((mentor) => !seen.has(mentor.id))], next_offset: page.next_offset }
        })
      } catch (error) {
        if (!controller.signal.aborted) setPageError(errorMessage(error, "Не удалось загрузить ещё наставников"))
      } finally {
        if (!controller.signal.aborted) setLoadingMore(false)
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      observer.unobserve(target)
      void loadPage(nextOffset)
    }, { root: isMobile ? null : root, rootMargin: "120px" })
    observer.observe(target)
    return () => {
      observer.disconnect()
      controller.abort()
    }
  }, [filter, nextOffset, pageError, isMobile])

  const listAfter = <>
    {loadingMore && <div className={styles.moreStatus} role="status">Загружаем ещё наставников…</div>}
    {pageError && <div className={styles.moreStatus} role="alert">{pageError}<button type="button" className={styles.resetBtn} onClick={() => setPageError("")}>Повторить</button></div>}
    {nextOffset != null && <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />}
  </>

  return (
    <div className={styles.page}>
      <div className={styles.stickyTop}>
        <div className={styles.headingCol}>
          <div className={styles.title} role="heading" aria-level={1}>НАСТАВНИКИ</div>
          <div className={styles.subtitle}>Познакомьтесь со специалистами и их опытом.</div>
        </div>
        <div className={styles.filtersRow}>
          <label className={styles.searchField}>
            <SearchIcon className={styles.searchIcon} aria-hidden="true" />
            <input type="search" aria-label="Поиск по имени или специализации" className={styles.searchInput}
              placeholder={isMobile ? "Поиск наставника" : "Поиск по имени или специализации"} value={query} maxLength={200}
              onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className={styles.filterWrap}><CustomSelect ariaLabel="Фильтр по отрасли" variant="pill" value={industry} options={industries} onChange={setIndustry} /></div>
        </div>
      </div>
      <div className={styles.workspace}>
        {!results.data && results.loading ? (
          <div className={styles.scrollArea} ref={scrollArea}><MentorDirectorySkeleton /></div>
        ) : results.data?.items.length === 0 ? (
          <div className={styles.scrollArea} ref={scrollArea}>
            <EmptyState message="Наставники не найдены.">
              <button type="button" className={styles.resetBtn} onClick={() => {
                setQuery("")
                setTerm("")
                setIndustry("all")
              }}>Сбросить фильтры</button>
            </EmptyState>
          </div>
        ) : (
          <MentorDirectory mentors={results.data?.items ?? []} selected={activeMentor} onSelect={setActiveMentor}
            scrollRef={scrollArea} panelHint={panelHint} listBefore={results.error && !results.data ? <ResourceError message={results.error} retry={results.reload} /> : null}
            listAfter={listAfter} />
        )}
      </div>
    </div>
  )
}

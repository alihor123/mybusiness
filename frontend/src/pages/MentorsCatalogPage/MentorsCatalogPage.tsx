import { useRef, useState } from "react"
import SearchIcon from "../../assets/icons/search.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import BriefcaseIcon from "../../assets/icons/briefcase.svg?react"
import PlayIcon from "../../assets/icons/play.svg?react"
import { useApp } from "../../contexts/AppContext"
import type { Mentor } from "../../data/mockData"
import styles from "./MentorsCatalogPage.module.css"

// Отображает каталог наставников с поиском, фильтром по отрасли и окном подробностей.
export default function MentorsCatalogPage() {
  const { mentors } = useApp()

  // Локальные фильтры каталога и выбранный наставник для всплывающего окна.
  const [query, setQuery] = useState("")
  const [industryFilter, setIndustryFilter] = useState("all")
  const [activeMentor, setActiveMentor] = useState<Mentor | null>(null)
  // Ссылка на поле поиска для возврата фокуса после сброса.
  const searchRef = useRef<HTMLInputElement>(null)

  const industries = Array.from(new Set(mentors.map((mentor) => mentor.industry)))
  const searchText = query.trim().toLowerCase()

  const visibleMentors = mentors.filter((mentor) => {
    const matchesIndustry = industryFilter === "all" || mentor.industry === industryFilter
    if (!matchesIndustry) return false
    if (!searchText) return true
    return (
      mentor.name.toLowerCase().includes(searchText) ||
      mentor.role.toLowerCase().includes(searchText) ||
      mentor.industry.toLowerCase().includes(searchText)
    )
  })

  // Сбрасывает строку поиска и фильтр отрасли, возвращая фокус в поиск.
  function resetFilters() {
    setQuery("")
    setIndustryFilter("all")
    searchRef.current?.focus()
  }

  return (
    <div className={styles.page}>
      <div className={styles.headingCol}>
        <div className={styles.title} role="heading" aria-level={1}>
          НАСТАВНИКИ
        </div>
        <div className={styles.subtitle}>
          Познакомьтесь со специалистами и их опытом.
        </div>
      </div>

      <div className={styles.filtersRow}>
        <label className={styles.searchField} htmlFor="mentors-search-input">
          <SearchIcon className={styles.searchIcon} aria-hidden="true" />
          <input
            ref={searchRef}
            id="mentors-search-input"
            type="text"
            className={styles.searchInput}
            placeholder="Поиск по имени или специализации"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <select
          aria-label="Фильтр по отрасли"
          className={styles.filterSelect}
          value={industryFilter}
          onChange={(event) => setIndustryFilter(event.target.value)}
        >
          <option value="all">Выберите фильтр</option>
          {industries.map((industry) => (
            <option key={industry} value={industry}>{industry}</option>
          ))}
        </select>
      </div>

      {visibleMentors.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Наставники не найдены</div>
          <div className={styles.emptyDesc}>
            Попробуйте изменить запрос или сбросить фильтр по отрасли.
          </div>
          <button type="button" className={styles.resetBtn} onClick={resetFilters}>
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {visibleMentors.map((mentor) => (
            <div key={mentor.id} className={styles.card}>
              <div className={styles.photoWrap}>
                <img src={mentor.photo} alt={mentor.name} className={styles.photo} />
              </div>

              <div className={styles.cardName}>{mentor.name}</div>
              <div className={styles.cardRole}>{mentor.role}</div>
              <div className={styles.cardExp}>{mentor.experience}</div>

              <div className={styles.cardFooter}>
                <button
                  type="button"
                  className={styles.moreBtn}
                  onClick={() => setActiveMentor(mentor)}
                >
                  Подробнее
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeMentor && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label={`Наставник ${activeMentor.name}`}
          onClick={() => setActiveMentor(null)}
        >
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              aria-label="Закрыть окно"
              onClick={() => setActiveMentor(null)}
            >
              <CloseIcon className={styles.closeIcon} aria-hidden="true" />
            </button>

            <div className={styles.modalHeader}>
              <img
                src={activeMentor.photo}
                alt={activeMentor.name}
                className={styles.modalPhoto}
              />
              <div className={styles.modalMeta}>
                <div className={styles.modalName}>{activeMentor.name}</div>
                <div className={styles.modalRole}>{activeMentor.fullRole}</div>
                <div className={styles.modalTag}>{activeMentor.industry}</div>

                <div className={styles.modalInfoRow}>
                  <BriefcaseIcon className={styles.modalInfoIcon} aria-hidden="true" />
                  <span>{activeMentor.experience}</span>
                </div>
                <div className={styles.modalInfoRow}>
                  <PlayIcon className={styles.modalInfoIcon} aria-hidden="true" />
                  <span>{activeMentor.format}</span>
                </div>
              </div>
            </div>

            <div className={styles.modalDivider} />

            <div className={styles.modalAboutTitle}>О себе</div>
            <div className={styles.modalAboutText}>{activeMentor.about}</div>

            <div className={styles.modalHint}>
              Отправить заявку наставнику можно из анкеты вашего проекта в разделе «Мои проекты».
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

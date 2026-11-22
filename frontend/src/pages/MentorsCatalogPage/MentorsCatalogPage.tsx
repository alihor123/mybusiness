import { useRef, useState } from "react"
import SearchIcon from "../../assets/icons/search.svg?react"
import BriefcaseIcon from "../../assets/icons/briefcase.svg?react"
import PlayIcon from "../../assets/icons/play.svg?react"
import CustomSelect from "../../components/CustomSelect/CustomSelect"
import SidePanel from "../../components/SidePanel/SidePanel"
import { useApp } from "../../contexts/AppContext"
import type { Mentor } from "../../data/mockData"
import styles from "./MentorsCatalogPage.module.css"

// Отображает каталог наставников с фиксированной шапкой, поиском и выезжающей панелью профиля.
export default function MentorsCatalogPage() {
  const { mentors } = useApp()

  // Локальные фильтры каталога и выбранный наставник для выезжающей панели.
  const [query, setQuery] = useState("")
  const [industryFilter, setIndustryFilter] = useState("all")
  const [activeMentor, setActiveMentor] = useState<Mentor | null>(null)
  // Ссылка на поле поиска для возврата фокуса после сброса.
  const searchRef = useRef<HTMLInputElement>(null)

  const industries = Array.from(new Set(mentors.map((mentor) => mentor.industry)))
  const filterOptions = [
    { id: "all", label: "Все отрасли" },
    ...industries.map((industry) => ({ id: industry, label: industry })),
  ]

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
      <div className={styles.stickyTop}>
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

          <div className={styles.filterWrap}>
            <CustomSelect
              ariaLabel="Фильтр по отрасли"
              variant="pill"
              value={industryFilter}
              options={filterOptions}
              onChange={setIndustryFilter}
            />
          </div>
        </div>
      </div>

      <div className={styles.scrollArea}>
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
                  <img src={mentor.photo} alt="" loading="lazy" className={styles.photo} />
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
      </div>

      <SidePanel
        open={activeMentor !== null}
        title={activeMentor?.name}
        subtitle={activeMentor?.industry}
        onClose={() => setActiveMentor(null)}
      >
        {activeMentor && (
          <div className={styles.panelContent}>
            <div className={styles.panelHero}>
              <div className={styles.panelPhotoWrap}>
                <img src={activeMentor.photo} alt="" className={styles.panelPhoto} />
              </div>
              <div className={styles.panelMeta}>
                <div className={styles.panelRole}>{activeMentor.fullRole}</div>
                <div className={styles.panelInfoRow}>
                  <BriefcaseIcon className={styles.panelInfoIcon} aria-hidden="true" />
                  <span>{activeMentor.experience}</span>
                </div>
                <div className={styles.panelInfoRow}>
                  <PlayIcon className={styles.panelInfoIcon} aria-hidden="true" />
                  <span>{activeMentor.format}</span>
                </div>
              </div>
            </div>

            <div className={styles.panelDivider} />

            <div className={styles.panelAboutTitle}>О себе</div>
            <div className={styles.panelAboutText}>{activeMentor.about}</div>

            <div className={styles.panelHint}>
              Отправить заявку наставнику можно из анкеты вашего проекта в разделе «Мои проекты».
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  )
}

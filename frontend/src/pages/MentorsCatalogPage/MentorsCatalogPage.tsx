import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import SearchIcon from "../../assets/icons/search.svg?react"
import BriefcaseIcon from "../../assets/icons/briefcase.svg?react"
import PlayIcon from "../../assets/icons/play.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import CustomSelect from "../../components/CustomSelect/CustomSelect"
import SidePanel from "../../components/SidePanel/SidePanel"
import { useApp } from "../../contexts/AppContext"
import { useIsMobile } from "../../hooks/useIsMobile"
import type { Mentor } from "../../data/mockData"
import styles from "./MentorsCatalogPage.module.css"

// Каталог наставников: на десктопе панель плавно сдвигает сетку (4 → 3 колонки), на мобилке — нижняя шторка.
export default function MentorsCatalogPage() {
  const { mentors } = useApp()
  const isMobile = useIsMobile(768)

  // Локальные фильтры каталога и выбранный наставник для панели подробностей.
  const [query, setQuery] = useState("")
  const [industryFilter, setIndustryFilter] = useState("all")
  const [activeMentor, setActiveMentor] = useState<Mentor | null>(null)
  // Ссылка на поле поиска для возврата фокуса после сброса.
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!activeMentor || isMobile) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveMentor(null)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeMentor, isMobile])

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

  // Рендерит содержимое профиля наставника для десктопной панели и мобильной шторки.
  function renderMentorDetails(mentor: Mentor) {
    return (
      <div className={styles.panelContent}>
        <div className={styles.panelPhotoWrap}>
          <img src={mentor.photo} alt="" className={styles.panelPhoto} />
        </div>
        <div className={styles.panelMeta}>
          <div className={styles.panelRole}>{mentor.fullRole}</div>
          <div className={styles.panelInfoRow}>
            <BriefcaseIcon className={styles.panelInfoIcon} aria-hidden="true" />
            <span>{mentor.experience}</span>
          </div>
          <div className={styles.panelInfoRow}>
            <PlayIcon className={styles.panelInfoIcon} aria-hidden="true" />
            <span>{mentor.format}</span>
          </div>
        </div>
        <div className={styles.panelDivider} />
        <div className={styles.panelAboutTitle}>О себе</div>
        <div className={styles.panelAboutText}>{mentor.about}</div>
        <div className={styles.panelHint}>
          Отправить заявку наставнику можно из анкеты вашего проекта в разделе «Мои проекты».
        </div>
      </div>
    )
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

      <div className={styles.workspace}>
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
              {visibleMentors.map((mentor) => {
                const isSelected = !isMobile && activeMentor?.id === mentor.id
                return (
                  <motion.div
                    key={mentor.id}
                    layout
                    transition={{ type: "spring", stiffness: 320, damping: 32 }}
                    className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
                  >
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
                        onClick={() =>
                          setActiveMentor((prev) =>
                            !isMobile && prev?.id === mentor.id ? null : mentor,
                          )
                        }
                      >
                        {isSelected ? "Скрыть" : "Подробнее"}
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        <AnimatePresence initial={false}>
          {!isMobile && activeMentor && (
            <motion.div
              className={styles.pushPanelWrap}
              initial={{ width: 0, opacity: 0, marginLeft: 0 }}
              animate={{ width: 390, opacity: 1, marginLeft: 18 }}
              exit={{ width: 0, opacity: 0, marginLeft: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <div className={styles.pushPanel}>
                <div className={styles.pushHeader}>
                  <div className={styles.pushHeaderText}>
                    <div className={styles.pushTitle}>{activeMentor.name}</div>
                    <div className={styles.pushSubtitle}>{activeMentor.industry}</div>
                  </div>
                  <button
                    type="button"
                    className={styles.pushCloseBtn}
                    aria-label="Закрыть панель"
                    onClick={() => setActiveMentor(null)}
                  >
                    <CloseIcon className={styles.pushCloseIcon} aria-hidden="true" />
                  </button>
                </div>
                <div className={styles.pushBody}>
                  {renderMentorDetails(activeMentor)}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isMobile && (
        <SidePanel
          open={activeMentor !== null}
          title={activeMentor?.name}
          subtitle={activeMentor?.industry}
          onClose={() => setActiveMentor(null)}
        >
          {activeMentor && renderMentorDetails(activeMentor)}
        </SidePanel>
      )}
    </div>
  )
}

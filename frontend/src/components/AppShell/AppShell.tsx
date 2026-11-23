import { useEffect, useState } from "react"
import { NavLink, useLocation, useOutlet } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import logoUrl from "../../assets/brand/logo.svg"
import GraduationIcon from "../../assets/icons/graduation.svg?react"
import FolderIcon from "../../assets/icons/folder.svg?react"
import FolderLockIcon from "../../assets/icons/folder-lock.svg?react"
import UsersIcon from "../../assets/icons/users.svg?react"
import ProfileIcon from "../../assets/icons/profile.svg?react"
import UserPlusIcon from "../../assets/icons/user-plus.svg?react"
import MenuIcon from "../../assets/icons/menu.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import SidebarToggleIcon from "../../assets/icons/sidebar-toggle.svg?react"
import { useApp } from "../../contexts/AppContext"
import { useToast } from "../../contexts/ToastContext"
import { useCachedProgress } from "../../contexts/LearningCacheContext"
import { useIsMobile } from "../../hooks/useIsMobile"
import styles from "./AppShell.module.css"

const SIDEBAR_STORAGE_KEY = "mb_sidebar_collapsed"

type NavItem = {
  to: string
  label: string
  icon: "learning" | "projects" | "mentors" | "requests"
}

// Считывает сохранённое состояние свёрнутости бокового меню из localStorage.
function readInitialCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

// Общий layout кабинета: остаётся смонтированным и делает быстрый crossfade страниц через useOutlet.
export default function AppShell() {
  const { session } = useApp()
  const { showToast } = useToast()
  const role = session.profile?.role
  const location = useLocation()
  const outlet = useOutlet()
  const isMobile = useIsMobile(768)
  const reducedMotion = useReducedMotion()
  const learningProgress = useCachedProgress(role === "student")
  const canCreateProject = learningProgress.data?.can_create_project ?? false

  // Управляет сворачиванием десктопного меню и открытием мобильной шторки.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readInitialCollapsed)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems: NavItem[] =
    role === "student"
      ? [
          { to: "/learning", label: "Обучение", icon: "learning" },
          { to: "/projects", label: "Мои проекты", icon: "projects" },
          { to: "/mentors", label: "Наставники", icon: "mentors" },
        ]
      : [
          { to: "/mentor/requests", label: "Заявки", icon: "requests" },
          { to: "/mentor/projects", label: "Мои проекты", icon: "projects" },
        ]

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [mobileMenuOpen])

  // Переключает свёрнутость сайдбара и сохраняет выбор в localStorage.
  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0")
      } catch {
        // Игнорируем недоступность хранилища в приватном режиме.
      }
      return next
    })
  }

  // Возвращает SVG-иконку пункта навигации по его ключу.
  function renderNavIcon(icon: NavItem["icon"]) {
    if (icon === "learning") return <GraduationIcon className={styles.navIcon} aria-hidden="true" />
    if (icon === "projects")
      return role !== "student" || canCreateProject ? (
        <FolderIcon className={styles.navIcon} aria-hidden="true" />
      ) : (
        <FolderLockIcon className={styles.navIcon} aria-hidden="true" />
      )
    if (icon === "mentors") return <UsersIcon className={styles.navIcon} aria-hidden="true" />
    return <UserPlusIcon className={styles.navIcon} aria-hidden="true" />
  }

  // Рендерит содержимое бокового меню для десктопа и мобильной шторки.
  function renderSidebarContent(compact: boolean) {
    return (
      <>
        <div className={styles.sidebarTop}>
          <div className={styles.brandRow}>
            {!compact && (
              <NavLink to={role === "student" ? "/learning" : "/mentor/requests"} className={styles.logoLink}>
                <img src={logoUrl} alt="Мой бизнес Югра" className={styles.logo} />
              </NavLink>
            )}

            {!isMobile && (
              <button
                type="button"
                className={styles.collapseBtn}
                aria-label={compact ? "Развернуть меню" : "Свернуть меню"}
                title={compact ? "Развернуть меню" : "Свернуть меню"}
                onClick={toggleSidebar}
              >
                <SidebarToggleIcon className={styles.toggleIcon} aria-hidden="true" />
              </button>
            )}

            {isMobile && (
              <button
                type="button"
                className={styles.mobileCloseBtn}
                aria-label="Закрыть меню"
                onClick={() => setMobileMenuOpen(false)}
              >
                <CloseIcon className={styles.closeIcon} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className={styles.navList} role="navigation" aria-label="Основная навигация">
            {navItems.map((item) =>
              item.icon === "projects" && role === "student" && !canCreateProject ? (
                <button
                  key={item.to}
                  type="button"
                  className={`${styles.navItem} ${styles.navItemLocked}`}
                  aria-label={compact ? item.label : undefined}
                  title={compact ? item.label : undefined}
                  onClick={() =>
                    showToast({ message: "Завершите обучение, чтобы открыть проекты", type: "neutral" })
                  }
                >
                  {renderNavIcon(item.icon)}
                  {!compact && <span className={styles.navLabel}>{item.label}</span>}
                </button>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  title={compact ? item.label : undefined}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                >
                  {renderNavIcon(item.icon)}
                  {!compact && <span className={styles.navLabel}>{item.label}</span>}
                </NavLink>
              ),
            )}
          </div>
        </div>

        <div className={styles.sidebarBottom}>
          <NavLink
            to="/profile"
            onClick={() => setMobileMenuOpen(false)}
            title={compact ? "Профиль" : undefined}
            className={({ isActive }) =>
              `${styles.navItem} ${styles.profileItem} ${isActive ? styles.navItemActive : ""}`
            }
          >
            <ProfileIcon className={styles.navIcon} aria-hidden="true" />
            {!compact && <span className={styles.profileLabel}>Профиль</span>}
          </NavLink>
        </div>
      </>
    )
  }

  return (
    <div className={styles.shell}>
      {isMobile && (
        <div className={styles.mobileHeader}>
          <button
            type="button"
            className={styles.mobileMenuBtn}
            aria-label="Открыть меню"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <MenuIcon className={styles.menuBtnIcon} aria-hidden="true" />
          </button>

          <NavLink
            to={role === "student" ? "/learning" : "/mentor/requests"}
            className={styles.mobileLogoLink}
          >
            <img src={logoUrl} alt="Мой бизнес Югра" className={styles.mobileLogo} />
          </NavLink>

          <div className={styles.mobileHeaderSpacer} aria-hidden="true" />
        </div>
      )}

      {!isMobile && (
        <div className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ""}`}>
          {renderSidebarContent(sidebarCollapsed)}
        </div>
      )}

      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <>
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.16 }}
              aria-hidden="true"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              className={styles.mobileDrawer}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 36 }}
            >
              {renderSidebarContent(false)}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className={styles.contentArea}>
        <AnimatePresence initial={false}>
          <motion.div
            key={location.pathname}
            className={styles.routePane}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.contentInner}>{outlet}</div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

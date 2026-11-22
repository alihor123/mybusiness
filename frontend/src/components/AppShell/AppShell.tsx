import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import logoUrl from "../../assets/brand/logo.svg"
import GraduationIcon from "../../assets/icons/graduation.svg?react"
import FolderIcon from "../../assets/icons/folder.svg?react"
import UsersIcon from "../../assets/icons/users.svg?react"
import ProfileIcon from "../../assets/icons/profile.svg?react"
import UserPlusIcon from "../../assets/icons/user-plus.svg?react"
import MenuIcon from "../../assets/icons/menu.svg?react"
import CloseIcon from "../../assets/icons/close.svg?react"
import SidebarToggleIcon from "../../assets/icons/sidebar-toggle.svg?react"
import { useApp } from "../../contexts/AppContext"
import styles from "./AppShell.module.css"

type NavItem = {
  to: string
  label: string
  icon: "learning" | "projects" | "mentors" | "requests"
  badgeCount?: number
}

// Оборачивает экраны кабинета адаптивным сайдбаром и мобильным меню.
export default function AppShell({ children }: { children: ReactNode }) {
  const { role, setRole, mentorRequests } = useApp()
  const location = useLocation()
  const navigate = useNavigate()

  // Управляет сворачиванием десктопного меню и открытием мобильной шторки.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const pendingRequestsCount = mentorRequests.filter((req) => req.status === "pending").length

  const navItems: NavItem[] = role === "student"
    ? [
        { to: "/learning", label: "Обучение", icon: "learning" },
        { to: "/projects", label: "Мои проекты", icon: "projects" },
        { to: "/mentors", label: "Наставники", icon: "mentors" },
      ]
    : [
        { to: "/mentor/requests", label: "Заявки", icon: "requests", badgeCount: pendingRequestsCount },
        { to: "/mentor/projects", label: "Мои проекты", icon: "projects" },
      ]

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Переключает демо-роль и переводит пользователя на стартовый экран выбранного кабинета.
  function switchRole(nextRole: "student" | "mentor") {
    if (nextRole === role) return
    setRole(nextRole)
    setMobileMenuOpen(false)
    if (nextRole === "mentor") {
      navigate("/mentor/requests")
    } else {
      navigate("/learning/test")
    }
  }

  // Возвращает SVG-иконку пункта навигации по его ключу.
  function renderNavIcon(icon: NavItem["icon"]) {
    if (icon === "learning") return <GraduationIcon className={styles.navIcon} aria-hidden="true" />
    if (icon === "projects") return <FolderIcon className={styles.navIcon} aria-hidden="true" />
    if (icon === "mentors") return <UsersIcon className={styles.navIcon} aria-hidden="true" />
    return <UserPlusIcon className={styles.navIcon} aria-hidden="true" />
  }

  return (
    <div className={styles.shell}>
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

        <NavLink to={role === "student" ? "/learning" : "/mentor/requests"} className={styles.mobileLogoLink}>
          <img src={logoUrl} alt="Мой бизнес Югра" className={styles.mobileLogo} />
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) => `${styles.mobileProfileBtn} ${isActive ? styles.mobileProfileActive : ""}`}
          aria-label="Профиль"
        >
          <ProfileIcon className={styles.navIcon} aria-hidden="true" />
        </NavLink>
      </div>

      {mobileMenuOpen && (
        <div
          className={styles.backdrop}
          aria-hidden="true"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={[
          styles.sidebar,
          sidebarCollapsed ? styles.sidebarCollapsed : "",
          mobileMenuOpen ? styles.sidebarMobileOpen : "",
        ].join(" ")}
      >
        <div className={styles.sidebarTop}>
          <div className={styles.brandRow}>
            {!sidebarCollapsed && (
              <NavLink
                to={role === "student" ? "/learning" : "/mentor/requests"}
                className={styles.logoLink}
              >
                <img src={logoUrl} alt="Мой бизнес Югра" className={styles.logo} />
              </NavLink>
            )}

            <button
              type="button"
              className={styles.collapseBtn}
              aria-label={sidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
              title={sidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
              onClick={() => setSidebarCollapsed((prev) => !prev)}
            >
              <SidebarToggleIcon className={styles.toggleIcon} aria-hidden="true" />
            </button>

            <button
              type="button"
              className={styles.mobileCloseBtn}
              aria-label="Закрыть меню"
              onClick={() => setMobileMenuOpen(false)}
            >
              <CloseIcon className={styles.closeIcon} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.navList} role="navigation" aria-label="Основная навигация">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={sidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
                }
              >
                {renderNavIcon(item.icon)}
                {!sidebarCollapsed && <span className={styles.navLabel}>{item.label}</span>}
                {!sidebarCollapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <span className={styles.navBadge}>{item.badgeCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        <div className={styles.sidebarBottom}>
          {!sidebarCollapsed && (
            <div className={styles.roleSwitch} role="group" aria-label="Переключение роли">
              <button
                type="button"
                className={`${styles.roleBtn} ${role === "student" ? styles.roleBtnActive : ""}`}
                onClick={() => switchRole("student")}
              >
                Ученик
              </button>
              <button
                type="button"
                className={`${styles.roleBtn} ${role === "mentor" ? styles.roleBtnActive : ""}`}
                onClick={() => switchRole("mentor")}
              >
                Наставник
              </button>
            </div>
          )}

          <NavLink
            to="/profile"
            title={sidebarCollapsed ? "Профиль" : undefined}
            className={({ isActive }) =>
              `${styles.navItem} ${styles.profileItem} ${isActive ? styles.navItemActive : ""}`
            }
          >
            <ProfileIcon className={styles.navIcon} aria-hidden="true" />
            {!sidebarCollapsed && <span className={styles.navLabel}>Профиль</span>}
          </NavLink>
        </div>
      </div>

      <div className={styles.contentArea}>
        <div className={styles.contentInner}>{children}</div>
      </div>
    </div>
  )
}

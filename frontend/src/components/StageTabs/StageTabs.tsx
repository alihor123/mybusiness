import { Link } from "react-router-dom"
import LockIcon from "../../assets/icons/lock.svg?react"
import { useApp } from "../../contexts/AppContext"
import styles from "./StageTabs.module.css"

// Отображает верхние вкладки этапов «Обучение» и «Сопровождение».
export default function StageTabs({ active }: { active: "learning" | "accompaniment" }) {
  const { accompanimentUnlocked } = useApp()

  return (
    <div className={styles.tabs} role="navigation" aria-label="Этапы программы">
      <Link
        to="/learning"
        className={`${styles.tab} ${active === "learning" ? styles.tabActive : ""}`}
      >
        ОБУЧЕНИЕ
      </Link>

      <Link
        to="/projects"
        className={`${styles.tab} ${active === "accompaniment" ? styles.tabActive : ""}`}
      >
        {!accompanimentUnlocked && <LockIcon className={styles.lockIcon} aria-hidden="true" />}
        <span>СОПРОВОЖДЕНИЕ</span>
      </Link>
    </div>
  )
}

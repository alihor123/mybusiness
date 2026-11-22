import { useEffect, useState } from "react"

// Отслеживает мобильную ширину экрана через matchMedia без лишних ререндеров.
export function useIsMobile(maxWidth = 768) {
  // Начальное состояние вычисляется один раз при первом рендере компонента.
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= maxWidth)

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${maxWidth}px)`)

    function handleChange(event: MediaQueryListEvent) {
      setIsMobile(event.matches)
    }

    setIsMobile(media.matches)
    media.addEventListener("change", handleChange)
    return () => media.removeEventListener("change", handleChange)
  }, [maxWidth])

  return isMobile
}

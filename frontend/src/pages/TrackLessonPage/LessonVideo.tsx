import { useEffect, useRef } from "react"
import styles from "./TrackLessonPage.module.css"

type VideoProps = {
  url: string
  poster?: string | null
  onError: () => void
}
const rutubeOrigin = "https://rutube.ru"
const rutubeEmbed = /^https:\/\/rutube\.ru\/play\/embed\/([a-f0-9]{32})\/?$/u

// Ошибки встроенного плеера приходят сообщением от его iframe.
function RutubePlayer({ id, onError }: { id: string, onError: () => void }) {
  // Ссылка нужна для проверки источника сообщения и вызова актуального обработчика.
  const frame = useRef<HTMLIFrameElement>(null)
  const reportError = useRef(onError)
  reportError.current = onError

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== rutubeOrigin || event.source !== frame.current?.contentWindow) return
      if (typeof event.data !== "string") return
      try {
        const message = JSON.parse(event.data)
        if (message?.type === "player:error") reportError.current()
      } catch {
        // Плеер может отправить служебное сообщение вне JSON-контракта.
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [id])

  return (
    <>
      <iframe
        ref={frame}
        title="Как говорить с клиентом — видео на RUTUBE"
        src={`${rutubeOrigin}/play/embed/${id}/`}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        className={styles.playerVideo}
        onError={onError}
      />
      <a
        className={styles.videoLink}
        href={`${rutubeOrigin}/video/${id}/`}
        target="_blank"
        rel="noreferrer"
      >
        Открыть видео на RUTUBE
      </a>
    </>
  )
}

// Поддерживает встроенный RUTUBE и видеофайлы из учебных материалов.
export default function LessonVideo({ url, poster, onError }: VideoProps) {
  const rutubeId = rutubeEmbed.exec(url)?.[1]

  return rutubeId ? (
    <div className={styles.videoMaterial}>
      <RutubePlayer id={rutubeId} onError={onError} />
    </div>
  ) : (
    <div className={styles.playerBox}>
      <video
        controls
        playsInline
        preload="metadata"
        src={url}
        poster={poster ?? undefined}
        className={styles.playerVideo}
        onError={onError}
      />
    </div>
  )
}

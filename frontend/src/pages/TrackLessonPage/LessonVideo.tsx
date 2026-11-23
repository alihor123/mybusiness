import { useEffect, useRef } from "react"
import styles from "./TrackLessonPage.module.css"

type VideoProps = {
  url: string
  poster?: string | null
  onEnded: () => void
  onError: () => void
  onOpenedExternally: () => void
}
const rutubeOrigin = "https://rutube.ru"
const rutubeEmbed = /^https:\/\/rutube\.ru\/play\/embed\/([a-f0-9]{32})\/?$/u

// У встроенного плеера завершение приходит сообщением от конкретного iframe.
function RutubePlayer({
  id,
  onEnded,
  onError,
  onOpenedExternally,
}: { id: string } & Pick<VideoProps, "onEnded" | "onError" | "onOpenedExternally">) {
  // Ссылка нужна для проверки источника сообщения. Обработчики остаются актуальными между рендерами.
  const frame = useRef<HTMLIFrameElement>(null)
  const handlers = useRef({ onEnded, onError })
  handlers.current = { onEnded, onError }

  useEffect(() => {
    let played = false
    function onMessage(event: MessageEvent) {
      if (event.origin !== rutubeOrigin || event.source !== frame.current?.contentWindow) return
      if (typeof event.data !== "string") return
      try {
        const message = JSON.parse(event.data)
        if (message?.type === "player:playStart" || message?.data?.state === "playing") played = true
        if (message?.type === "player:error") handlers.current.onError()
        if (
          played &&
          (message?.type === "player:playComplete" ||
            (message?.type === "player:changeState" && message?.data?.state === "stopped"))
        )
          handlers.current.onEnded()
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
        onClick={onOpenedExternally}
      >
        Открыть видео на RUTUBE
      </a>
    </>
  )
}

// Поддерживает встроенный RUTUBE и видеофайлы из учебных материалов.
export default function LessonVideo({ url, poster, onEnded, onError, onOpenedExternally }: VideoProps) {
  const rutubeId = rutubeEmbed.exec(url)?.[1]

  return rutubeId ? (
    <div className={styles.videoMaterial}>
      <RutubePlayer
        id={rutubeId}
        onEnded={onEnded}
        onError={onError}
        onOpenedExternally={onOpenedExternally}
      />
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
        onEnded={onEnded}
        onError={onError}
      />
    </div>
  )
}

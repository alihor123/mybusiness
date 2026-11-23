import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./styles/theme.css"
import App from "./App"

// Safari на iOS может разрешить масштабирование вопреки настройке viewport.
function preventMobileZoom(event: Event) {
  if (window.matchMedia("(pointer: coarse)").matches) event.preventDefault()
}

document.addEventListener("gesturestart", preventMobileZoom, { passive: false })
document.addEventListener("gesturechange", preventMobileZoom, { passive: false })

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

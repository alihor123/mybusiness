import { defineConfig, loadEnv } from "vite"
import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import svgr from "vite-plugin-svgr"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_")
  const backendEnv = loadEnv(mode, resolve(process.cwd(), "../backend"), "SIMPLIFIED_REGISTRATION")
  const simplifiedRegistration =
    (process.env.SIMPLIFIED_REGISTRATION ?? backendEnv.SIMPLIFIED_REGISTRATION ?? "true").toLowerCase() ===
    "true"
  const target = env.VITE_API_TARGET || "http://127.0.0.1:8000"
  const proxy = { "/api/v1": { target }, "/media": { target }, "/health": { target } }

  return {
    plugins: [react(), svgr()],
    define: { "import.meta.env.VITE_SIMPLIFIED_REGISTRATION": JSON.stringify(simplifiedRegistration) },
    server: { proxy },
    preview: { proxy },
  }
})

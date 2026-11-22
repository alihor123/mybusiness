import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AppProvider, useApp } from "./contexts/AppContext"
import AppShell from "./components/AppShell/AppShell"
import AuthPage from "./pages/AuthPage/AuthPage"
import DiagnosticTestPage from "./pages/DiagnosticTestPage/DiagnosticTestPage"
import TestResultsPage from "./pages/TestResultsPage/TestResultsPage"
import TracksPage from "./pages/TracksPage/TracksPage"
import TrackLessonPage from "./pages/TrackLessonPage/TrackLessonPage"

// Защищает маршруты кабинета и оборачивает их общей оболочкой.
function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useApp()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <AppShell>{children}</AppShell>
}

// Определяет маршруты приложения и перенаправления по умолчанию.
function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />

      <Route
        path="/learning/test"
        element={<ProtectedShell><DiagnosticTestPage /></ProtectedShell>}
      />
      <Route
        path="/learning/results"
        element={<ProtectedShell><TestResultsPage /></ProtectedShell>}
      />
      <Route
        path="/learning"
        element={<ProtectedShell><TracksPage /></ProtectedShell>}
      />
      <Route
        path="/learning/track/:trackId"
        element={<ProtectedShell><TrackLessonPage /></ProtectedShell>}
      />

      <Route path="*" element={<Navigate to="/learning/test" replace />} />
    </Routes>
  )
}

// Корневой компонент приложения с провайдером мокового состояния и роутером.
export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}

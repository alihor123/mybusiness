import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AppProvider, useApp } from "./contexts/AppContext"
import AppShell from "./components/AppShell/AppShell"
import AuthPage from "./pages/AuthPage/AuthPage"
import DiagnosticTestPage from "./pages/DiagnosticTestPage/DiagnosticTestPage"
import TestResultsPage from "./pages/TestResultsPage/TestResultsPage"
import TracksPage from "./pages/TracksPage/TracksPage"
import TrackLessonPage from "./pages/TrackLessonPage/TrackLessonPage"
import ProjectsPage from "./pages/ProjectsPage/ProjectsPage"
import ProjectBriefPage from "./pages/ProjectBriefPage/ProjectBriefPage"
import MentorMatchingPage from "./pages/MentorMatchingPage/MentorMatchingPage"
import ProjectPlanPage from "./pages/ProjectPlanPage/ProjectPlanPage"
import ProjectTaskPage from "./pages/ProjectTaskPage/ProjectTaskPage"
import MentorsCatalogPage from "./pages/MentorsCatalogPage/MentorsCatalogPage"
import ProfilePage from "./pages/ProfilePage/ProfilePage"
import MentorRequestsPage from "./pages/MentorRequestsPage/MentorRequestsPage"
import MentorProjectsPage from "./pages/MentorProjectsPage/MentorProjectsPage"
import MentorReviewPage from "./pages/MentorReviewPage/MentorReviewPage"

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

      <Route
        path="/projects"
        element={<ProtectedShell><ProjectsPage /></ProtectedShell>}
      />
      <Route
        path="/projects/new"
        element={<ProtectedShell><ProjectBriefPage /></ProtectedShell>}
      />
      <Route
        path="/projects/:projectId/brief"
        element={<ProtectedShell><ProjectBriefPage /></ProtectedShell>}
      />
      <Route
        path="/projects/:projectId/mentors"
        element={<ProtectedShell><MentorMatchingPage /></ProtectedShell>}
      />
      <Route
        path="/projects/:projectId"
        element={<ProtectedShell><ProjectPlanPage /></ProtectedShell>}
      />
      <Route
        path="/projects/:projectId/tasks/:taskId"
        element={<ProtectedShell><ProjectTaskPage /></ProtectedShell>}
      />

      <Route
        path="/mentors"
        element={<ProtectedShell><MentorsCatalogPage /></ProtectedShell>}
      />
      <Route
        path="/profile"
        element={<ProtectedShell><ProfilePage /></ProtectedShell>}
      />

      <Route
        path="/mentor/requests"
        element={<ProtectedShell><MentorRequestsPage /></ProtectedShell>}
      />
      <Route
        path="/mentor/projects"
        element={<ProtectedShell><MentorProjectsPage /></ProtectedShell>}
      />
      <Route
        path="/mentor/projects/:projectId/tasks/:taskId"
        element={<ProtectedShell><MentorReviewPage /></ProtectedShell>}
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

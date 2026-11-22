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

// Защищает маршруты кабинета и оставляет AppShell смонтированным при переходах между экранами.
function ProtectedLayout() {
  const { isAuthenticated } = useApp()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <AppShell />
}

// Определяет маршруты приложения и перенаправления по умолчанию.
function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/learning/test" element={<DiagnosticTestPage />} />
        <Route path="/learning/results" element={<TestResultsPage />} />
        <Route path="/learning" element={<TracksPage />} />
        <Route path="/learning/track/:trackId" element={<TrackLessonPage />} />

        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<ProjectBriefPage />} />
        <Route path="/projects/:projectId/brief" element={<ProjectBriefPage />} />
        <Route path="/projects/:projectId/mentors" element={<MentorMatchingPage />} />
        <Route path="/projects/:projectId" element={<ProjectPlanPage />} />
        <Route path="/projects/:projectId/tasks/:taskId" element={<ProjectTaskPage />} />

        <Route path="/mentors" element={<MentorsCatalogPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        <Route path="/mentor/requests" element={<MentorRequestsPage />} />
        <Route path="/mentor/projects" element={<MentorProjectsPage />} />
        <Route path="/mentor/projects/:projectId/tasks/:taskId" element={<MentorReviewPage />} />
      </Route>

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

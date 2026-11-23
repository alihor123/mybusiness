import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"
import { AppProvider, useApp } from "./contexts/AppContext"
import { ToastProvider } from "./contexts/ToastContext"
import { roleHome, type Role } from "./api/auth"
import { Loader, ResourceError } from "./components/AsyncState/AsyncState"
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
import { LearningCacheProvider, useCachedDiagnostic, useCachedProgress } from "./contexts/LearningCacheContext"

function ProjectAccessLayout() {
  const progress = useCachedProgress()
  if (progress.loading && !progress.data) return <Loader label="Проверяем доступ к проектам" />
  if (progress.error || !progress.data)
    return (
      <ResourceError
        message={progress.error ?? "Не удалось проверить доступ к проектам"}
        retry={progress.reload}
      />
    )
  return progress.data.can_create_project ? <Outlet /> : <Navigate to="/learning" replace />
}

// Защищает маршруты кабинета и сохраняет кэш при переходах между экранами.
function ProtectedLayout() {
  const { session, restoreSession } = useApp()
  const location = useLocation()
  if (session.status === "loading") return <Loader label="Проверяем сессию" />
  if (session.status === "error") return <ResourceError message={session.error} retry={restoreSession} />
  if (session.status === "guest") {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }
  return (
    <LearningCacheProvider key={session.profile?.id}>
      <Outlet />
    </LearningCacheProvider>
  )
}

// Сохраняет внутреннюю ссылку после входа и отсекает переходы в чужой кабинет.
function GuestLayout() {
  const { session } = useApp()
  const location = useLocation()
  if (session.status === "loading") return <Loader label="Проверяем сессию" />
  if (session.status === "ready") {
    const from: unknown = location.state?.from
    const allowed =
      typeof from === "string" &&
      (from === "/profile" ||
        (session.profile.role === "student" && /^\/(learning|projects|mentors)(?:\/|\?|$)/.test(from)) ||
        (session.profile.role === "teacher" && /^\/mentor\//.test(from)))
    return <Navigate to={allowed ? from : roleHome(session.profile.role)} replace />
  }
  return <Outlet />
}

// Проверяет права на прямую ссылку и перенаправляет в кабинет аккаунта.
function RoleLayout({ role }: { role: Role }) {
  const { session } = useApp()
  if (session.status !== "ready") return null
  return session.profile.role === role ? <Outlet /> : <Navigate to={roleHome(session.profile.role)} replace />
}

// На входе в кабинет направляет ученика в тест или к списку треков по статусу диагностики.
function HomeRoute() {
  const { session } = useApp()
  const diagnostic = useCachedDiagnostic(session.status === "ready" && session.profile.role === "student")
  if (session.status !== "ready") return null
  if (session.profile.role === "teacher") return <Navigate to={roleHome(session.profile.role)} replace />
  if (diagnostic.loading) return <Loader label="Проверяем статус входного теста" />
  if (!diagnostic.data)
    return (
      <ResourceError
        message={diagnostic.error ?? "Не удалось загрузить статус входного теста"}
        retry={diagnostic.reload}
      />
    )
  return <Navigate to={diagnostic.data.status === "completed" ? "/learning" : "/learning/test"} replace />
}

// Определяет маршруты приложения и перенаправления по умолчанию.
function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestLayout />}>
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/register" element={<AuthPage key="register" mode="register" />} />
      </Route>

      <Route element={<ProtectedLayout />}>
        <Route element={<AppShell />}>
          <Route element={<RoleLayout role="student" />}>
            <Route path="/learning/test" element={<DiagnosticTestPage />} />
            <Route path="/learning/results" element={<TestResultsPage />} />
            <Route path="/learning" element={<TracksPage />} />
            <Route path="/learning/track/:trackId" element={<TrackLessonPage />} />

            <Route element={<ProjectAccessLayout />}>
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/new" element={<ProjectBriefPage />} />
              <Route path="/projects/:projectId/brief" element={<ProjectBriefPage />} />
              <Route path="/projects/:projectId/mentors" element={<MentorMatchingPage />} />
              <Route path="/projects/:projectId" element={<ProjectPlanPage />} />
              <Route path="/projects/:projectId/tasks/:taskId" element={<ProjectTaskPage />} />
            </Route>

            <Route path="/mentors" element={<MentorsCatalogPage />} />
          </Route>
          <Route path="/profile" element={<ProfilePage />} />

          <Route element={<RoleLayout role="teacher" />}>
            <Route path="/mentor/requests" element={<MentorRequestsPage />} />
            <Route path="/mentor/projects" element={<MentorProjectsPage />} />
            <Route path="/mentor/projects/:projectId/tasks/:taskId" element={<MentorReviewPage />} />
          </Route>
        </Route>
        <Route path="*" element={<HomeRoute />} />
      </Route>
    </Routes>
  )
}

// Подключает сессию, уведомления и маршруты кабинетов.
export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProvider>
    </ToastProvider>
  )
}

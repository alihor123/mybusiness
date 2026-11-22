import { createContext, useContext, useState } from "react"
import type { ReactNode } from "react"
import {
  INITIAL_MENTORS,
  INITIAL_MENTOR_REQUESTS,
  INITIAL_PROFILE,
  INITIAL_PROJECTS,
  INITIAL_TRACKS,
  createBaseTasks,
} from "../data/mockData"
import type {
  LearningTrack,
  Mentor,
  MentorRequest,
  ProjectBrief,
  ProjectFile,
  ProjectItem,
  UserProfile,
  UserRole,
} from "../data/mockData"

type AppContextValue = {
  isAuthenticated: boolean
  role: UserRole
  profile: UserProfile
  testCompleted: boolean
  testSkipped: boolean
  tracks: LearningTrack[]
  mentors: Mentor[]
  projects: ProjectItem[]
  mentorRequests: MentorRequest[]
  accompanimentUnlocked: boolean
  loginMock: (email: string) => void
  registerMock: (data: { firstName: string, lastName: string, email: string }) => void
  logoutMock: () => void
  setRole: (role: UserRole) => void
  updateProfile: (profile: UserProfile) => void
  completeTest: () => void
  skipTest: () => void
  completeTrackStep: (trackId: string, stepId: string) => void
  saveProjectBrief: (projectId: string | null, brief: ProjectBrief) => string
  deleteProject: (projectId: string) => void
  applyToMentor: (projectId: string, mentorId: string) => void
  cancelMentorApplication: (projectId: string) => void
  updateTaskDraft: (projectId: string, taskId: string, answer: string, files: ProjectFile[], aiFeedback: string[]) => void
  submitTaskToMentor: (projectId: string, taskId: string, answer: string, files: ProjectFile[]) => void
  decideMentorRequest: (requestId: string, decision: "accepted" | "rejected") => void
  reviewStudentTask: (projectId: string, taskId: string, decision: "completed" | "rework", comment: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

// Хранит единое моковое состояние платформы для ученика и наставника.
export function AppProvider({ children }: { children: ReactNode }) {
  // Авторизация, роль и профиль пользователя в моковом режиме.
  const [isAuthenticated, setIsAuthenticated] = useState(true)
  const [role, setRole] = useState<UserRole>("student")
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE)

  // Состояние входного тестирования и прохождения учебных треков.
  const [testCompleted, setTestCompleted] = useState(false)
  const [testSkipped, setTestSkipped] = useState(false)
  const [tracks, setTracks] = useState<LearningTrack[]>(INITIAL_TRACKS)

  // Список проектов ученика и заявок, видимых в кабинете наставника.
  const [projects, setProjects] = useState<ProjectItem[]>(INITIAL_PROJECTS)
  const [mentorRequests, setMentorRequests] = useState<MentorRequest[]>(INITIAL_MENTOR_REQUESTS)

  // В моковом режиме раздел проектов доступен сразу, но замок в обучении отражает статус треков.
  const accompanimentUnlocked = tracks.every((track) => track.steps.every((step) => step.completed))

  // Выполняет моковый вход пользователя и обновляет почту в профиле.
  function loginMock(email: string) {
    if (email.trim()) {
      setProfile((prev) => ({ ...prev, email: email.trim() }))
    }
    setIsAuthenticated(true)
  }

  // Сохраняет данные регистрации и авторизует пользователя.
  function registerMock(data: { firstName: string, lastName: string, email: string }) {
    setProfile((prev) => ({
      ...prev,
      firstName: data.firstName.trim() || prev.firstName,
      lastName: data.lastName.trim() || prev.lastName,
      email: data.email.trim() || prev.email,
    }))
    setIsAuthenticated(true)
  }

  // Завершает текущую моковую сессию и возвращает на экран входа.
  function logoutMock() {
    setIsAuthenticated(false)
  }

  // Обновляет личные данные в профиле пользователя.
  function updateProfile(nextProfile: UserProfile) {
    setProfile(nextProfile)
  }

  // Отмечает входной тест завершённым.
  function completeTest() {
    setTestCompleted(true)
    setTestSkipped(false)
  }

  // Отмечает входной тест пропущенным с полным маршрутом обучения.
  function skipTest() {
    setTestSkipped(true)
  }

  // Отмечает конкретный шаг учебного трека выполненным.
  function completeTrackStep(trackId: string, stepId: string) {
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track
        return {
          ...track,
          steps: track.steps.map((step) => (step.id === stepId ? { ...step, completed: true } : step)),
        }
      }),
    )
  }

  // Создаёт новый проект или обновляет анкету существующего и возвращает его id.
  function saveProjectBrief(projectId: string | null, brief: ProjectBrief): string {
    const shortText = brief.value.trim() || brief.problem.trim() || "Новый предпринимательский проект."
    if (projectId) {
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId
            ? { ...project, brief, shortDescription: shortText }
            : project,
        ),
      )
      return projectId
    }

    const newId = `project-${Date.now()}`
    const newProject: ProjectItem = {
      id: newId,
      shortDescription: shortText,
      status: "draft",
      mentorId: null,
      brief,
      tasks: createBaseTasks(),
      meetings: [],
    }
    setProjects((prev) => [newProject, ...prev])
    return newId
  }

  // Удаляет проект из списка ученика.
  function deleteProject(projectId: string) {
    setProjects((prev) => prev.filter((project) => project.id !== projectId))
  }

  // Отправляет заявку выбранному наставнику и переводит проект в ожидание.
  function applyToMentor(projectId: string, mentorId: string) {
    const targetProject = projects.find((item) => item.id === projectId)
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? { ...project, mentorId, status: "pending_mentor" }
          : project,
      ),
    )

    if (!targetProject) return

    setMentorRequests((prev) => {
      const exists = prev.some((req) => req.projectId === projectId && req.status === "pending")
      if (exists) return prev
      const nextReq: MentorRequest = {
        id: `req-${Date.now()}`,
        projectId,
        projectName: targetProject.brief.name,
        authorName: `${profile.firstName} ${profile.lastName}`.trim(),
        industry: targetProject.brief.industry,
        stage: targetProject.brief.stage,
        requestText: targetProject.brief.mentorRequest,
        brief: targetProject.brief,
        status: "pending",
      }
      return [nextReq, ...prev]
    })
  }

  // Отменяет заявку наставнику и возвращает проект в черновик для нового выбора.
  function cancelMentorApplication(projectId: string) {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? { ...project, mentorId: null, status: "draft" }
          : project,
      ),
    )
    setMentorRequests((prev) => prev.filter((req) => req.projectId !== projectId))
  }

  // Сохраняет черновик ответа, файлы и результаты предварительной проверки ИИ.
  function updateTaskDraft(
    projectId: string,
    taskId: string,
    answer: string,
    files: ProjectFile[],
    aiFeedback: string[],
  ) {
    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project
        return {
          ...project,
          tasks: project.tasks.map((task) =>
            task.id === taskId ? { ...task, answer, files, aiFeedback } : task,
          ),
        }
      }),
    )
  }

  // Отправляет выполненную задачу проекта на проверку наставнику.
  function submitTaskToMentor(projectId: string, taskId: string, answer: string, files: ProjectFile[]) {
    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project
        return {
          ...project,
          tasks: project.tasks.map((task) =>
            task.id === taskId ? { ...task, answer, files, status: "review" } : task,
          ),
        }
      }),
    )
  }

  // Принимает или отклоняет заявку ученика в кабинете наставника.
  function decideMentorRequest(requestId: string, decision: "accepted" | "rejected") {
    const targetRequest = mentorRequests.find((req) => req.id === requestId)
    setMentorRequests((prev) =>
      prev.map((req) => (req.id === requestId ? { ...req, status: decision } : req)),
    )
    if (!targetRequest) return

    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== targetRequest.projectId) return project
        if (decision === "accepted") {
          return {
            ...project,
            status: "accompaniment",
            mentorId: project.mentorId ?? INITIAL_MENTORS[0].id,
          }
        }
        return { ...project, status: "draft", mentorId: null }
      }),
    )
  }

  // Сохраняет решение наставника по задаче и открывает следующий шаг при принятии.
  function reviewStudentTask(
    projectId: string,
    taskId: string,
    decision: "completed" | "rework",
    comment: string,
  ) {
    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project
        const currentIndex = project.tasks.findIndex((task) => task.id === taskId)
        return {
          ...project,
          tasks: project.tasks.map((task, index) => {
            if (task.id === taskId) {
              return { ...task, status: decision, mentorComment: comment }
            }
            if (decision === "completed" && index === currentIndex + 1 && task.status === "locked") {
              return { ...task, status: "current" }
            }
            return task
          }),
        }
      }),
    )
  }

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        role,
        profile,
        testCompleted,
        testSkipped,
        tracks,
        mentors: INITIAL_MENTORS,
        projects,
        mentorRequests,
        accompanimentUnlocked,
        loginMock,
        registerMock,
        logoutMock,
        setRole,
        updateProfile,
        completeTest,
        skipTest,
        completeTrackStep,
        saveProjectBrief,
        deleteProject,
        applyToMentor,
        cancelMentorApplication,
        updateTaskDraft,
        submitTaskToMentor,
        decideMentorRequest,
        reviewStudentTask,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

// Возвращает состояние и действия платформы из контекста.
export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error("useApp должен вызываться внутри AppProvider")
  }
  return context
}

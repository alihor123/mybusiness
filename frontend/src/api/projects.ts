import { request } from "./client"
import type { Audience } from "../components/AudienceSelect/AudienceSelect"

export type ProjectStatus = "draft" | "waiting_mentor" | "accompaniment" | "archived"

export type ProjectOut = {
  id: string
  user_id: string
  mentor_id: string | null
  questionnaire_version: number
  archived_at: string | null
  status: ProjectStatus
  title: string | null
  industry: string | null
  stage: string | null
  audience: string | null
  project_audience: Audience
  problem: string | null
  solution_benefit: string | null
  mentor_request: string | null
}

export type ProjectQuestionnaire = Pick<
  ProjectOut,
  "title" | "industry" | "stage" | "project_audience" | "audience" | "problem" | "solution_benefit" | "mentor_request"
>

export type MentorOut = {
  id: string
  stable_key: string
  name: string
  headline: string
  about: string
  experience_label: string
  experience_anchor_year: number
  industry_codes: string[]
  project_stage_codes: string[]
  help_topics: string[]
  meeting_format: string
  bio_sources: string[]
  portrait_url: string
  is_demo: boolean
  accepts_demo_applications: boolean
  active: boolean
}

export type Recommendation = { mentor_id: string, reason: string }
export type ApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn" | "closed_selected_other"
export type ApplicationOut = {
  id: string
  project_id: string
  mentor_id: string
  status: ApplicationStatus
  created_at: string
  decided_at: string | null
  reason: string | null
}

export type ProjectAttachment = { id: string, filename: string, content_type: string, size: number }
export type ProjectSubmission = {
  id: string
  number: number
  request_key: string
  text: string
  status: "submitted" | "revision_requested" | "accepted"
  decision_comment: string | null
  created_at: string
  attachment: ProjectAttachment | null
}

export type ProjectTask = {
  id: string
  position: number
  title: string
  condition: string
  criteria: string[]
  status: "todo" | "submitted" | "revision_requested" | "accepted"
  allowed_actions: Array<"save_draft" | "preview_check" | "submit" | "accept" | "request_revision">
  draft_text: string | null
  draft_attachment: ProjectAttachment | null
  submissions: ProjectSubmission[]
}

export type ProjectPlan = {
  mentor: { id: string, name: string, contacts: Record<string, string> } | null
  project_id: string
  tasks: ProjectTask[]
  next_task_id: string | null
  accepted_count: number
  plan_completed: boolean
}

export type ProjectMeeting = { project_id: string, title: string, starts_at: string, url: string }
export const listProjects = (signal?: AbortSignal) => request<ProjectOut[]>("/projects", { signal })
export const getProject = (id: string, signal?: AbortSignal) =>
  request<ProjectOut>(`/projects/${id}`, { signal })
export const createProject = () => request<ProjectOut>("/projects", { method: "POST" })
export const updateProject = (id: string, body: Partial<ProjectQuestionnaire> & { saved_at_ms?: number }) =>
  request<ProjectOut>(`/projects/${id}`, { method: "PATCH", body })
export const deleteProject = (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" })
export const getMentors = (signal?: AbortSignal) => request<MentorOut[]>("/mentors", { signal })
export type MentorPage = { items: MentorOut[], next_offset: number | null }
export async function searchMentors(
  params: { q: string, industry: string, offset: number },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ q: params.q, industry: params.industry, offset: String(params.offset) })
  return request<MentorPage>(`/mentors/search?${query}`, { signal })
}
export const getMentor = (id: string, signal?: AbortSignal) =>
  request<MentorOut>(`/mentors/${id}`, { signal })
export const getRecommendations = (id: string, questionnaire: ProjectQuestionnaire) =>
  request<{ recommendations: Recommendation[] }>(`/projects/${id}/mentor-recommendations`, {
    method: "POST",
    body: questionnaire,
  })
export const listApplications = (projectId: string, signal?: AbortSignal) =>
  request<ApplicationOut[]>(`/projects/${projectId}/applications`, { signal })
export const applyToMentor = (projectId: string, mentorId: string) =>
  request<ApplicationOut>(`/projects/${projectId}/applications`, {
    method: "POST",
    body: { mentor_id: mentorId },
  })
export const withdrawApplication = (applicationId: string) =>
  request<ApplicationOut>(`/applications/${applicationId}/withdraw`, { method: "POST" })
export const getProjectPlan = (projectId: string, signal?: AbortSignal) =>
  request<ProjectPlan>(`/projects/${projectId}/tasks`, { signal })
export const getProjectMeeting = (projectId: string, signal?: AbortSignal) =>
  request<ProjectMeeting | null>(`/projects/${projectId}/meeting`, { signal })

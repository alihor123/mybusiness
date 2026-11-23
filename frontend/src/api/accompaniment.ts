import { request, requestResponse } from "./client"
import type { ApplicationOut, ProjectMeeting, ProjectOut, ProjectSubmission, ProjectTask } from "./projects"

export type AccompanimentApplication = ApplicationOut & {
  project_title?: string | null
  applicant_name?: string
  industry?: string | null
  stage?: string | null
  mentor_request?: string | null
}

export type ApplicationDetail = ApplicationOut & { project: ProjectOut }

export async function getMentorApplications(signal?: AbortSignal) {
  return request<AccompanimentApplication[]>("/mentor/applications", { signal })
}

export async function getApplication(id: string, signal?: AbortSignal) {
  return request<ApplicationDetail>(`/applications/${id}`, { signal })
}

export async function decideApplication(
  id: string,
  decision: "accept" | "reject",
  questionnaire_version: number,
) {
  return request<AccompanimentApplication>(`/applications/${id}/decision`, {
    method: "POST",
    body: { decision, questionnaire_version },
  })
}

function taskForm(text: string, fileAction: "keep" | "replace" | "remove", file?: File) {
  const body = new FormData()
  body.append("text", text)
  body.append("file_action", fileAction)
  if (file) body.append("file", file)
  return body
}

export async function saveTaskDraft(
  taskId: string,
  text: string,
  fileAction: "keep" | "replace" | "remove",
  file?: File,
) {
  return request<ProjectTask>(`/tasks/${taskId}/draft`, {
    method: "PUT",
    body: taskForm(text, fileAction, file),
  })
}

export async function previewTask(taskId: string, text: string) {
  return request<{ remarks: string[] }>(`/tasks/${taskId}/preview-check`, {
    method: "POST",
    body: { text },
  })
}

export async function submitTask(
  taskId: string,
  text: string,
  requestKey: string,
  fileAction: "keep" | "replace" | "remove",
  file?: File,
) {
  const body = taskForm(text, fileAction, file)
  body.append("request_key", requestKey)
  return request<ProjectTask>(`/tasks/${taskId}/submissions`, { method: "POST", body })
}

export async function decideSubmission(
  submissionId: string,
  decision: "accept" | "revision_requested",
  comment: string,
) {
  return request<{
    submission: ProjectSubmission
    task_status: "accepted" | "revision_requested"
    accepted_count: number
    plan_completed: boolean
  }>(`/submissions/${submissionId}/decision`, {
    method: "POST",
    body: { decision, comment: comment || null },
  })
}

export async function saveMeeting(projectId: string, meeting: Omit<ProjectMeeting, "project_id">) {
  return request<ProjectMeeting>(`/projects/${projectId}/meeting`, { method: "PUT", body: meeting })
}

export async function downloadAttachment(id: string) {
  const response = await requestResponse(`/attachments/${id}`)
  return response.blob()
}

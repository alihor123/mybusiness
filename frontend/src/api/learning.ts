import { request } from "./client"

export type LearningAnswer = string | Record<string, string>
export type DiagnosticQuestion = {
  id: string
  track_id: string
  position: number
  type: "choice" | "matching" | "free"
  prompt: string
  options: {
    choices?: { id: string, text: string }[]
    left?: { id: string, text: string }[]
    right?: { id: string, text: string }[]
  } | null
}
export type DiagnosticResult = {
  track_id: string
  score: number
  max_score: number
  optional_exercises: number
}
export type Diagnostic = {
  status: "not_started" | "in_progress" | "skipped" | "checking" | "completed"
  version: number
  questions: DiagnosticQuestion[]
  current_question_id: string | null
  answers: Record<string, LearningAnswer>
  results: DiagnosticResult[] | null
  check_unavailable: boolean
}
export type TrackStep = {
  id: string
  position: number
  title: string
  type: "theory" | "video" | "choice" | "matching" | "written" | "final"
  optional_by_diagnostic: boolean
  credited: boolean
  can_credit: boolean
  credit_source: "earned" | "diagnostic" | null
}
export type Track = {
  id: string
  title: string
  description: string
  cover_url: string
  position: number
  track_id: string
  required_count: number
  credited_required_count: number
  credited_count: number
  status: "not_started" | "in_progress" | "completed"
  next_required_step_id: string | null
  current_step_id: string
}
export type TrackDetail = Track & { steps: TrackStep[] }
export type LearningProgress = {
  tracks: {
    track_id: string
    required_count: number
    credited_required_count: number
    credited_count: number
    status: Track["status"]
    next_required_step_id: string | null
    current_step_id: string
  }[]
  can_create_project: boolean
  first_project_id: string | null
  draft_project_id: string | null
}
export type LearningBlock =
  | { type: "text", title?: string | null, text: string, is_video_summary?: boolean }
  | { type: "image", url: string, alt: string, caption?: string | null }
  | { type: "video", url: string, poster_url?: string | null }
  | { type: "attachment", url: string, title: string }
  | { type: "diagram", items: { title: string, text: string, icon: string }[] }
  | { type: "examples", items: { title: string, text: string, variant: string }[] }
export type LearningAttempt = {
  id: string
  number: number
  request_key: string
  answer: LearningAnswer
  status: "checking" | "check_unavailable" | "accepted" | "rejected"
  accepted: boolean | null
  remarks: string[]
  prefill_status: string | null
}
export type LearningStep = TrackStep & {
  track_id: string
  blocks: LearningBlock[]
  prompt: string | null
  options: DiagnosticQuestion["options"]
  draft: LearningAnswer | null
  last_attempt: LearningAttempt | null
}
export type TrackBundle = { track: TrackDetail, lessons: LearningStep[] }

export async function fetchDiagnostic(signal: AbortSignal) {
  return request<Diagnostic>("/diagnostic", { signal })
}
type DiagnosticDraft = Pick<Diagnostic, "answers" | "current_question_id"> & { saved_at_ms: number }

export async function saveDiagnosticDraft(data: DiagnosticDraft) {
  return request<Diagnostic>("/diagnostic/draft", { method: "PUT", body: data })
}
export async function skipDiagnostic(body?: DiagnosticDraft) {
  return request<Diagnostic>("/diagnostic/skip", { method: "POST", body })
}
export async function submitDiagnostic(answers: Record<string, LearningAnswer>, saved_at_ms = Date.now()) {
  return request<Diagnostic>("/diagnostic/submit", { method: "POST", body: { answers, saved_at_ms } })
}
export async function restartDiagnostic() {
  return request<Diagnostic>("/diagnostic/restart", { method: "POST" })
}
export async function fetchTracks(signal: AbortSignal) {
  return request<Track[]>("/tracks", { signal })
}
export async function fetchTrack(trackId: string, signal: AbortSignal) {
  return request<TrackDetail>(`/tracks/${encodeURIComponent(trackId)}`, { signal })
}
export async function fetchTrackSteps(trackId: string, signal: AbortSignal) {
  return request<TrackBundle>(`/tracks/${encodeURIComponent(trackId)}/steps`, { signal })
}
export async function fetchLearningStep(stepId: string, signal: AbortSignal) {
  return request<LearningStep>(`/learning/steps/${encodeURIComponent(stepId)}`, { signal })
}
export async function saveLearningDraft(stepId: string, answer: LearningAnswer | null, saved_at_ms = Date.now()) {
  return request<LearningStep>(`/learning/steps/${encodeURIComponent(stepId)}/draft`, {
    method: "PUT",
    body: { answer, saved_at_ms },
  })
}
export async function completeLearningStep(stepId: string, event: "text_end" | "video_end") {
  return request<LearningProgress>(`/learning/steps/${encodeURIComponent(stepId)}/complete`, {
    method: "POST",
    body: { event },
  })
}
export async function submitLearningAnswer(stepId: string, answer: LearningAnswer, request_key: string, saved_at_ms = Date.now()) {
  return request<{ attempt: LearningAttempt, progress: LearningProgress }>(
    `/learning/steps/${encodeURIComponent(stepId)}/submissions`,
    { method: "POST", body: { answer, request_key, saved_at_ms } },
  )
}
export async function requestLearningHelp(stepId: string, question: string, current_input: string) {
  return request<{ hint: string }>(`/learning/steps/${encodeURIComponent(stepId)}/help`, {
    method: "POST",
    body: { question, current_input },
  })
}
export async function fetchLearningProgress(signal: AbortSignal) {
  return request<LearningProgress>("/learning/progress", { signal })
}

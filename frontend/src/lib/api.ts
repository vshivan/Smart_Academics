import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: API_URL });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────
export const getLoginUrl = () => `${API_URL}/auth/login`;
export const getMe = () => api.get("/auth/me").then((r) => r.data);

// ── Syllabus ──────────────────────────────────────────────────
export const uploadSyllabus = (formData: FormData) =>
  api.post("/upload-syllabus", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);

export const getSubjectFiles = (subjectId: string) =>
  api.get(`/subjects/${subjectId}/files`).then((r) => r.data);

// ── Knowledge Graph ───────────────────────────────────────────
export const getKnowledgeGraph = (subjectId: string) =>
  api.get(`/subjects/${subjectId}/knowledge`).then((r) => r.data);

export const getTopics = (subjectId: string) =>
  api.get(`/subjects/${subjectId}/topics`).then((r) => r.data);

// ── Question Papers ───────────────────────────────────────────
export const generatePaper = (config: object) =>
  api.post("/generate-paper", config).then((r) => r.data);

export const getPaper = (paperId: string) =>
  api.get(`/papers/${paperId}`).then((r) => r.data);

export const editQuestion = (paperId: string, questionId: string, data: object) =>
  api.patch(`/papers/${paperId}/questions/${questionId}`, data).then((r) => r.data);

export const finalizePaper = (paperId: string) =>
  api.post(`/papers/${paperId}/finalize`).then((r) => r.data);

// ── Evaluation ────────────────────────────────────────────────
export const startEvaluation = (data: object) =>
  api.post("/evaluate-assignment", data).then((r) => r.data);

export const getEvaluationResults = (sessionId: string) =>
  api.get(`/evaluation/${sessionId}/results`).then((r) => r.data);

export const overrideResult = (sessionId: string, resultId: string, marks: number, feedback: string) =>
  api.patch(`/evaluation/${sessionId}/results/${resultId}/override`, { marks, feedback }).then((r) => r.data);

// ── Analytics ─────────────────────────────────────────────────
export const getAnalytics = (classId: string) =>
  api.get(`/analytics/${classId}`).then((r) => r.data);

export const getPerformance = (classId: string) =>
  api.get(`/analytics/${classId}/performance`).then((r) => r.data);

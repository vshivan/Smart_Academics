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

// ── Management ────────────────────────────────────────────────
export const createCollege = (data: object) =>
  api.post("/colleges", data).then((r) => r.data);
export const listColleges = () =>
  api.get("/colleges").then((r) => r.data);
export const getCollege = (id: string) =>
  api.get(`/colleges/${id}`).then((r) => r.data);
export const createSubject = (collegeId: string, data: object) =>
  api.post(`/colleges/${collegeId}/subjects`, data).then((r) => r.data);
export const listSubjects = (collegeId: string) =>
  api.get(`/colleges/${collegeId}/subjects`).then((r) => r.data);
export const createClass = (collegeId: string, data: object) =>
  api.post(`/colleges/${collegeId}/classes`, data).then((r) => r.data);
export const listClasses = (collegeId: string, subjectId?: string) =>
  api.get(`/colleges/${collegeId}/classes`, { params: subjectId ? { subject_id: subjectId } : {} }).then((r) => r.data);
export const listFaculty = (collegeId: string) =>
  api.get(`/colleges/${collegeId}/faculty`).then((r) => r.data);
export const getHodSummary = (collegeId: string) =>
  api.get(`/colleges/${collegeId}/hod-summary`).then((r) => r.data);
export const createDepartment = (collegeId: string, data: object) =>
  api.post(`/colleges/${collegeId}/departments`, data).then((r) => r.data);
export const listDepartments = (collegeId: string) =>
  api.get(`/colleges/${collegeId}/departments`).then((r) => r.data);
export const createAcademicYear = (collegeId: string, data: object) =>
  api.post(`/colleges/${collegeId}/academic-years`, data).then((r) => r.data);
export const listAcademicYears = (collegeId: string) =>
  api.get(`/colleges/${collegeId}/academic-years`).then((r) => r.data);

// ── Export ────────────────────────────────────────────────────
export const exportPaperPdf = (paperId: string, includeAnswers = false) =>
  api.get(`/papers/${paperId}/export/pdf`, {
    params: { include_answers: includeAnswers },
    responseType: "blob",
  }).then((r) => r.data);

// ── Question Bank ─────────────────────────────────────────────
export const getQuestionBank = (params: object) =>
  api.get("/question-bank", { params }).then((r) => r.data);
export const addToQuestionBank = (data: object) =>
  api.post("/question-bank", data).then((r) => r.data);
export const importFromPaper = (paperId: string) =>
  api.post(`/question-bank/import-from-paper/${paperId}`).then((r) => r.data);

// ── Syllabus Versions ─────────────────────────────────────────
export const getSyllabusVersions = (subjectId: string) =>
  api.get(`/subjects/${subjectId}/syllabus-versions`).then((r) => r.data);
export const restoreVersion = (subjectId: string, versionId: string) =>
  api.post(`/subjects/${subjectId}/syllabus-versions/${versionId}/restore`).then((r) => r.data);

// ── Rubrics ───────────────────────────────────────────────────
export const listRubrics = () =>
  api.get("/rubrics").then((r) => r.data);
export const createRubric = (data: object) =>
  api.post("/rubrics", data).then((r) => r.data);
export const getRubric = (id: string) =>
  api.get(`/rubrics/${id}`).then((r) => r.data);

// ── Notifications ─────────────────────────────────────────────
export const getNotifications = (unreadOnly = false) =>
  api.get("/notifications", { params: { unread_only: unreadOnly } }).then((r) => r.data);
export const markNotificationRead = (id: string) =>
  api.post(`/notifications/${id}/read`).then((r) => r.data);
export const markAllRead = () =>
  api.post("/notifications/read-all").then((r) => r.data);

// ── Plagiarism ────────────────────────────────────────────────
export const checkPlagiarism = (sessionId: string, threshold = 0.75) =>
  api.post(`/plagiarism/check/${sessionId}`, null, { params: { threshold } }).then((r) => r.data);
export const getPlagiarismReport = (sessionId: string) =>
  api.get(`/plagiarism/${sessionId}/report`).then((r) => r.data);

// ── Batch Override ────────────────────────────────────────────
export const batchOverride = (sessionId: string, data: object) =>
  api.post(`/evaluation/${sessionId}/batch-override`, data).then((r) => r.data);

// ── Calibration ───────────────────────────────────────────────
export const calibrateDifficulty = (sessionId: string) =>
  api.post(`/calibrate/${sessionId}`).then((r) => r.data);

// ── Analytics ─────────────────────────────────────────────────
export const getAnalytics = (classId: string) =>
  api.get(`/analytics/${classId}`).then((r) => r.data);

export const getPerformance = (classId: string) =>
  api.get(`/analytics/${classId}/performance`).then((r) => r.data);

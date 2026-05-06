import axios, { type AxiosRequestConfig } from "axios";
import { getToken, clearSession, saveSession, decodeToken, isTokenExpired, type User } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: API_URL });

// ── Request interceptor — attach JWT ─────────────────────────
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor — handle 401 + proactive refresh ────
let _refreshing = false;
let _refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      // If already refreshing, queue this request
      if (_refreshing) {
        return new Promise((resolve) => {
          _refreshQueue.push((newToken: string) => {
            original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
            resolve(api(original));
          });
        });
      }

      _refreshing = true;
      try {
        const resp = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${getToken()}` } }
        );
        const newToken: string = resp.data?.access_token;
        if (newToken) {
          // Decode new token to get updated user info
          const payload = decodeToken(newToken);
          const currentUser = JSON.parse(localStorage.getItem("user") || "{}") as User;
          saveSession(newToken, { ...currentUser, role: (payload?.role as User["role"]) ?? currentUser.role });

          // Flush queued requests
          _refreshQueue.forEach((cb) => cb(newToken));
          _refreshQueue = [];

          // Retry original request
          original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
          return api(original);
        }
      } catch {
        // Refresh failed — clear session and redirect
      } finally {
        _refreshing = false;
      }

      clearSession();
      if (typeof window !== "undefined") {
        window.location.href = "/?session_expired=1";
      }
    }

    return Promise.reject(error);
  }
);

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

// ── Excel export (client-side using CSV → xlsx conversion) ────
export const exportResultsExcel = async (classId: string, sessionId?: string) => {
  const resp = await api.get(`/analytics/${classId}/export/csv`, {
    params: sessionId ? { session_id: sessionId } : {},
    responseType: "text",
  });
  // Convert CSV to downloadable blob
  const blob = new Blob([resp.data], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `results_${classId.slice(0, 8)}_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

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

// ── New Analytics ─────────────────────────────────────────────
export const exportResultsCsv = (classId: string, sessionId?: string) =>
  api.get(`/analytics/${classId}/export/csv`, {
    params: sessionId ? { session_id: sessionId } : {},
    responseType: "blob",
  }).then((r) => r.data);

export const getBloomCoverage = (classId: string) =>
  api.get(`/analytics/${classId}/bloom-coverage`).then((r) => r.data);

export const getStudentRisk = (classId: string, threshold = 40) =>
  api.get(`/analytics/${classId}/student-risk`, { params: { threshold } }).then((r) => r.data);

// ── Student Portal ────────────────────────────────────────────
export const getStudentResults = (googleId: string) =>
  api.get(`/students/${googleId}/results`).then((r) => r.data);

export const getStudentResultDetail = (googleId: string, sessionId: string) =>
  api.get(`/students/${googleId}/results/${sessionId}`).then((r) => r.data);

export const getStudentClasses = (googleId: string) =>
  api.get(`/students/${googleId}/classes`).then((r) => r.data);

// ── Attendance ────────────────────────────────────────────────
export const createAttendanceSession = (data: object) =>
  api.post("/attendance/sessions", data).then((r) => r.data);

export const markAttendance = (sessionId: string, records: object[]) =>
  api.post(`/attendance/sessions/${sessionId}/mark`, records).then((r) => r.data);

export const getAttendance = (classId: string) =>
  api.get(`/attendance/${classId}`).then((r) => r.data);

export const getStudentAttendance = (classId: string, studentId: string) =>
  api.get(`/attendance/${classId}/student/${studentId}`).then((r) => r.data);

// ── Certificates ──────────────────────────────────────────────
export const generateCertificate = (data: object) =>
  api.post("/certificates/generate", data, { responseType: "blob" }).then((r) => r.data);

export const listCertificates = (classId: string) =>
  api.get(`/certificates/${classId}`).then((r) => r.data);

// ── Paper Templates ───────────────────────────────────────────
export const createPaperTemplate = (data: object) =>
  api.post("/paper-templates", data).then((r) => r.data);

export const listPaperTemplates = () =>
  api.get("/paper-templates").then((r) => r.data);

export const getPaperTemplate = (id: string) =>
  api.get(`/paper-templates/${id}`).then((r) => r.data);

// ── Bulk Import ───────────────────────────────────────────────
export const bulkImportStudents = (classId: string, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post(`/bulk-import/${classId}`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);
};

export const listClassStudents = (classId: string) =>
  api.get(`/classes/${classId}/students`).then((r) => r.data);

// ── Comparative Analytics ─────────────────────────────────────
export const compareClasses = (classIds: string[]) =>
  api.get("/analytics/compare", { params: { class_ids: classIds.join(",") } }).then((r) => r.data);

export const getSemesterTrend = (subjectId: string) =>
  api.get(`/analytics/semester-trend/${subjectId}`).then((r) => r.data);

// ── Accreditation ─────────────────────────────────────────────
export const generateAccreditation = (reportType: string, academicYearId?: string) =>
  api.post("/accreditation/generate", null, { params: { report_type: reportType, academic_year_id: academicYearId } }).then((r) => r.data);

export const listAccreditationReports = () =>
  api.get("/accreditation/reports").then((r) => r.data);

// ── Chatbot ───────────────────────────────────────────────────
export const sendChatMessage = (message: string, subjectId?: string, conversationId?: string) =>
  api.post("/chatbot/message", { message, subject_id: subjectId, conversation_id: conversationId }).then((r) => r.data);

// ── Co-Faculty ────────────────────────────────────────────────
export const addCollaborator = (classId: string, facultyId: string, role = "reviewer") =>
  api.post(`/classes/${classId}/collaborators`, { faculty_id: facultyId, role }).then((r) => r.data);

export const listCollaborators = (classId: string) =>
  api.get(`/classes/${classId}/collaborators`).then((r) => r.data);

// ── RBAC ──────────────────────────────────────────────────────
export const checkPermission = (role: string, permission: string) =>
  api.get("/rbac/check", { params: { role, permission } }).then((r) => r.data);

export const getRolePermissions = (role: string) =>
  api.get(`/rbac/permissions/${role}`).then((r) => r.data);

// ── Notifications (email/SMS) ─────────────────────────────────
export const notifyParents = (sessionId: string) =>
  api.post(`/notify/parents/${sessionId}`).then((r) => r.data);

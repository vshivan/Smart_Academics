"use client";
/**
 * Answer Sheet Scanner
 * Upload scanned handwritten answer sheets → OCR → auto-grade.
 * The DB table (scanned_sheets) already exists from migration 002.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Upload, FileText, RefreshCw, CheckCircle, AlertTriangle, Eye } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:    { label: "Pending",    color: "bg-yellow-100 text-yellow-700", icon: RefreshCw },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-700",    icon: RefreshCw },
  done:       { label: "Graded",     color: "bg-green-100 text-green-700",  icon: CheckCircle },
  failed:     { label: "Failed",     color: "bg-red-100 text-red-700",      icon: AlertTriangle },
};

export default function ScannerPage() {
  const { success, error } = useToast();
  const [sessionId, setSessionId] = useState("");
  const [activeSession, setActiveSession] = useState("");
  const [answerKey, setAnswerKey] = useState("");
  const [totalMarks, setTotalMarks] = useState(10);
  const [files, setFiles] = useState<FileList | null>(null);
  const [preview, setPreview] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["scanned-sheets", activeSession],
    queryFn: () => api.get(`/scanner/sessions/${activeSession}/sheets`).then(r => r.data).catch(() => ({ data: { sheets: [] } })),
    enabled: !!activeSession,
    refetchInterval: (query: any) => {
      const sheets = query.state.data?.data?.sheets ?? [];
      return sheets.some((s: any) => s.processing_status === "processing") ? 3000 : false;
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!files || !activeSession) return;
      const results = [];
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("file", files[i]);
        fd.append("session_id", activeSession);
        fd.append("answer_key", answerKey);
        fd.append("total_marks", String(totalMarks));
        const r = await api.post("/scanner/upload", fd);
        results.push(r.data);
      }
      return results;
    },
    onSuccess: () => {
      success("Sheets uploaded!", "OCR processing started in background.");
      refetch();
      setFiles(null);
    },
    onError: () => error("Upload failed", "Check your session ID and try again."),
  });

  const sheets = data?.data?.sheets ?? data?.sheets ?? [];
  const doneCount = sheets.filter((s: any) => s.processing_status === "done").length;
  const avgScore = doneCount > 0
    ? (sheets.filter((s: any) => s.marks_awarded).reduce((a: number, s: any) => a + s.marks_awarded, 0) / doneCount).toFixed(1)
    : "—";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Answer Sheet Scanner</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Upload scanned handwritten answer sheets. OCR extracts text, then auto-grades against your answer key.
        </p>
      </div>

      {/* Session setup */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <h2 className="font-semibold text-sm text-gray-900 mb-4">Session Setup</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Evaluation Session ID</label>
            <div className="flex gap-2">
              <input value={sessionId} onChange={e => setSessionId(e.target.value)}
                placeholder="Paste session ID"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button onClick={() => setActiveSession(sessionId)} disabled={!sessionId}
                className="bg-gray-800 hover:bg-gray-900 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-sm font-medium transition">
                Load
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Total Marks</label>
            <input type="number" value={totalMarks} onChange={e => setTotalMarks(+e.target.value)}
              min={1} max={100}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Answer Key</label>
          <textarea value={answerKey} onChange={e => setAnswerKey(e.target.value)}
            rows={3} placeholder="Paste the model answer here…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Upload Scanned Sheets (JPG/PNG/PDF — multiple allowed)
          </label>
          <input type="file" accept=".jpg,.jpeg,.png,.pdf" multiple
            onChange={e => setFiles(e.target.files)}
            className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          {files && <p className="text-xs text-gray-500 mt-1">{files.length} file(s) selected</p>}
        </div>
        <button onClick={() => upload.mutate()} disabled={!files || !activeSession || !answerKey || upload.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
          {upload.isPending ? <><RefreshCw size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload & Grade</>}
        </button>
      </div>

      {/* Stats */}
      {sheets.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{sheets.length}</div>
            <div className="text-xs text-gray-500">Total Sheets</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{doneCount}</div>
            <div className="text-xs text-gray-500">Graded</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{avgScore}</div>
            <div className="text-xs text-gray-500">Avg Score</div>
          </div>
        </div>
      )}

      {/* Sheets list */}
      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-gray-200 h-16 animate-pulse" />)}
        </div>
      )}

      {!isLoading && sheets.length === 0 && activeSession && (
        <div className="text-center py-12 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No sheets uploaded yet for this session.</p>
        </div>
      )}

      <div className="space-y-2">
        {sheets.map((sheet: any) => {
          const cfg = STATUS_CONFIG[sheet.processing_status] ?? STATUS_CONFIG.pending;
          return (
            <div key={sheet.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <FileText size={14} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {sheet.student_name || sheet.student_id || "Unknown Student"}
                    </p>
                    <p className="text-xs text-gray-400">{sheet.image_path?.split("/").pop()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {sheet.marks_awarded != null && (
                    <span className="text-lg font-bold text-blue-600">
                      {sheet.marks_awarded}<span className="text-xs text-gray-400 font-normal">/{totalMarks}</span>
                    </span>
                  )}
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                    <cfg.icon size={10} className={sheet.processing_status === "processing" ? "animate-spin" : ""} />
                    {cfg.label}
                  </span>
                  {sheet.ocr_text && (
                    <button onClick={() => setPreview(preview?.id === sheet.id ? null : sheet)}
                      className="text-gray-400 hover:text-blue-500 transition">
                      <Eye size={14} />
                    </button>
                  )}
                </div>
              </div>

              {preview?.id === sheet.id && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 mb-1">OCR Extracted Text:</p>
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                    {sheet.ocr_text || "No text extracted"}
                  </p>
                  {sheet.feedback && (
                    <div className="mt-2 bg-blue-50 rounded-lg p-2">
                      <p className="text-xs font-semibold text-blue-700 mb-0.5">Feedback:</p>
                      <p className="text-xs text-blue-800">{sheet.feedback}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

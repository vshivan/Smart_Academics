"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { checkPlagiarism, getPlagiarismReport } from "@/lib/api";
import { AlertTriangle, Search } from "lucide-react";

export default function PlagiarismPage() {
  const [sessionId, setSessionId] = useState("");
  const [activeSession, setActiveSession] = useState("");
  const [threshold, setThreshold] = useState(75);

  const check = useMutation({
    mutationFn: () => checkPlagiarism(sessionId, threshold / 100),
    onSuccess: () => setActiveSession(sessionId),
  });

  const { data: report } = useQuery({
    queryKey: ["plagiarism-report", activeSession],
    queryFn: () => getPlagiarismReport(activeSession),
    enabled: !!activeSession,
  });

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Plagiarism Detection</h1>
      <p className="text-gray-500 text-sm mb-6">Compare student submissions for similarity using TF-IDF cosine analysis.</p>

      <div className="bg-white rounded-xl shadow p-6 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Evaluation Session ID</label>
          <input value={sessionId} onChange={e => setSessionId(e.target.value)}
            placeholder="Paste session ID from Evaluation page"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Similarity Threshold: {threshold}%</label>
          <input type="range" min={50} max={95} step={5} value={threshold}
            onChange={e => setThreshold(+e.target.value)} className="w-full accent-orange-500" />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>50% (loose)</span><span>95% (strict)</span>
          </div>
        </div>
        <button onClick={() => check.mutate()} disabled={!sessionId || check.isPending}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
          <Search size={14} />
          {check.isPending ? "Analyzing..." : "Check for Plagiarism"}
        </button>
      </div>

      {check.data && (
        <div className="bg-white rounded-xl shadow p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className={check.data.flagged > 0 ? "text-orange-500" : "text-green-500"} />
            <span className="font-semibold text-sm">
              {check.data.flagged > 0 ? `${check.data.flagged} suspicious pair(s) found` : "No plagiarism detected ✓"}
            </span>
          </div>
          {check.data.pairs?.map((p: any, i: number) => (
            <div key={i} className="border border-orange-200 bg-orange-50 rounded-lg p-3 mb-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-orange-800">{p.student_a} ↔ {p.student_b}</span>
                <span className="font-bold text-orange-600">{p.similarity}% similar</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {report?.reports?.length > 0 && (
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold mb-3">Full Report</h2>
          <div className="space-y-2">
            {report.reports.map((r: any) => (
              <div key={r.id} className="flex justify-between text-sm border-b pb-2">
                <span>{r.student_a_id} ↔ {r.student_b_id}</span>
                <span className={`font-bold ${r.similarity_score > 85 ? "text-red-500" : "text-orange-500"}`}>
                  {r.similarity_score}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

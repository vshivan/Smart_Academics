"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { startEvaluation, getEvaluationResults, overrideResult } from "@/lib/api";
import { CheckSquare, AlertTriangle, Edit2 } from "lucide-react";

export default function EvaluationPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [overriding, setOverriding] = useState<string | null>(null);
  const { register, handleSubmit } = useForm();

  const start = useMutation({
    mutationFn: startEvaluation,
    onSuccess: (data) => setSessionId(data.session_id),
  });

  const { data: results, refetch } = useQuery({
    queryKey: ["results", sessionId],
    queryFn: () => getEvaluationResults(sessionId!),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const data = query.state.data as any;
      return data?.session?.status === "processing" ? 3000 : false;
    },
  });

  const override = useMutation({
    mutationFn: ({ resultId, marks, feedback }: any) =>
      overrideResult(sessionId!, resultId, marks, feedback),
    onSuccess: () => { setOverriding(null); refetch(); },
  });

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Assignment Evaluation</h1>

      <form
        onSubmit={handleSubmit((d: any) => {
          const keywords = d.keywords
            ? d.keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
            : [];
          start.mutate({ ...d, total_marks: +d.total_marks, keywords });
        })}
        className="bg-white rounded-xl shadow p-6 space-y-4 mb-8"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Class ID</label>
            <input {...register("class_id", { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Coursework ID</label>
            <input {...register("google_coursework_id", { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Assignment Title</label>
            <input {...register("assignment_title", { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Total Marks</label>
            <input {...register("total_marks")} type="number" defaultValue={10} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Answer Key</label>
          <textarea {...register("answer_key", { required: true })} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Keywords (comma-separated)</label>
          <input
            {...register("keywords")}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="normalization, 1NF, 2NF, foreign key"
          />
        </div>
        <button
          type="submit"
          disabled={start.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg"
        >
          {start.isPending ? "Starting..." : "Start Evaluation"}
        </button>
      </form>

      {results && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Results — {results.session?.assignment_title}</h2>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              results.session?.status === "done" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
            }`}>
              {results.session?.status}
            </span>
          </div>

          <div className="space-y-3">
            {results.results?.map((r: any) => (
              <div key={r.id} className={`bg-white rounded-xl border p-4 ${r.needs_review ? "border-orange-300" : ""}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{r.student_name || r.student_google_id}</span>
                      {r.needs_review && <AlertTriangle size={14} className="text-orange-500" />}
                      {r.faculty_override && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Overridden</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{r.feedback}</p>
                    <div className="flex gap-3 mt-2 text-xs text-gray-400">
                      <span>Keywords: {(r.keyword_score * 100).toFixed(0)}%</span>
                      <span>Semantic: {(r.semantic_score * 100).toFixed(0)}%</span>
                      <span>Confidence: {(r.confidence_score * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-blue-600">
                      {r.faculty_override ? r.override_marks : r.marks_awarded}/{r.total_marks}
                    </div>
                    <div className="text-xs text-gray-400">{r.percentage?.toFixed(1)}%</div>
                    <button onClick={() => setOverriding(r.id)} className="mt-1 text-gray-400 hover:text-blue-600">
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>

                {overriding === r.id && (
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      override.mutate({ resultId: r.id, marks: +fd.get("marks")!, feedback: fd.get("feedback") as string });
                    }}
                  >
                    <input name="marks" type="number" step="0.5" defaultValue={r.marks_awarded} className="border rounded px-2 py-1 text-sm w-20" />
                    <input name="feedback" defaultValue={r.feedback} className="border rounded px-2 py-1 text-sm flex-1" />
                    <button type="submit" className="bg-blue-600 text-white text-sm px-3 py-1 rounded">Save</button>
                    <button type="button" onClick={() => setOverriding(null)} className="text-sm px-3 py-1 rounded border">Cancel</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

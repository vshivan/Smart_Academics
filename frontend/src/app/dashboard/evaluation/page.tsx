"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { startEvaluation, getEvaluationResults, overrideResult } from "@/lib/api";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Skeleton";
import { CheckSquare, AlertTriangle, Edit2, RefreshCw, Users } from "lucide-react";

export default function EvaluationPage() {
  const { success, error } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [overriding, setOverriding] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const start = useMutation({
    mutationFn: startEvaluation,
    onSuccess: (data) => {
      setSessionId(data.session_id);
      success("Evaluation started!", "Fetching submissions from Google Classroom...");
    },
    onError: () => error("Failed to start", "Check your Class ID and Coursework ID."),
  });

  const { data: results, refetch, isLoading: resultsLoading } = useQuery({
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
    onSuccess: () => {
      setOverriding(null);
      refetch();
      success("Override saved", "Grade updated successfully.");
    },
    onError: () => error("Override failed", "Please try again."),
  });

  const isProcessing = results?.session?.status === "processing";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Assignment Evaluation</h1>
        <p className="text-gray-500 text-sm mt-0.5">Auto-grade assignments from Google Classroom.</p>
      </div>

      <form
        onSubmit={handleSubmit((d: any) => {
          const keywords = d.keywords
            ? d.keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
            : [];
          start.mutate({ ...d, total_marks: +d.total_marks, keywords });
        })}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 mb-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class ID <span className="text-red-500">*</span></label>
            <input {...register("class_id", { required: "Required" })}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${errors.class_id ? "border-red-400" : "border-gray-300"}`} />
            {errors.class_id && <p className="text-xs text-red-500 mt-1">{errors.class_id.message as string}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coursework ID <span className="text-red-500">*</span></label>
            <input {...register("google_coursework_id", { required: "Required" })}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${errors.google_coursework_id ? "border-red-400" : "border-gray-300"}`} />
            {errors.google_coursework_id && <p className="text-xs text-red-500 mt-1">{errors.google_coursework_id.message as string}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assignment Title <span className="text-red-500">*</span></label>
            <input {...register("assignment_title", { required: "Required" })}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${errors.assignment_title ? "border-red-400" : "border-gray-300"}`} />
            {errors.assignment_title && <p className="text-xs text-red-500 mt-1">{errors.assignment_title.message as string}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
            <input {...register("total_marks", { min: { value: 1, message: "Must be at least 1" } })}
              type="number" defaultValue={10}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Answer Key <span className="text-red-500">*</span></label>
          <textarea {...register("answer_key", { required: "Answer key is required" })} rows={3}
            placeholder="Paste the model answer here..."
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${errors.answer_key ? "border-red-400" : "border-gray-300"}`} />
          {errors.answer_key && <p className="text-xs text-red-500 mt-1">{errors.answer_key.message as string}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Keywords <span className="text-gray-400 font-normal">(comma-separated)</span></label>
          <input {...register("keywords")} placeholder="normalization, 1NF, 2NF, foreign key"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <p className="text-xs text-gray-400 mt-1">Keywords improve grading accuracy. Leave blank to use semantic similarity only.</p>
        </div>

        <button type="submit" disabled={start.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition">
          {start.isPending ? <><RefreshCw size={15} className="animate-spin" /> Starting...</> : "Start Evaluation"}
        </button>
      </form>

      {/* Results */}
      {sessionId && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">{results?.session?.assignment_title ?? "Results"}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {results?.results?.length ?? 0} submissions · {results?.flagged_for_review ?? 0} flagged
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isProcessing && (
                <span className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
                  <RefreshCw size={11} className="animate-spin" /> Processing...
                </span>
              )}
              {results?.session?.status === "done" && (
                <span className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full font-medium">✓ Complete</span>
              )}
            </div>
          </div>

          {resultsLoading && <TableSkeleton rows={4} />}

          {!resultsLoading && results?.results?.length === 0 && (
            <EmptyState icon={Users} title="No submissions yet"
              description="Submissions will appear here as they are processed." />
          )}

          <div className="space-y-2">
            {results?.results?.map((r: any) => (
              <div key={r.id} className={`bg-white rounded-xl border p-4 transition ${r.needs_review ? "border-orange-200 bg-orange-50/30" : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900 truncate">{r.student_name || r.student_google_id}</span>
                      {r.needs_review && (
                        <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={10} /> Review needed
                        </span>
                      )}
                      {r.faculty_override && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Overridden</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.feedback}</p>
                    <div className="flex gap-3 mt-2">
                      {[
                        { label: "Keywords", val: r.keyword_score },
                        { label: "Semantic",  val: r.semantic_score },
                        { label: "Confidence",val: r.confidence_score },
                      ].map(s => (
                        <div key={s.label} className="text-center">
                          <div className="text-xs font-semibold text-gray-700">{(s.val * 100).toFixed(0)}%</div>
                          <div className="text-[10px] text-gray-400">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold text-blue-600">
                      {r.faculty_override ? r.override_marks : r.marks_awarded}
                      <span className="text-sm text-gray-400 font-normal">/{r.total_marks}</span>
                    </div>
                    <div className="text-xs text-gray-400">{r.percentage?.toFixed(1)}%</div>
                    <button onClick={() => setOverriding(overriding === r.id ? null : r.id)}
                      className="mt-1 text-gray-300 hover:text-blue-500 transition">
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>

                {overriding === r.id && (
                  <form className="mt-3 pt-3 border-t border-gray-100 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      override.mutate({ resultId: r.id, marks: +fd.get("marks")!, feedback: fd.get("feedback") as string });
                    }}>
                    <input name="marks" type="number" step="0.5" defaultValue={r.marks_awarded}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <input name="feedback" defaultValue={r.feedback}
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <button type="submit" disabled={override.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-60">
                      {override.isPending ? "..." : "Save"}
                    </button>
                    <button type="button" onClick={() => setOverriding(null)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
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

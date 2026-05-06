"use client";
import { useQuery } from "@tanstack/react-query";
import { getStudentResults } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";

export default function StudentResultsPage() {
  const auth     = useAuth();
  const googleId = auth.payload?.user_id ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["student-results", googleId],
    queryFn:  () => getStudentResults(googleId),
    enabled:  !!googleId,
  });

  const results = data?.data?.results ?? data?.results ?? [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Results</h1>
        <p className="text-gray-500 text-sm mt-0.5">All your evaluated assignments.</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && results.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No results yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {results.map((r: any) => {
          const marks = r.faculty_override ? r.override_marks : r.marks_awarded;
          const pct   = r.percentage ?? 0;
          const grade = pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 45 ? "C" : "D";
          const gradeColor = pct >= 75 ? "text-green-600" : pct >= 60 ? "text-blue-600" : pct >= 45 ? "text-orange-500" : "text-red-500";

          return (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm text-gray-900">{r.assignment_title}</span>
                    {r.needs_review && (
                      <span className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                        <AlertTriangle size={9} /> Under review
                      </span>
                    )}
                    {r.faculty_override && (
                      <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">
                        Adjusted
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{r.class_name} · {r.subject_name}</p>
                  {r.feedback && (
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed border-l-2 border-gray-200 pl-2">
                      {r.feedback}
                    </p>
                  )}
                  <div className="flex gap-4 mt-2">
                    {[
                      { label: "Keywords", val: r.keyword_score },
                      { label: "Semantic",  val: r.semantic_score },
                      { label: "Confidence",val: r.confidence_score },
                    ].map(s => s.val != null && (
                      <div key={s.label} className="text-center">
                        <div className="text-xs font-semibold text-gray-600">{(s.val * 100).toFixed(0)}%</div>
                        <div className="text-[10px] text-gray-400">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-bold text-gray-900">
                    {marks}<span className="text-sm text-gray-400 font-normal">/{r.total_marks}</span>
                  </div>
                  <div className={`text-lg font-bold ${gradeColor}`}>{grade}</div>
                  <div className="text-xs text-gray-400">{pct?.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

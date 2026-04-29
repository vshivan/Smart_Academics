"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBloomCoverage, getStudentRisk } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { Brain, AlertTriangle, TrendingDown } from "lucide-react";

const BLOOMS_COLORS: Record<string, string> = {
  remember:   "bg-gray-200 text-gray-700",
  understand: "bg-blue-200 text-blue-700",
  apply:      "bg-green-200 text-green-700",
  analyze:    "bg-yellow-200 text-yellow-700",
  evaluate:   "bg-orange-200 text-orange-700",
  create:     "bg-purple-200 text-purple-700",
};
const BLOOMS_EMOJI: Record<string, string> = {
  remember:"🧠",understand:"💡",apply:"🔧",analyze:"🔍",evaluate:"⚖️",create:"✨"
};

export default function BloomReportPage() {
  const [classId, setClassId] = useState("");
  const [activeClass, setActiveClass] = useState("");
  const [threshold, setThreshold] = useState(40);

  const { data: coverage, isLoading: covLoading } = useQuery({
    queryKey: ["bloom-coverage", activeClass],
    queryFn: () => getBloomCoverage(activeClass),
    enabled: !!activeClass,
  });

  const { data: risk, isLoading: riskLoading } = useQuery({
    queryKey: ["student-risk", activeClass, threshold],
    queryFn: () => getStudentRisk(activeClass, threshold),
    enabled: !!activeClass,
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Bloom's Coverage & Risk Report</h1>
        <p className="text-gray-500 text-sm mt-0.5">See which Bloom's levels you're testing and which students are at risk.</p>
      </div>

      <div className="flex gap-2 mb-6">
        <input value={classId} onChange={e => setClassId(e.target.value)}
          placeholder="Class ID" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <button onClick={() => setActiveClass(classId)} disabled={!classId}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          Load
        </button>
      </div>

      {/* Bloom's Coverage */}
      {covLoading && <CardSkeleton />}
      {coverage && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Brain size={16} /> Bloom's Coverage</h2>
            <div className={`text-sm font-bold px-3 py-1 rounded-full ${coverage.coverage_score >= 80 ? "bg-green-100 text-green-700" : coverage.coverage_score >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>
              {coverage.coverage_score}% covered
            </div>
          </div>

          {coverage.missing_levels?.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-sm text-orange-700">
              ⚠️ Missing levels: <strong>{coverage.missing_levels.join(", ")}</strong>. Consider adding questions at these levels.
            </div>
          )}

          <div className="space-y-3">
            {Object.entries(coverage.coverage || {}).map(([level, data]: [string, any]) => (
              <div key={level} className="flex items-center gap-3">
                <span className="w-28 text-xs font-medium text-gray-600">{BLOOMS_EMOJI[level]} {level}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${data.count > 0 ? "bg-blue-500" : "bg-gray-200"}`}
                    style={{ width: `${data.percentage}%` }} />
                </div>
                <span className="w-12 text-right text-xs font-bold text-gray-700">{data.percentage}%</span>
                <span className="w-16 text-right text-xs text-gray-400">{data.count} Qs</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Total questions analyzed: {coverage.total_questions}</p>
        </div>
      )}

      {/* At-Risk Students */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><AlertTriangle size={16} className="text-orange-500" /> At-Risk Students</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Threshold:</span>
            <input type="number" value={threshold} onChange={e => setThreshold(+e.target.value)}
              min={10} max={80} className="w-16 border border-gray-300 rounded px-2 py-1 text-xs" />
            <span className="text-xs text-gray-500">%</span>
          </div>
        </div>

        {riskLoading && <CardSkeleton />}
        {risk && risk.at_risk_count === 0 && (
          <div className="text-center py-8 text-green-600">
            <p className="text-2xl mb-2">🎉</p>
            <p className="font-semibold">No at-risk students!</p>
            <p className="text-sm text-gray-500">All students are above {threshold}% average.</p>
          </div>
        )}
        {risk && risk.at_risk_count > 0 && (
          <>
            <p className="text-sm text-orange-600 mb-3 font-medium">{risk.at_risk_count} students below {threshold}% average</p>
            <div className="space-y-2">
              {risk.students?.map((s: any) => (
                <div key={s.student_google_id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.student_name || s.student_google_id}</p>
                    <p className="text-xs text-gray-400">{s.student_email} · {s.submission_count} submissions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-500">{Math.round(s.avg_score)}%</p>
                    <p className="text-xs text-gray-400">Lowest: {Math.round(s.lowest_score)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {!activeClass && (
          <EmptyState icon={TrendingDown} title="Enter a Class ID" description="Load a class to see at-risk students." />
        )}
      </div>
    </div>
  );
}

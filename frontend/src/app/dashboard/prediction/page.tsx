"use client";
/**
 * Student Performance Prediction
 * Uses past evaluation data to predict which students are likely to fail.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getStudentRisk } from "@/lib/api";
import { TrendingDown, TrendingUp, AlertTriangle, Users, Brain, Download } from "lucide-react";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell,
} from "recharts";

const RISK_LEVELS = [
  { label: "High Risk",    min: 0,  max: 40,  color: "#ef4444", bg: "bg-red-50 border-red-200" },
  { label: "Medium Risk",  min: 40, max: 60,  color: "#f97316", bg: "bg-orange-50 border-orange-200" },
  { label: "Low Risk",     min: 60, max: 75,  color: "#eab308", bg: "bg-yellow-50 border-yellow-200" },
  { label: "On Track",     min: 75, max: 100, color: "#22c55e", bg: "bg-green-50 border-green-200" },
];

function getRiskLevel(score: number) {
  return RISK_LEVELS.find(r => score >= r.min && score < r.max) ?? RISK_LEVELS[3];
}

export default function PredictionPage() {
  const [classId, setClassId] = useState("");
  const [activeClass, setActiveClass] = useState("");
  const [threshold, setThreshold] = useState(60);

  const { data: riskData, isLoading } = useQuery({
    queryKey: ["student-risk", activeClass, threshold],
    queryFn: () => getStudentRisk(activeClass, threshold),
    enabled: !!activeClass,
  });

  const { data: allStudentsData } = useQuery({
    queryKey: ["all-students-perf", activeClass],
    queryFn: () => api.get(`/analytics/${activeClass}/student-performance`).then(r => r.data).catch(() => null),
    enabled: !!activeClass,
  });

  const atRisk = riskData?.data?.students ?? riskData?.students ?? [];
  const atRiskCount = riskData?.data?.at_risk_count ?? riskData?.at_risk_count ?? 0;

  // Build scatter data from at-risk students
  const scatterData = atRisk.map((s: any) => ({
    x: s.submission_count,
    y: parseFloat(s.avg_score),
    name: s.student_name || s.student_google_id,
    risk: getRiskLevel(parseFloat(s.avg_score)),
  }));

  function exportCSV() {
    const rows = [["Student", "Email", "Avg Score", "Submissions", "Lowest Score", "Risk Level"]];
    atRisk.forEach((s: any) => {
      const risk = getRiskLevel(parseFloat(s.avg_score));
      rows.push([s.student_name || s.student_google_id, s.student_email || "", s.avg_score, s.submission_count, s.lowest_score, risk.label]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `at_risk_${activeClass}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const riskCounts = RISK_LEVELS.map(level => ({
    ...level,
    count: atRisk.filter((s: any) => {
      const score = parseFloat(s.avg_score);
      return score >= level.min && score < level.max;
    }).length,
  }));

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Performance Prediction</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Identify at-risk students early using past evaluation data.
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <input value={classId} onChange={e => setClassId(e.target.value)}
          onKeyDown={e => e.key === "Enter" && setActiveClass(classId)}
          placeholder="Enter Class ID"
          className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-white">
          <span className="text-xs text-gray-500">Threshold:</span>
          <input type="number" min={20} max={80} value={threshold}
            onChange={e => setThreshold(+e.target.value)}
            className="w-12 text-sm font-semibold text-center focus:outline-none" />
          <span className="text-xs text-gray-500">%</span>
        </div>
        <button onClick={() => setActiveClass(classId)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          Analyze
        </button>
        {atRisk.length > 0 && (
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm transition">
            <Download size={14} /> Export
          </button>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-xl border border-gray-200 h-20 animate-pulse" />)}
        </div>
      )}

      {!isLoading && activeClass && (
        <>
          {/* Risk distribution */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {riskCounts.map(r => (
              <div key={r.label} className={`rounded-xl border p-4 text-center ${r.bg}`}>
                <div className="text-2xl font-bold" style={{ color: r.color }}>{r.count}</div>
                <div className="text-xs font-semibold mt-0.5" style={{ color: r.color }}>{r.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{r.min}–{r.max}%</div>
              </div>
            ))}
          </div>

          {atRisk.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <TrendingUp size={40} className="mx-auto mb-3 text-green-400 opacity-60" />
              <p className="text-sm font-semibold text-green-600">All students are above {threshold}%</p>
              <p className="text-xs mt-1">No intervention needed at this threshold.</p>
            </div>
          ) : (
            <>
              {/* Scatter plot */}
              {scatterData.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
                  <h2 className="font-semibold text-sm text-gray-900 mb-1">Score vs Submissions</h2>
                  <p className="text-xs text-gray-400 mb-4">Students below the threshold line need intervention.</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <ScatterChart margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="x" name="Submissions" label={{ value: "Submissions", position: "insideBottom", offset: -10, fontSize: 11 }} tick={{ fontSize: 10 }} />
                      <YAxis dataKey="y" name="Avg Score" domain={[0, 100]} label={{ value: "Avg %", angle: -90, position: "insideLeft", fontSize: 11 }} tick={{ fontSize: 10 }} />
                      <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `${threshold}% threshold`, fontSize: 10, fill: "#ef4444" }} />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                        if (!payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white border border-gray-200 rounded-lg p-2 text-xs shadow">
                            <p className="font-semibold">{d.name}</p>
                            <p>Avg: {d.y.toFixed(1)}%</p>
                            <p>Submissions: {d.x}</p>
                          </div>
                        );
                      }} />
                      <Scatter data={scatterData} fill="#ef4444">
                        {scatterData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.risk.color} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* At-risk student list */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-sm text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle size={15} className="text-orange-500" />
                  At-Risk Students ({atRiskCount})
                </h2>
                <div className="space-y-2">
                  {atRisk.map((s: any) => {
                    const risk = getRiskLevel(parseFloat(s.avg_score));
                    return (
                      <div key={s.student_google_id} className={`flex items-center justify-between p-3 rounded-xl border ${risk.bg}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{s.student_name || s.student_google_id}</p>
                          <p className="text-xs text-gray-400">{s.student_email} · {s.submission_count} submissions</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="text-xl font-bold" style={{ color: risk.color }}>
                            {parseFloat(s.avg_score).toFixed(1)}%
                          </p>
                          <p className="text-[10px] font-semibold" style={{ color: risk.color }}>{risk.label}</p>
                          <p className="text-[10px] text-gray-400">Lowest: {parseFloat(s.lowest_score).toFixed(1)}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {!activeClass && (
        <div className="text-center py-16 text-gray-400">
          <Brain size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Enter a Class ID to analyze student performance.</p>
          <p className="text-xs mt-1">Requires completed evaluation sessions.</p>
        </div>
      )}
    </div>
  );
}

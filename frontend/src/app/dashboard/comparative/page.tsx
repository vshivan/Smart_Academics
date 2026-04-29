"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { compareClasses, getSemesterTrend } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { TrendingUp, Plus, X, RefreshCw } from "lucide-react";

const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6"];

export default function ComparativePage() {
  const { error: toastError } = useToast();
  const [classIds, setClassIds] = useState<string[]>(["", ""]);
  const [subjectId, setSubjectId] = useState("");
  const [compareResult, setCompareResult] = useState<any>(null);
  const [trendResult, setTrendResult] = useState<any>(null);

  const compare = useMutation({
    mutationFn: () => compareClasses(classIds.filter(Boolean)),
    onSuccess: setCompareResult,
    onError: () => toastError("Comparison failed", "Check your Class IDs."),
  });

  const trend = useMutation({
    mutationFn: () => getSemesterTrend(subjectId),
    onSuccess: setTrendResult,
    onError: () => toastError("Failed to load trend"),
  });

  const chartData = compareResult?.comparison?.map((c: any) => ({
    name: c.class_name,
    "Avg Score": Math.round(c.avg_score || 0),
    "Submissions": c.total_submissions,
  })) ?? [];

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Comparative Analytics</h1>
        <p className="text-gray-500 text-sm mt-0.5">Compare performance across classes and semesters.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Class comparison */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Class vs Class</h2>
          <div className="space-y-2 mb-3">
            {classIds.map((id, i) => (
              <div key={i} className="flex gap-2">
                <input value={id} onChange={e => setClassIds(prev => prev.map((v,j) => j===i ? e.target.value : v))}
                  placeholder={`Class ID ${i+1}`} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                {classIds.length > 2 && (
                  <button onClick={() => setClassIds(prev => prev.filter((_,j) => j!==i))} className="text-gray-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setClassIds(p => [...p, ""])} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Plus size={11} /> Add class
            </button>
          </div>
          <button onClick={() => compare.mutate()} disabled={compare.isPending || classIds.filter(Boolean).length < 2}
            className="w-full mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
            {compare.isPending ? <><RefreshCw size={13} className="animate-spin" /> Comparing...</> : "Compare Classes"}
          </button>
        </div>

        {/* Semester trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Semester Trend</h2>
          <input value={subjectId} onChange={e => setSubjectId(e.target.value)}
            placeholder="Subject ID" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <button onClick={() => trend.mutate()} disabled={trend.isPending || !subjectId}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
            {trend.isPending ? <><RefreshCw size={13} className="animate-spin" /> Loading...</> : <><TrendingUp size={13} /> Load Trend</>}
          </button>
        </div>
      </div>

      {/* Class comparison chart */}
      {compareResult && chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Class Comparison — Average Scores</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Avg Score" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {compareResult.comparison.map((c: any, i: number) => (
              <div key={i} className="text-center bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 truncate">{c.class_name}</p>
                <p className="text-xl font-bold" style={{ color: COLORS[i % COLORS.length] }}>{Math.round(c.avg_score || 0)}%</p>
                <p className="text-xs text-gray-400">{c.total_submissions} submissions</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Semester trend chart */}
      {trendResult && trendResult.trend?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Performance Across Semesters</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trendResult.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => [`${Math.round(v)}%`, "Avg Score"]} />
              <Bar dataKey="avg_score" fill="#10b981" radius={[4,4,0,0]} label={{ position: "top", fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

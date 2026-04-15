"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAnalytics, getPerformance } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

export default function AnalyticsPage() {
  const [classId, setClassId] = useState("");
  const [activeClassId, setActiveClassId] = useState("");

  const { data: analytics } = useQuery({
    queryKey: ["analytics", activeClassId],
    queryFn: () => getAnalytics(activeClassId),
    enabled: !!activeClassId,
  });

  const { data: performance } = useQuery({
    queryKey: ["performance", activeClassId],
    queryFn: () => getPerformance(activeClassId),
    enabled: !!activeClassId,
  });

  const distData = performance
    ? Object.entries(performance.score_distribution).map(([range, count]) => ({ range, count }))
    : [];

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Analytics Dashboard</h1>

      <div className="flex gap-3 mb-8">
        <input
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          placeholder="Enter Class ID"
          className="border rounded-lg px-3 py-2 text-sm flex-1"
        />
        <button
          onClick={() => setActiveClassId(classId)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Load
        </button>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {analytics.sessions?.map((s: any) => (
            <div key={s.session_id} className="bg-white rounded-xl shadow p-5">
              <h3 className="font-semibold text-sm mb-3 truncate">{s.assignment_title}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Submissions</span><span>{s.total_submissions}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Average</span><span className="font-medium">{s.average_score}%</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Highest</span><span className="text-green-600">{s.highest_score}%</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Lowest</span><span className="text-red-500">{s.lowest_score}%</span></div>
                {s.flagged_count > 0 && (
                  <div className="flex justify-between"><span className="text-orange-500">Needs Review</span><span>{s.flagged_count}</span></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {performance && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold mb-4">Score Distribution</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={distData} dataKey="count" nameKey="range" cx="50%" cy="50%" outerRadius={80} label>
                  {distData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold mb-4">Assignment Trends</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={performance.assignment_trends}>
                <XAxis dataKey="assignment" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="average" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

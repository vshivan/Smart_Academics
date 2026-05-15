"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAnalytics, getPerformance, listClasses, listColleges } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, Users } from "lucide-react";

const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

function StatCard({
  label, value, sub, trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && (
        <p className={`text-xs mt-1 flex items-center gap-1 ${
          trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-gray-400"
        }`}>
          {trend === "up" && <TrendingUp size={11} />}
          {trend === "down" && <TrendingDown size={11} />}
          {sub}
        </p>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const auth = useAuth();
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [autoSelected, setAutoSelected] = useState(false);

  // Fallback: get college from DB if not in JWT
  const { data: collegesData } = useQuery({
    queryKey: ["colleges-analytics"],
    queryFn: listColleges,
    enabled: !auth.collegeId,
  });

  const collegeId: string =
    auth.collegeId ||
    (collegesData?.data?.colleges ?? collegesData?.colleges ?? [])[0]?.id ||
    "";

  // Load classes for the college
  const { data: classesData } = useQuery({
    queryKey: ["classes-analytics", collegeId],
    queryFn: () => listClasses(collegeId),
    enabled: !!collegeId,
  });

  const classes: any[] = classesData?.data?.classes ?? classesData?.classes ?? [];

  // Auto-select first class once
  useEffect(() => {
    if (!autoSelected && classes.length > 0) {
      setSelectedClassId(classes[0].id);
      setAutoSelected(true);
    }
  }, [classes, autoSelected]);

  // Analytics data
  const { data: analyticsRaw, isLoading: aLoading } = useQuery({
    queryKey: ["analytics", selectedClassId],
    queryFn: () => getAnalytics(selectedClassId),
    enabled: !!selectedClassId,
  });

  const { data: perfRaw, isLoading: pLoading } = useQuery({
    queryKey: ["performance", selectedClassId],
    queryFn: () => getPerformance(selectedClassId),
    enabled: !!selectedClassId,
  });

  const isLoading = aLoading || pLoading;

  // Handle both enveloped {success,data} and raw responses
  const analytics   = analyticsRaw?.data  ?? analyticsRaw;
  const performance = perfRaw?.data ?? perfRaw;

  const distData = performance?.score_distribution
    ? Object.entries(performance.score_distribution).map(([range, count]) => ({ range, count }))
    : [];

  const allSessions: any[] = analytics?.sessions ?? [];
  const totalSubmissions = allSessions.reduce((a: number, s: any) => a + (s.total_submissions ?? 0), 0);
  const avgScore = allSessions.length
    ? Math.round(allSessions.reduce((a: number, s: any) => a + (s.average_score ?? 0), 0) / allSessions.length)
    : 0;
  const totalFlagged = allSessions.reduce((a: number, s: any) => a + (s.flagged_count ?? 0), 0);

  const selectedClass = classes.find((c: any) => c.id === selectedClassId);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Track student performance and submission trends.</p>
      </div>

      {/* Class selector dropdown */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        {classes.length > 0 ? (
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          >
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.subject_name ? ` — ${c.subject_name}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-gray-400 border border-gray-200 rounded-lg px-3 py-2 flex-1">
            {collegeId ? "Loading classes…" : "Complete College Setup first to see analytics"}
          </p>
        )}
        {selectedClass && (
          <span className="text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg font-medium">
            {selectedClass.student_count ?? 0} students
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
          </div>
          <CardSkeleton />
        </div>
      )}

      {/* No data */}
      {!isLoading && selectedClassId && allSessions.length === 0 && (
        <EmptyState
          icon={BarChart2}
          title="No evaluation data yet"
          description="Run an evaluation session for this class to see analytics."
        />
      )}

      {/* No class */}
      {!selectedClassId && !isLoading && (
        <EmptyState
          icon={BarChart2}
          title="Select a class"
          description="Choose a class from the dropdown above to view analytics."
        />
      )}

      {/* Content */}
      {!isLoading && allSessions.length > 0 && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Sessions" value={allSessions.length} />
            <StatCard
              label="Total Submissions" value={totalSubmissions}
              sub="across all sessions" trend="neutral"
            />
            <StatCard
              label="Average Score" value={`${avgScore}%`}
              sub={avgScore >= 60 ? "Above passing" : "Below passing"}
              trend={avgScore >= 60 ? "up" : "down"}
            />
            <StatCard
              label="Flagged for Review" value={totalFlagged}
              sub={totalFlagged > 0 ? "Need attention" : "All clear"}
              trend={totalFlagged > 0 ? "down" : "up"}
            />
          </div>

          {/* Session cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {allSessions.map((s: any) => (
              <div key={s.session_id} className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-sm text-gray-900 truncate mb-3">
                  {s.assignment_title}
                </h3>
                <div className="space-y-1.5">
                  {[
                    { label: "Submissions", value: s.total_submissions,   color: "text-gray-700" },
                    { label: "Average",     value: `${s.average_score}%`, color: "text-blue-600 font-semibold" },
                    { label: "Highest",     value: `${s.highest_score}%`, color: "text-green-600" },
                    { label: "Lowest",      value: `${s.lowest_score}%`,  color: "text-red-500" },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between text-xs">
                      <span className="text-gray-500">{row.label}</span>
                      <span className={row.color}>{row.value}</span>
                    </div>
                  ))}
                  {s.flagged_count > 0 && (
                    <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-lg mt-2">
                      <AlertTriangle size={10} /> {s.flagged_count} need review
                    </div>
                  )}
                </div>
                <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(s.average_score ?? 0, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          {performance && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-sm text-gray-900 mb-4">Score Distribution</h2>
                {distData.every((d) => (d.count as number) === 0) ? (
                  <EmptyState icon={Users} title="No data" description="No scores recorded yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={distData} dataKey="count" nameKey="range"
                        cx="50%" cy="50%" outerRadius={75} innerRadius={35} paddingAngle={2}
                      >
                        {distData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`${v} students`, "Count"]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-sm text-gray-900 mb-4">Assignment Trends</h2>
                {!performance.assignment_trends?.length ? (
                  <EmptyState icon={TrendingUp} title="No trends yet" description="Complete more evaluations." />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={performance.assignment_trends}
                      margin={{ top: 5, right: 5, bottom: 20, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="assignment" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => [`${v}%`, "Average"]} />
                      <Bar dataKey="average" fill="#3b82f6" radius={[4, 4, 0, 0]}
                        label={{ position: "top", fontSize: 10, fill: "#6b7280" }} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

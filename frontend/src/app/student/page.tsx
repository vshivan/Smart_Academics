"use client";
import { useQuery } from "@tanstack/react-query";
import { getStudentResults, getStudentClasses } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { BarChart2, BookOpen, TrendingUp, AlertTriangle } from "lucide-react";

export default function StudentOverviewPage() {
  const auth = useAuth();
  const googleId = auth.payload?.user_id ?? "";

  const { data: resultsData, isLoading } = useQuery({
    queryKey: ["student-results", googleId],
    queryFn: () => getStudentResults(googleId),
    enabled: !!googleId,
  });

  const { data: classesData } = useQuery({
    queryKey: ["student-classes", googleId],
    queryFn: () => getStudentClasses(googleId),
    enabled: !!googleId,
  });

  // Handle both raw and enveloped responses
  const summary = resultsData?.data?.summary ?? resultsData?.summary;
  const classes  = classesData?.data?.classes  ?? classesData?.classes ?? [];

  const stats = [
    {
      label: "Assignments",
      value: summary?.total_assignments ?? 0,
      icon: BookOpen,
      color: "blue",
    },
    {
      label: "Average Score",
      value: summary?.average_score ? `${summary.average_score}%` : "—",
      icon: TrendingUp,
      color: "green",
    },
    {
      label: "Highest Score",
      value: summary?.highest_score ? `${summary.highest_score}%` : "—",
      icon: BarChart2,
      color: "purple",
    },
    {
      label: "Classes Enrolled",
      value: classes.length,
      icon: BookOpen,
      color: "orange",
    },
  ];

  const colorMap: Record<string, string> = {
    blue:   "bg-blue-50 text-blue-700",
    green:  "bg-green-50 text-green-700",
    purple: "bg-purple-50 text-purple-700",
    orange: "bg-orange-50 text-orange-700",
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          Welcome back, {auth.user?.name?.split(" ")[0] ?? "Student"} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Here's your academic overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colorMap[s.color]}`}>
              <s.icon size={16} />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {isLoading ? <span className="animate-pulse bg-gray-200 rounded w-12 h-6 block" /> : s.value}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Classes */}
      {classes.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Your Classes</h2>
          <div className="space-y-2">
            {classes.map((c: any) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.subject_name} · {c.submission_count} submissions</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">
                    {c.avg_score ? `${parseFloat(c.avg_score).toFixed(1)}%` : "—"}
                  </div>
                  <div className="text-[10px] text-gray-400">avg score</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && classes.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No results yet. Your grades will appear here once your faculty evaluates assignments.</p>
        </div>
      )}
    </div>
  );
}

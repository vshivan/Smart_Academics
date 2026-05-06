"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStudentAttendance, getStudentClasses } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { CalendarCheck } from "lucide-react";

export default function StudentAttendancePage() {
  const auth     = useAuth();
  const googleId = auth.payload?.user_id ?? "";
  const [selectedClass, setSelectedClass] = useState<string>("");

  const { data: classesData } = useQuery({
    queryKey: ["student-classes", googleId],
    queryFn:  () => getStudentClasses(googleId),
    enabled:  !!googleId,
  });
  const classes = classesData?.data?.classes ?? classesData?.classes ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["student-attendance", selectedClass, googleId],
    queryFn:  () => getStudentAttendance(selectedClass, googleId),
    enabled:  !!selectedClass && !!googleId,
  });

  const attendance = data?.data ?? data;
  const records    = attendance?.records ?? [];
  const pct        = attendance?.attendance_pct ?? 0;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
        <p className="text-gray-500 text-sm mt-0.5">Your attendance record by class.</p>
      </div>

      {/* Class selector */}
      <div className="mb-6">
        <select
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 w-full sm:w-64"
        >
          <option value="">Select a class…</option>
          {classes.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name} — {c.subject_name}</option>
          ))}
        </select>
      </div>

      {selectedClass && attendance && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total Sessions", value: attendance.total },
              { label: "Present",        value: attendance.present },
              { label: "Attendance %",   value: `${pct}%` },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className={`text-2xl font-bold ${s.label === "Attendance %" && pct < 75 ? "text-red-500" : "text-gray-900"}`}>
                  {s.value}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {pct < 75 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
              ⚠️ Your attendance is below 75%. Please attend more classes.
            </div>
          )}

          {/* Records */}
          <div className="space-y-2">
            {records.map((r: any, i: number) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-700">{r.session_date}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  r.status === "present" ? "bg-green-100 text-green-700" :
                  r.status === "late"    ? "bg-yellow-100 text-yellow-700" :
                                           "bg-red-100 text-red-700"
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {!selectedClass && (
        <div className="text-center py-16 text-gray-400">
          <CalendarCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a class to view attendance.</p>
        </div>
      )}
    </div>
  );
}

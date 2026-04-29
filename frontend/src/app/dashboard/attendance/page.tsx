"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { getAttendance, createAttendanceSession, markAttendance, listClassStudents } from "@/lib/api";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { CalendarCheck, Plus, Users, RefreshCw, CheckCircle, XCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-700",
  absent:  "bg-red-100 text-red-700",
  late:    "bg-yellow-100 text-yellow-700",
  excused: "bg-blue-100 text-blue-700",
};

export default function AttendancePage() {
  const { success, error: toastError } = useToast();
  const [classId, setClassId] = useState("");
  const [activeClass, setActiveClass] = useState("");
  const [marking, setMarking] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [topic, setTopic] = useState("");
  const [studentStatuses, setStudentStatuses] = useState<Record<string, string>>({});

  const { data: attendance, refetch, isLoading } = useQuery({
    queryKey: ["attendance", activeClass],
    queryFn: () => getAttendance(activeClass),
    enabled: !!activeClass,
  });

  const { data: studentsData } = useQuery({
    queryKey: ["students", activeClass],
    queryFn: () => listClassStudents(activeClass),
    enabled: !!activeClass && marking,
  });

  const createSession = useMutation({
    mutationFn: () => createAttendanceSession({ class_id: activeClass, session_date: sessionDate, topic }),
    onSuccess: async (data) => {
      // Mark all students
      const records = Object.entries(studentStatuses).map(([student_id, status]) => ({
        student_id, status,
        student_name: studentsData?.students?.find((s: any) => s.id === student_id)?.student_name,
      }));
      if (records.length > 0) {
        await markAttendance(data.id, records);
      }
      success("Attendance marked!", `Session for ${sessionDate} saved.`);
      setMarking(false);
      setStudentStatuses({});
      refetch();
    },
    onError: () => toastError("Failed to save attendance"),
  });

  const students = studentsData?.students ?? [];

  // Initialize all students as present when marking starts
  const startMarking = () => {
    const initial: Record<string, string> = {};
    students.forEach((s: any) => { initial[s.id] = "present"; });
    setStudentStatuses(initial);
    setMarking(true);
  };

  const presentCount = Object.values(studentStatuses).filter(s => s === "present").length;
  const totalCount = Object.keys(studentStatuses).length;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
        <p className="text-gray-500 text-sm mt-0.5">Track student attendance per session.</p>
      </div>

      <div className="flex gap-2 mb-6">
        <input value={classId} onChange={e => setClassId(e.target.value)}
          placeholder="Class ID" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <button onClick={() => setActiveClass(classId)} disabled={!classId}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          Load
        </button>
      </div>

      {activeClass && !marking && (
        <div className="flex justify-end mb-4">
          <button onClick={startMarking}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            <Plus size={14} /> Mark Today's Attendance
          </button>
        </div>
      )}

      {/* Mark attendance form */}
      {marking && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Mark Attendance</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Topic (optional)</label>
              <input value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Normalization" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {totalCount > 0 && (
            <div className="mb-3 flex items-center gap-3">
              <span className="text-sm text-gray-600">Present: <strong className="text-green-600">{presentCount}</strong> / {totalCount}</span>
              <button onClick={() => setStudentStatuses(Object.fromEntries(Object.keys(studentStatuses).map(k => [k, "present"])))}
                className="text-xs text-blue-600 hover:underline">Mark All Present</button>
              <button onClick={() => setStudentStatuses(Object.fromEntries(Object.keys(studentStatuses).map(k => [k, "absent"])))}
                className="text-xs text-red-500 hover:underline">Mark All Absent</button>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {students.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No students found. Import students first via Bulk Import.</p>
            ) : students.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.student_name}</p>
                  <p className="text-xs text-gray-400">{s.roll_number} · {s.student_email}</p>
                </div>
                <div className="flex gap-1">
                  {["present","absent","late","excused"].map(status => (
                    <button key={status} onClick={() => setStudentStatuses(prev => ({...prev, [s.id]: status}))}
                      className={`text-xs px-2 py-1 rounded-lg capitalize transition ${studentStatuses[s.id] === status ? STATUS_COLORS[status] + " font-semibold" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => createSession.mutate()} disabled={createSession.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
              {createSession.isPending ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : "Save Attendance"}
            </button>
            <button onClick={() => setMarking(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {isLoading && <div className="space-y-3">{[1,2,3].map(i => <CardSkeleton key={i} />)}</div>}

      {!isLoading && activeClass && (!attendance?.sessions || attendance.sessions.length === 0) && (
        <EmptyState icon={CalendarCheck} title="No attendance records"
          description="Mark today's attendance to get started." />
      )}

      {!isLoading && attendance?.sessions?.map((s: any, i: number) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-gray-900">{s.session_date}</p>
              {s.topic && <p className="text-xs text-gray-500">{s.topic}</p>}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-green-600"><CheckCircle size={13} /> {s.present_count}</span>
              <span className="flex items-center gap-1 text-red-500"><XCircle size={13} /> {s.absent_count}</span>
              <span className="text-gray-400 text-xs">{s.total} total</span>
            </div>
          </div>
          {s.total > 0 && (
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${(s.present_count / s.total) * 100}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

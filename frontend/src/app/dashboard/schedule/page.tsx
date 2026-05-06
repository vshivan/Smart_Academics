"use client";
/**
 * Exam Schedule / Timetable
 * Create exam schedules, detect clashes, notify faculty.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import { CalendarCheck, Plus, AlertTriangle, Trash2, RefreshCw, Clock } from "lucide-react";

interface ExamSlot {
  id: string;
  subject_name: string;
  subject_id: string;
  exam_type: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  invigilator: string;
  clash?: boolean;
}

const EXAM_TYPES = ["midterm", "final", "quiz", "practical", "viva"];

const TYPE_COLORS: Record<string, string> = {
  midterm:   "bg-blue-100 text-blue-700",
  final:     "bg-red-100 text-red-700",
  quiz:      "bg-green-100 text-green-700",
  practical: "bg-purple-100 text-purple-700",
  viva:      "bg-orange-100 text-orange-700",
};

export default function SchedulePage() {
  const auth = useAuth();
  const { success, error } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    subject_id: "", subject_name: "", exam_type: "midterm",
    exam_date: "", start_time: "09:00", end_time: "12:00",
    venue: "", invigilator: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["exam-schedule", auth.collegeId],
    queryFn: () => api.get(`/schedule/${auth.collegeId}`).then(r => r.data).catch(() => ({ data: { slots: [] } })),
    enabled: !!auth.collegeId,
  });

  const slots: ExamSlot[] = data?.data?.slots ?? data?.slots ?? [];

  // Detect clashes: same date + overlapping time
  const slotsWithClash = slots.map(slot => {
    const clash = slots.some(other =>
      other.id !== slot.id &&
      other.exam_date === slot.exam_date &&
      other.venue === slot.venue &&
      slot.start_time < other.end_time &&
      slot.end_time > other.start_time
    );
    return { ...slot, clash };
  });

  const clashCount = slotsWithClash.filter(s => s.clash).length;

  const addSlot = useMutation({
    mutationFn: () => api.post(`/schedule/${auth.collegeId}`, form),
    onSuccess: () => {
      success("Exam scheduled!");
      qc.invalidateQueries({ queryKey: ["exam-schedule"] });
      setShowAdd(false);
      setForm({ subject_id: "", subject_name: "", exam_type: "midterm", exam_date: "", start_time: "09:00", end_time: "12:00", venue: "", invigilator: "" });
    },
    onError: () => error("Failed to schedule exam"),
  });

  const deleteSlot = useMutation({
    mutationFn: (id: string) => api.delete(`/schedule/${auth.collegeId}/slots/${id}`),
    onSuccess: () => { success("Removed"); qc.invalidateQueries({ queryKey: ["exam-schedule"] }); },
  });

  // Group by date
  const byDate: Record<string, ExamSlot[]> = {};
  slotsWithClash.forEach(s => {
    if (!byDate[s.exam_date]) byDate[s.exam_date] = [];
    byDate[s.exam_date].push(s);
  });
  const sortedDates = Object.keys(byDate).sort();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Exam Schedule</h1>
          <p className="text-gray-500 text-sm mt-0.5">Plan and manage examination timetable.</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={14} /> Add Exam
        </button>
      </div>

      {/* Clash warning */}
      {clashCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">{clashCount} venue clash{clashCount > 1 ? "es" : ""} detected</p>
            <p className="text-xs text-red-600">Two or more exams are scheduled in the same venue at overlapping times.</p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="bg-white rounded-xl border border-gray-200 h-24 animate-pulse" />)}
        </div>
      )}

      {!isLoading && slots.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CalendarCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No exams scheduled yet.</p>
          <p className="text-xs mt-1">Click "Add Exam" to create your first exam slot.</p>
        </div>
      )}

      {/* Schedule by date */}
      <div className="space-y-6">
        {sortedDates.map(date => (
          <div key={date}>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              {new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h2>
            <div className="space-y-2">
              {byDate[date].map(slot => (
                <div key={slot.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${slot.clash ? "border-red-300 bg-red-50/30" : "border-gray-200"}`}>
                  <div className="flex-shrink-0 text-center w-16">
                    <p className="text-xs font-bold text-gray-700">{slot.start_time}</p>
                    <p className="text-[10px] text-gray-400">to</p>
                    <p className="text-xs font-bold text-gray-700">{slot.end_time}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{slot.subject_name}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${TYPE_COLORS[slot.exam_type] ?? "bg-gray-100 text-gray-600"}`}>
                        {slot.exam_type}
                      </span>
                      {slot.clash && (
                        <span className="flex items-center gap-0.5 text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full font-semibold">
                          <AlertTriangle size={9} /> Clash
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      {slot.venue && <span>📍 {slot.venue}</span>}
                      {slot.invigilator && <span>👤 {slot.invigilator}</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteSlot.mutate(slot.id)}
                    className="text-gray-300 hover:text-red-500 transition flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between mb-5">
              <h2 className="font-bold text-lg">Schedule Exam</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Subject Name *</label>
                <input value={form.subject_name} onChange={e => setForm(f => ({...f, subject_name: e.target.value}))}
                  placeholder="e.g. Database Management Systems"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Exam Type</label>
                  <select value={form.exam_type} onChange={e => setForm(f => ({...f, exam_type: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                  <input type="date" value={form.exam_date} onChange={e => setForm(f => ({...f, exam_date: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({...f, start_time: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({...f, end_time: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Venue</label>
                <input value={form.venue} onChange={e => setForm(f => ({...f, venue: e.target.value}))}
                  placeholder="e.g. Hall A, Room 201"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Invigilator</label>
                <input value={form.invigilator} onChange={e => setForm(f => ({...f, invigilator: e.target.value}))}
                  placeholder="Faculty name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <button onClick={() => addSlot.mutate()} disabled={!form.subject_name || !form.exam_date || addSlot.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
                {addSlot.isPending ? <><RefreshCw size={14} className="animate-spin" /> Saving…</> : "Schedule Exam"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

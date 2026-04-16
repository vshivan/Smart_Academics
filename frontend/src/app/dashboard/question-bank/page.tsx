"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQuestionBank, addToQuestionBank } from "@/lib/api";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { Database, Search, Plus, X, RefreshCw } from "lucide-react";

const BLOOMS = ["remember","understand","apply","analyze","evaluate","create"];
const BLOOMS_COLORS: Record<string,string> = {
  remember:"bg-gray-100 text-gray-700", understand:"bg-blue-100 text-blue-700",
  apply:"bg-green-100 text-green-700",   analyze:"bg-yellow-100 text-yellow-700",
  evaluate:"bg-orange-100 text-orange-700", create:"bg-purple-100 text-purple-700",
};
const DIFF_COLORS: Record<string,string> = {
  easy:"bg-green-50 text-green-700", medium:"bg-yellow-50 text-yellow-700", hard:"bg-red-50 text-red-700",
};

export default function QuestionBankPage() {
  const { success, error: toastError } = useToast();
  const [filters, setFilters] = useState({ q: "", blooms_level: "", difficulty: "", subject_id: "" });
  const [showAdd, setShowAdd] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["question-bank", filters],
    queryFn: () => getQuestionBank(Object.fromEntries(Object.entries(filters).filter(([,v]) => v))),
  });

  const add = useMutation({
    mutationFn: addToQuestionBank,
    onSuccess: () => { refetch(); setShowAdd(false); reset(); success("Question added!", "Saved to the question bank."); },
    onError: () => toastError("Failed to add question"),
  });

  const inputClass = (hasError: boolean) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${hasError ? "border-red-400 bg-red-50" : "border-gray-300"}`;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Question Bank</h1>
          <p className="text-gray-500 text-sm">{data?.total ?? 0} questions stored</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={14} /> Add Question
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="relative col-span-2 md:col-span-1">
          <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={filters.q} onChange={e => setFilters(f => ({...f, q: e.target.value}))}
            placeholder="Search..." className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <select value={filters.blooms_level} onChange={e => setFilters(f => ({...f, blooms_level: e.target.value}))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Bloom's</option>
          {BLOOMS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filters.difficulty} onChange={e => setFilters(f => ({...f, difficulty: e.target.value}))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <input value={filters.subject_id} onChange={e => setFilters(f => ({...f, subject_id: e.target.value}))}
          placeholder="Subject ID" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>

      {/* Questions list */}
      {isLoading && (
        <div className="space-y-3">{[1,2,3,4].map(i => <CardSkeleton key={i} />)}</div>
      )}

      {!isLoading && (!data?.questions || data.questions.length === 0) && (
        <EmptyState icon={Database} title="No questions yet"
          description="Import questions from a finalized paper or add them manually."
          action={{ label: "Add Question", onClick: () => setShowAdd(true) }} />
      )}

      {!isLoading && (
        <div className="space-y-2">
          {data?.questions?.map((q: any) => (
            <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 transition">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BLOOMS_COLORS[q.blooms_level] || "bg-gray-100 text-gray-700"}`}>{q.blooms_level}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFF_COLORS[q.difficulty] || "bg-gray-100 text-gray-700"}`}>{q.difficulty}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{q.marks} marks</span>
                {q.topic && <span className="text-xs text-gray-400 italic">{q.topic}</span>}
                {q.language !== "en" && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{q.language}</span>}
              </div>
              <p className="text-sm text-gray-800 leading-relaxed">{q.question_text}</p>
              {q.answer_key && <p className="text-xs text-gray-400 mt-1.5 italic border-t border-gray-50 pt-1.5">Answer: {q.answer_key}</p>}
              <p className="text-xs text-gray-300 mt-1">Used {q.usage_count} times</p>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-lg text-gray-900">Add Question</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 transition"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit((d) => add.mutate(d))} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject ID <span className="text-red-500">*</span></label>
                <input {...register("subject_id", { required: "Required" })} placeholder="e.g. CS301" className={inputClass(!!errors.subject_id)} />
                {errors.subject_id && <p className="text-xs text-red-500 mt-1">{errors.subject_id.message as string}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question Text <span className="text-red-500">*</span></label>
                <textarea {...register("question_text", { required: "Required" })} rows={3} placeholder="Enter the question..." className={inputClass(!!errors.question_text)} />
                {errors.question_text && <p className="text-xs text-red-500 mt-1">{errors.question_text.message as string}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Answer Key</label>
                <textarea {...register("answer_key")} rows={2} placeholder="Model answer..." className={inputClass(false)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bloom's Level</label>
                  <select {...register("blooms_level")} className={inputClass(false)}>
                    {BLOOMS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select {...register("difficulty")} className={inputClass(false)}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
                  <input {...register("marks")} type="number" defaultValue={5} min={1} className={inputClass(false)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                  <input {...register("topic")} placeholder="e.g. Normalization" className={inputClass(false)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                <select {...register("language")} className={inputClass(false)}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="mr">Marathi</option>
                  <option value="ta">Tamil</option>
                </select>
              </div>
              <button type="submit" disabled={add.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
                {add.isPending ? <><RefreshCw size={14} className="animate-spin" /> Adding...</> : "Add to Bank"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

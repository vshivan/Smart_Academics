"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { listPaperTemplates, createPaperTemplate, getPaperTemplate } from "@/lib/api";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { FileText, Plus, X, RefreshCw, Copy } from "lucide-react";

const BLOOMS = ["remember","understand","apply","analyze","evaluate","create"];
const BLOOMS_EMOJI: Record<string,string> = {
  remember:"🧠",understand:"💡",apply:"🔧",analyze:"🔍",evaluate:"⚖️",create:"✨"
};

export default function TemplatesPage() {
  const { success, error: toastError } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [dist, setDist] = useState<Record<string,number>>(
    Object.fromEntries(BLOOMS.map(l => [l, l === "remember" ? 30 : l === "understand" ? 30 : l === "apply" ? 25 : l === "analyze" ? 15 : 0]))
  );
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const { data, refetch, isLoading } = useQuery({ queryKey: ["templates"], queryFn: listPaperTemplates });

  const create = useMutation({
    mutationFn: (d: any) => createPaperTemplate({
      ...d,
      total_marks: +d.total_marks,
      duration_minutes: +d.duration_minutes,
      blooms_distribution: Object.fromEntries(BLOOMS.map(l => [l, dist[l] / 100])),
    }),
    onSuccess: () => { refetch(); setShowCreate(false); reset(); success("Template saved!"); },
    onError: () => toastError("Failed to save template"),
  });

  const total = Object.values(dist).reduce((a,b) => a+b, 0);
  const valid = Math.abs(total - 100) <= 1;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Paper Templates</h1>
          <p className="text-gray-500 text-sm mt-0.5">Save paper configurations for reuse each semester.</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={14} /> New Template
        </button>
      </div>

      {isLoading && <div className="grid grid-cols-2 gap-4">{[1,2,3,4].map(i => <CardSkeleton key={i} />)}</div>}

      {!isLoading && (!data?.templates || data.templates.length === 0) && (
        <EmptyState icon={FileText} title="No templates yet"
          description="Create a template to reuse paper configurations across semesters."
          action={{ label: "Create Template", onClick: () => setShowCreate(true) }} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data?.templates?.map((t: any) => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-200 transition">
            <div className="flex justify-between mb-2">
              <h3 className="font-semibold text-gray-900 text-sm">{t.name}</h3>
              {t.is_default && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Default</span>}
            </div>
            {t.description && <p className="text-xs text-gray-500 mb-3">{t.description}</p>}
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-3">
              <div><span className="text-gray-400">Type</span><br/><span className="font-medium capitalize">{t.exam_type}</span></div>
              <div><span className="text-gray-400">Marks</span><br/><span className="font-medium">{t.total_marks}</span></div>
              <div><span className="text-gray-400">Duration</span><br/><span className="font-medium">{t.duration_minutes}m</span></div>
            </div>
            <div className="flex gap-0.5 h-3 rounded overflow-hidden">
              {BLOOMS.map(l => {
                const v = Math.round((t.blooms_distribution?.[l] || 0) * 100);
                return v > 0 ? <div key={l} style={{width:`${v}%`}} className="bg-blue-400" title={`${l}: ${v}%`} /> : null;
              })}
            </div>
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-gray-400">Used {t.usage_count} times</span>
              <button onClick={() => navigator.clipboard.writeText(t.id).then(() => success("Template ID copied!"))}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition">
                <Copy size={11} /> Copy ID
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-5">
              <h2 className="font-bold text-lg">Create Template</h2>
              <button onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input {...register("name", { required: true })} placeholder="e.g. Standard Midterm 50 Marks"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input {...register("description")} placeholder="Optional description"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
                  <select {...register("exam_type")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="midterm">Midterm</option>
                    <option value="final">Final</option>
                    <option value="quiz">Quiz</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
                  <input {...register("total_marks")} type="number" defaultValue={50}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                  <input {...register("duration_minutes")} type="number" defaultValue={180}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Bloom's Distribution</label>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${valid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {total}%
                  </span>
                </div>
                {BLOOMS.map(l => (
                  <div key={l} className="flex items-center gap-3 mb-1.5">
                    <span className="w-24 text-xs text-gray-600">{BLOOMS_EMOJI[l]} {l}</span>
                    <input type="range" min={0} max={100} step={5} value={dist[l]}
                      onChange={e => setDist(p => ({...p, [l]: +e.target.value}))}
                      className="flex-1 accent-blue-500" />
                    <span className="w-8 text-right text-xs font-bold text-blue-600">{dist[l]}%</span>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...register("is_default")} /> Set as default template
              </label>
              <button type="submit" disabled={create.isPending || !valid}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
                {create.isPending ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : "Save Template"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

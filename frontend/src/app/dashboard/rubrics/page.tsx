"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listRubrics, createRubric } from "@/lib/api";
import { Layout, Plus, Trash2, X } from "lucide-react";

interface Criterion { name: string; keywords: string; weight: number; }

export default function RubricsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [criteria, setCriteria] = useState<Criterion[]>([
    { name: "Definition", keywords: "", weight: 2 },
    { name: "Examples", keywords: "", weight: 2 },
    { name: "Conclusion", keywords: "", weight: 1 },
  ]);

  const { data, refetch } = useQuery({ queryKey: ["rubrics"], queryFn: listRubrics });

  const create = useMutation({
    mutationFn: () => createRubric({
      name, description: desc, is_shared: isShared,
      criteria: criteria.map(c => ({
        name: c.name,
        keywords: c.keywords.split(",").map(k => k.trim()).filter(Boolean),
        weight: c.weight,
      })),
    }),
    onSuccess: () => { refetch(); setShowCreate(false); setName(""); setDesc(""); },
  });

  const totalWeight = criteria.reduce((a, c) => a + c.weight, 0);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Rubric Builder</h1>
          <p className="text-gray-500 text-sm">Create reusable evaluation rubrics</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={14} /> New Rubric
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.rubrics?.map((r: any) => (
          <div key={r.id} className="bg-white rounded-xl shadow p-5">
            <div className="flex justify-between mb-2">
              <h3 className="font-semibold">{r.name}</h3>
              {r.is_shared && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Shared</span>}
            </div>
            {r.description && <p className="text-xs text-gray-500 mb-3">{r.description}</p>}
            <div className="space-y-1">
              {r.criteria?.map((c: any, i: number) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-gray-700">{c.name}</span>
                  <span className="text-gray-400">weight: {c.weight}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-300 mt-2">Used {r.usage_count} times</p>
          </div>
        ))}
        {(!data?.rubrics || data.rubrics.length === 0) && (
          <div className="col-span-2 text-center py-12 text-gray-400">
            <Layout size={40} className="mx-auto mb-3 opacity-30" />
            <p>No rubrics yet. Create your first one.</p>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4">
              <h2 className="font-bold text-lg">Create Rubric</h2>
              <button onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3 mb-4">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Rubric Name *" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isShared} onChange={e => setIsShared(e.target.checked)} /> Share with all faculty</label>
            </div>

            <div className="mb-3">
              <div className="flex justify-between mb-2">
                <p className="text-sm font-medium">Criteria</p>
                <span className="text-xs text-gray-400">Total weight: {totalWeight}</span>
              </div>
              <div className="space-y-2">
                {criteria.map((c, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex gap-2">
                      <input value={c.name} onChange={e => setCriteria(cr => cr.map((x,j) => j===i ? {...x, name: e.target.value} : x))}
                        placeholder="Criterion name" className="flex-1 border rounded px-2 py-1 text-sm" />
                      <input value={c.weight} type="number" min={1} max={10}
                        onChange={e => setCriteria(cr => cr.map((x,j) => j===i ? {...x, weight: +e.target.value} : x))}
                        className="w-16 border rounded px-2 py-1 text-sm" />
                      <button onClick={() => setCriteria(cr => cr.filter((_,j) => j!==i))} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input value={c.keywords} onChange={e => setCriteria(cr => cr.map((x,j) => j===i ? {...x, keywords: e.target.value} : x))}
                      placeholder="Keywords (comma-separated)" className="w-full border rounded px-2 py-1 text-xs" />
                  </div>
                ))}
              </div>
              <button onClick={() => setCriteria(c => [...c, { name: "", keywords: "", weight: 1 }])}
                className="mt-2 text-sm text-blue-600 hover:underline flex items-center gap-1">
                <Plus size={12} /> Add criterion
              </button>
            </div>

            <button onClick={() => create.mutate()} disabled={!name || create.isPending}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {create.isPending ? "Creating..." : "Create Rubric"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

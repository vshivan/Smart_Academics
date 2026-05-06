"use client";
/**
 * CO-PO Mapping — Course Outcome to Program Outcome mapping.
 * Critical for NBA/NAAC accreditation in Indian colleges.
 *
 * CO = Course Outcome (what students learn in a subject)
 * PO = Program Outcome (what graduates achieve overall)
 * PSO = Program Specific Outcome
 *
 * Bloom's level → CO → PO mapping is auto-suggested based on
 * the cognitive level of each outcome.
 */
import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, Trash2, Save, Download, ChevronDown, ChevronUp,
  BookOpen, Target, ArrowRight, Info,
} from "lucide-react";

// ── NBA Program Outcomes (standard 12 POs) ────────────────────
const PROGRAM_OUTCOMES = [
  { id: "PO1",  label: "Engineering Knowledge" },
  { id: "PO2",  label: "Problem Analysis" },
  { id: "PO3",  label: "Design/Development of Solutions" },
  { id: "PO4",  label: "Conduct Investigations" },
  { id: "PO5",  label: "Modern Tool Usage" },
  { id: "PO6",  label: "The Engineer and Society" },
  { id: "PO7",  label: "Environment and Sustainability" },
  { id: "PO8",  label: "Ethics" },
  { id: "PO9",  label: "Individual and Team Work" },
  { id: "PO10", label: "Communication" },
  { id: "PO11", label: "Project Management and Finance" },
  { id: "PO12", label: "Life-long Learning" },
];

// Bloom's level → suggested POs
const BLOOMS_TO_PO: Record<string, string[]> = {
  remember:   ["PO1", "PO12"],
  understand: ["PO1", "PO2", "PO12"],
  apply:      ["PO2", "PO3", "PO5"],
  analyze:    ["PO2", "PO4", "PO5"],
  evaluate:   ["PO2", "PO4", "PO6", "PO8"],
  create:     ["PO3", "PO4", "PO5", "PO9"],
};

const ATTAINMENT_LEVELS = [
  { value: 0, label: "0 — No mapping" },
  { value: 1, label: "1 — Low" },
  { value: 2, label: "2 — Medium" },
  { value: 3, label: "3 — High" },
];

const LEVEL_COLOR: Record<number, string> = {
  0: "bg-gray-50 text-gray-300",
  1: "bg-yellow-50 text-yellow-600 font-semibold",
  2: "bg-orange-50 text-orange-600 font-semibold",
  3: "bg-green-50 text-green-700 font-bold",
};

interface CourseOutcome {
  id: string;
  label: string;
  description: string;
  blooms_level: string;
  po_mapping: Record<string, number>;
}

const DEFAULT_COS: CourseOutcome[] = [
  { id: "CO1", label: "CO1", description: "Understand the fundamental concepts", blooms_level: "understand", po_mapping: {} },
  { id: "CO2", label: "CO2", description: "Apply techniques to solve problems",  blooms_level: "apply",      po_mapping: {} },
  { id: "CO3", label: "CO3", description: "Analyze and evaluate solutions",       blooms_level: "analyze",    po_mapping: {} },
];

export default function COPOPage() {
  const auth = useAuth();
  const { success, error } = useToast();
  const [subjectId, setSubjectId] = useState("");
  const [activeSubjectId, setActiveSubjectId] = useState("");
  const [cos, setCos] = useState<CourseOutcome[]>(DEFAULT_COS);
  const [showMatrix, setShowMatrix] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing CO-PO mapping for a subject
  const { data: existingData, isLoading } = useQuery({
    queryKey: ["copo", activeSubjectId],
    queryFn: () => api.get(`/subjects/${activeSubjectId}/copo`).then(r => r.data).catch(() => null),
    enabled: !!activeSubjectId,
  });

  // Apply loaded data when it arrives
  useEffect(() => {
    if (existingData?.data?.cos) setCos(existingData.data.cos);
    else if (existingData?.cos) setCos(existingData.cos);
  }, [existingData]);

  function addCO() {
    const next = cos.length + 1;
    setCos(prev => [...prev, {
      id: `CO${next}`,
      label: `CO${next}`,
      description: "",
      blooms_level: "understand",
      po_mapping: {},
    }]);
  }

  function removeCO(idx: number) {
    setCos(prev => prev.filter((_, i) => i !== idx));
  }

  function updateCO(idx: number, field: keyof CourseOutcome, value: any) {
    setCos(prev => prev.map((co, i) => i === idx ? { ...co, [field]: value } : co));
  }

  function setMapping(coIdx: number, poId: string, level: number) {
    setCos(prev => prev.map((co, i) => {
      if (i !== coIdx) return co;
      return { ...co, po_mapping: { ...co.po_mapping, [poId]: level } };
    }));
  }

  function autoSuggest(coIdx: number) {
    const co = cos[coIdx];
    const suggested = BLOOMS_TO_PO[co.blooms_level] ?? [];
    const newMapping: Record<string, number> = {};
    suggested.forEach(po => { newMapping[po] = 2; });
    setCos(prev => prev.map((c, i) => i === coIdx ? { ...c, po_mapping: newMapping } : c));
  }

  async function saveMappings() {
    if (!activeSubjectId) { error("No subject", "Enter a Subject ID first."); return; }
    setSaving(true);
    try {
      await api.post(`/subjects/${activeSubjectId}/copo`, { cos });
      success("CO-PO mapping saved!", "Attainment data updated.");
    } catch {
      error("Save failed", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function exportCSV() {
    const rows = [["CO", "Description", "Bloom's Level", ...PROGRAM_OUTCOMES.map(p => p.id)]];
    cos.forEach(co => {
      rows.push([
        co.label,
        co.description,
        co.blooms_level,
        ...PROGRAM_OUTCOMES.map(p => String(co.po_mapping[p.id] ?? 0)),
      ]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `copo_${activeSubjectId || "mapping"}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // Compute average attainment per PO
  const poAverages = PROGRAM_OUTCOMES.map(po => {
    const vals = cos.map(co => co.po_mapping[po.id] ?? 0).filter(v => v > 0);
    return { id: po.id, avg: vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—" };
  });

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">CO-PO Mapping</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Map Course Outcomes to Program Outcomes for NBA/NAAC accreditation.
        </p>
      </div>

      {/* Subject selector */}
      <div className="flex gap-2 mb-6">
        <input
          value={subjectId}
          onChange={e => setSubjectId(e.target.value)}
          onKeyDown={e => e.key === "Enter" && setActiveSubjectId(subjectId)}
          placeholder="Enter Subject ID (or leave blank to create new mapping)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button onClick={() => setActiveSubjectId(subjectId)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          Load
        </button>
        <button onClick={saveMappings} disabled={saving}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Save size={14} /> {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Course Outcomes editor */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm text-gray-900">Course Outcomes (COs)</h2>
          <button onClick={addCO}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition">
            <Plus size={13} /> Add CO
          </button>
        </div>

        <div className="space-y-3">
          {cos.map((co, idx) => (
            <div key={co.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {co.label}
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      value={co.description}
                      onChange={e => updateCO(idx, "description", e.target.value)}
                      placeholder="Describe what students will be able to do…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={co.blooms_level}
                      onChange={e => updateCO(idx, "blooms_level", e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      {["remember","understand","apply","analyze","evaluate","create"].map(l => (
                        <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                      ))}
                    </select>
                    <button onClick={() => autoSuggest(idx)} title="Auto-suggest PO mapping from Bloom's level"
                      className="text-xs bg-purple-50 text-purple-600 hover:bg-purple-100 px-2 py-1 rounded-lg transition whitespace-nowrap">
                      Auto
                    </button>
                    <button onClick={() => removeCO(idx)}
                      className="text-gray-300 hover:text-red-500 transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CO-PO Matrix */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-sm text-gray-900">CO-PO Attainment Matrix</h2>
            <p className="text-xs text-gray-400 mt-0.5">0 = No mapping, 1 = Low, 2 = Medium, 3 = High</p>
          </div>
          <button onClick={() => setShowMatrix(m => !m)}
            className="text-gray-400 hover:text-gray-600 transition">
            {showMatrix ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showMatrix && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 text-gray-500 font-medium w-24">CO / PO</th>
                  {PROGRAM_OUTCOMES.map(po => (
                    <th key={po.id} className="p-1.5 text-center text-gray-500 font-medium min-w-[52px]"
                      title={po.label}>
                      {po.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cos.map((co, coIdx) => (
                  <tr key={co.id} className="border-t border-gray-50">
                    <td className="p-2 font-semibold text-gray-700">{co.label}</td>
                    {PROGRAM_OUTCOMES.map(po => {
                      const level = co.po_mapping[po.id] ?? 0;
                      return (
                        <td key={po.id} className="p-1">
                          <select
                            value={level}
                            onChange={e => setMapping(coIdx, po.id, +e.target.value)}
                            className={`w-full text-center rounded-lg py-1 text-xs border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300 ${LEVEL_COLOR[level]}`}
                          >
                            {[0,1,2,3].map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Average row */}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="p-2 font-bold text-gray-700 text-xs">Avg</td>
                  {poAverages.map(pa => (
                    <td key={pa.id} className="p-1.5 text-center font-bold text-gray-600 text-xs">
                      {pa.avg}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PO legend */}
      <div className="mt-4 bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">Program Outcomes Reference</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {PROGRAM_OUTCOMES.map(po => (
            <div key={po.id} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="font-bold text-gray-700 w-8 flex-shrink-0">{po.id}</span>
              <span className="truncate">{po.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

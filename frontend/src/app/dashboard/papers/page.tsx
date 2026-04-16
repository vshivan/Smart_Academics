"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { generatePaper, getPaper, editQuestion, finalizePaper } from "@/lib/api";
import { FileText, Edit2, CheckCircle, Brain, Sliders, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useToast } from "@/components/Toast";

// ── Constants ─────────────────────────────────────────────────

const BLOOMS_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

const BLOOMS_PRESETS: Record<string, Record<string, number>> = {
  midterm: { remember: 0.30, understand: 0.30, apply: 0.25, analyze: 0.15, evaluate: 0.00, create: 0.00 },
  final:   { remember: 0.20, understand: 0.20, apply: 0.30, analyze: 0.20, evaluate: 0.10, create: 0.00 },
  quiz:    { remember: 0.50, understand: 0.30, apply: 0.20, analyze: 0.00, evaluate: 0.00, create: 0.00 },
};

const BLOOMS_COLORS: Record<string, string> = {
  remember:   "bg-gray-100 text-gray-700",
  understand: "bg-blue-100 text-blue-700",
  apply:      "bg-green-100 text-green-700",
  analyze:    "bg-yellow-100 text-yellow-700",
  evaluate:   "bg-orange-100 text-orange-700",
  create:     "bg-purple-100 text-purple-700",
};

const BLOOMS_EMOJI: Record<string, string> = {
  remember: "🧠", understand: "💡", apply: "🔧",
  analyze: "🔍", evaluate: "⚖️", create: "✨",
};

// ── Helpers ───────────────────────────────────────────────────

function pct(v: number) { return Math.round(v * 100); }

function normalise(dist: Record<string, number>): Record<string, number> {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (total === 0) return dist;
  return Object.fromEntries(Object.entries(dist).map(([k, v]) => [k, v / total]));
}

// ── Main Page ─────────────────────────────────────────────────

export default function PapersPage() {
  const { success, error: toastError } = useToast();
  const { register, handleSubmit, watch } = useForm({
    defaultValues: { subject_id: "", exam_type: "midterm", total_marks: 50, duration_minutes: 180 },
  });

  const examType = watch("exam_type") as string;

  // Mode: bloom = use preset, custom = manual sliders
  const [mode, setMode] = useState<"bloom" | "custom">("bloom");

  // Custom Bloom's distribution (percentages 0-100)
  const [customDist, setCustomDist] = useState<Record<string, number>>(
    Object.fromEntries(BLOOMS_LEVELS.map((l) => [l, pct(BLOOMS_PRESETS.midterm[l])]))
  );

  const [generatedPapers, setGeneratedPapers] = useState<any[]>([]);
  const [selectedPaper, setSelectedPaper]     = useState<any>(null);
  const [editingQ, setEditingQ]               = useState<string | null>(null);
  const [showAnswers, setShowAnswers]          = useState(false);

  const customTotal = Object.values(customDist).reduce((a, b) => a + b, 0);
  const customValid = Math.abs(customTotal - 100) <= 1;

  // ── Generate ────────────────────────────────────────────────
  const generate = useMutation({
    mutationFn: (payload: any) => generatePaper(payload),
    onSuccess: async (data) => {
      const papers = await Promise.all(data.papers.map((p: any) => getPaper(p.paper_id)));
      setGeneratedPapers(papers);
      setSelectedPaper(papers[0]);
      success("Papers generated!", `${papers.length} paper sets ready — Set A & B.`);
    },
    onError: () => toastError("Generation failed", "Make sure you've uploaded a syllabus for this Subject ID."),
  });

  const editQ = useMutation({
    mutationFn: ({ paperId, qId, data }: any) => editQuestion(paperId, qId, data),
    onSuccess: () => success("Question updated"),
    onError: () => toastError("Failed to update question"),
  });

  const finalize = useMutation({
    mutationFn: finalizePaper,
    onSuccess: () => success("Paper finalized!", "Locked and ready for distribution."),
    onError: () => toastError("Failed to finalize"),
  });

  function onSubmit(d: any) {
    let bloomsDist: Record<string, number>;

    if (mode === "bloom") {
      bloomsDist = BLOOMS_PRESETS[d.exam_type] ?? BLOOMS_PRESETS.midterm;
    } else {
      if (!customValid) return;
      bloomsDist = normalise(
        Object.fromEntries(BLOOMS_LEVELS.map((l) => [l, customDist[l] / 100]))
      );
    }

    generate.mutate({
      subject_id:        d.subject_id,
      exam_type:         d.exam_type,
      total_marks:       +d.total_marks,
      duration_minutes:  +d.duration_minutes,
      generate_sets:     2,
      blooms_distribution: bloomsDist,
    });
  }

  // ── Slider change ────────────────────────────────────────────
  function handleSlider(level: string, value: number) {
    setCustomDist((prev) => ({ ...prev, [level]: value }));
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-1">Question Paper Generator</h1>
      <p className="text-gray-500 text-sm mb-6">
        Choose how Bloom's taxonomy levels are distributed across your paper.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mb-8">

        {/* ── Basic config ── */}
        <div className="bg-white rounded-xl shadow p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Subject ID</label>
            <input
              {...register("subject_id", { required: true })}
              placeholder="e.g. CS101"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Exam Type</label>
            <select {...register("exam_type")} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="midterm">Midterm</option>
              <option value="final">Final</option>
              <option value="quiz">Quiz</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Total Marks</label>
            <input {...register("total_marks")} type="number" min={10} max={200}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
            <input {...register("duration_minutes")} type="number" min={15} max={360}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        {/* ── Mode selector ── */}
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">Bloom's Distribution Mode</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {/* Bloom's preset */}
            <button
              type="button"
              onClick={() => {
                setMode("bloom");
                setCustomDist(
                  Object.fromEntries(
                    BLOOMS_LEVELS.map((l) => [l, pct(BLOOMS_PRESETS[examType]?.[l] ?? 0)])
                  )
                );
              }}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 transition text-left ${
                mode === "bloom"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Brain size={22} className={mode === "bloom" ? "text-blue-600 mt-0.5" : "text-gray-400 mt-0.5"} />
              <div>
                <p className={`font-semibold text-sm ${mode === "bloom" ? "text-blue-700" : "text-gray-700"}`}>
                  Bloom's Taxonomy
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Auto-distribute using the standard preset for the selected exam type.
                </p>
              </div>
            </button>

            {/* Custom */}
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 transition text-left ${
                mode === "custom"
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Sliders size={22} className={mode === "custom" ? "text-purple-600 mt-0.5" : "text-gray-400 mt-0.5"} />
              <div>
                <p className={`font-semibold text-sm ${mode === "custom" ? "text-purple-700" : "text-gray-700"}`}>
                  Custom Distribution
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Manually set the % for each Bloom's level using sliders.
                </p>
              </div>
            </button>
          </div>

          {/* ── Bloom's preset preview ── */}
          {mode === "bloom" && (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                Preset for <span className="font-semibold capitalize">{examType}</span>:
              </p>
              <div className="flex gap-1 h-6 rounded-lg overflow-hidden">
                {BLOOMS_LEVELS.map((l) => {
                  const val = pct(BLOOMS_PRESETS[examType]?.[l] ?? 0);
                  if (val === 0) return null;
                  return (
                    <div
                      key={l}
                      style={{ width: `${val}%` }}
                      className={`flex items-center justify-center text-xs font-bold ${BLOOMS_COLORS[l]}`}
                      title={`${l}: ${val}%`}
                    >
                      {val >= 10 ? `${val}%` : ""}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {BLOOMS_LEVELS.map((l) => {
                  const val = pct(BLOOMS_PRESETS[examType]?.[l] ?? 0);
                  if (val === 0) return null;
                  return (
                    <span key={l} className={`text-xs px-2 py-0.5 rounded-full font-medium ${BLOOMS_COLORS[l]}`}>
                      {BLOOMS_EMOJI[l]} {l} {val}%
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Custom sliders ── */}
          {mode === "custom" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">Adjust each level (must total 100%)</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  customValid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                }`}>
                  Total: {customTotal}%
                </span>
              </div>

              {BLOOMS_LEVELS.map((level) => (
                <div key={level} className="flex items-center gap-3">
                  <span className="w-28 text-xs font-medium text-gray-600 flex items-center gap-1">
                    {BLOOMS_EMOJI[level]} {level}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={customDist[level]}
                    onChange={(e) => handleSlider(level, +e.target.value)}
                    className="flex-1 accent-purple-500"
                  />
                  <span className={`w-10 text-right text-xs font-bold ${
                    customDist[level] > 0 ? "text-purple-600" : "text-gray-300"
                  }`}>
                    {customDist[level]}%
                  </span>
                </div>
              ))}

              {/* Visual bar */}
              <div className="flex gap-0.5 h-4 rounded-lg overflow-hidden mt-2">
                {BLOOMS_LEVELS.map((l) =>
                  customDist[l] > 0 ? (
                    <div
                      key={l}
                      style={{ width: `${customDist[l]}%` }}
                      className={`${BLOOMS_COLORS[l]} transition-all`}
                      title={`${l}: ${customDist[l]}%`}
                    />
                  ) : null
                )}
              </div>

              {!customValid && (
                <p className="text-xs text-red-500 mt-1">
                  ⚠️ Total must equal 100%. Currently {customTotal}%.
                  {customTotal < 100 && ` Add ${100 - customTotal}% more.`}
                  {customTotal > 100 && ` Remove ${customTotal - 100}%.`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={generate.isPending || (mode === "custom" && !customValid)}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
        >
          {generate.isPending ? (
            <><RefreshCw size={16} className="animate-spin" /> Generating papers...</>
          ) : (
            <><FileText size={16} /> Generate 2 Paper Sets (A &amp; B)</>
          )}
        </button>

        {generate.isError && (
          <p className="text-sm text-red-500 text-center">
            ❌ Generation failed. Make sure you've uploaded a syllabus for this Subject ID.
          </p>
        )}
      </form>

      {/* ── Generated papers ── */}
      {generatedPapers.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              {generatedPapers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPaper(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    selectedPaper?.id === p.id ? "bg-blue-600 text-white" : "bg-white border hover:bg-gray-50"
                  }`}
                >
                  Set {p.paper_set}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAnswers((s) => !s)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border rounded-lg px-3 py-1.5"
            >
              {showAnswers ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showAnswers ? "Hide" : "Show"} Answer Keys
            </button>
          </div>

          {selectedPaper && (
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-lg">{selectedPaper.title}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedPaper.questions?.length} questions · {selectedPaper.total_marks} marks · {selectedPaper.duration_minutes} min
                  </p>
                </div>
                <button
                  onClick={() => finalize.mutate(selectedPaper.id)}
                  disabled={finalize.isPending}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
                >
                  <CheckCircle size={14} />
                  {finalize.isPending ? "Finalizing..." : "Finalize"}
                </button>
              </div>

              {/* Bloom's summary bar */}
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-1">Bloom's distribution in this paper</p>
                <div className="flex flex-wrap gap-1">
                  {BLOOMS_LEVELS.map((l) => {
                    const count = selectedPaper.questions?.filter((q: any) => q.blooms_level === l).length ?? 0;
                    if (count === 0) return null;
                    return (
                      <span key={l} className={`text-xs px-2 py-0.5 rounded-full font-medium ${BLOOMS_COLORS[l]}`}>
                        {BLOOMS_EMOJI[l]} {l} ×{count}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                {selectedPaper.questions?.map((q: any, i: number) => (
                  <div key={q.id} className="border rounded-lg p-4 hover:border-blue-200 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">Q{i + 1}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BLOOMS_COLORS[q.blooms_level] || "bg-gray-100"}`}>
                            {BLOOMS_EMOJI[q.blooms_level]} {q.blooms_level}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {q.marks} marks
                          </span>
                          <span className="text-xs text-gray-400 italic">{q.topic}</span>
                          <span className="text-xs text-gray-300">· {q.question_type}</span>
                        </div>

                        {editingQ === q.id ? (
                          <textarea
                            defaultValue={q.question_text}
                            rows={3}
                            className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                            onBlur={(e) => {
                              editQ.mutate({ paperId: selectedPaper.id, qId: q.id, data: { question_text: e.target.value } });
                              setEditingQ(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <p className="text-sm text-gray-800 leading-relaxed">{q.question_text}</p>
                        )}

                        {showAnswers && (
                          <div className="mt-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                            <p className="text-xs font-semibold text-green-700 mb-0.5">Answer Key</p>
                            <p className="text-xs text-green-800">{q.answer_key}</p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setEditingQ(editingQ === q.id ? null : q.id)}
                        className="text-gray-300 hover:text-blue-500 transition flex-shrink-0"
                        title="Edit question"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

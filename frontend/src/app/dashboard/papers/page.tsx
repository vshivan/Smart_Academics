"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { generatePaper, getPaper, editQuestion, finalizePaper } from "@/lib/api";
import { FileText, Edit2, CheckCircle } from "lucide-react";

const BLOOMS_COLORS: Record<string, string> = {
  remember: "bg-gray-100 text-gray-700",
  understand: "bg-blue-100 text-blue-700",
  apply: "bg-green-100 text-green-700",
  analyze: "bg-yellow-100 text-yellow-700",
  evaluate: "bg-orange-100 text-orange-700",
  create: "bg-purple-100 text-purple-700",
};

export default function PapersPage() {
  const [generatedPapers, setGeneratedPapers] = useState<any[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<any>(null);
  const [editingQ, setEditingQ] = useState<string | null>(null);
  const { register, handleSubmit } = useForm();

  const generate = useMutation({
    mutationFn: generatePaper,
    onSuccess: async (data) => {
      const papers = await Promise.all(data.papers.map((p: any) => getPaper(p.paper_id)));
      setGeneratedPapers(papers);
      setSelectedPaper(papers[0]);
    },
  });

  const editQ = useMutation({
    mutationFn: ({ paperId, qId, data }: any) => editQuestion(paperId, qId, data),
  });

  const finalize = useMutation({
    mutationFn: finalizePaper,
    onSuccess: () => alert("Paper finalized!"),
  });

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Question Paper Generator</h1>

      <form
        onSubmit={handleSubmit((d) => generate.mutate({ ...d, total_marks: +d.total_marks, generate_sets: 2 }))}
        className="bg-white rounded-xl shadow p-6 grid grid-cols-2 gap-4 mb-8"
      >
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Subject ID</label>
          <input {...register("subject_id", { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm" />
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
          <input {...register("total_marks")} type="number" defaultValue={50} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2">
          <button
            type="submit"
            disabled={generate.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
          >
            {generate.isPending ? "Generating..." : "Generate 2 Paper Sets"}
          </button>
        </div>
      </form>

      {generatedPapers.length > 0 && (
        <>
          {/* Set tabs */}
          <div className="flex gap-2 mb-4">
            {generatedPapers.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPaper(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  selectedPaper?.id === p.id ? "bg-blue-600 text-white" : "bg-white border"
                }`}
              >
                Set {p.paper_set}
              </button>
            ))}
          </div>

          {selectedPaper && (
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">{selectedPaper.title}</h2>
                <button
                  onClick={() => finalize.mutate(selectedPaper.id)}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg"
                >
                  <CheckCircle size={14} /> Finalize
                </button>
              </div>

              <div className="space-y-3">
                {selectedPaper.questions?.map((q: any, i: number) => (
                  <div key={q.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-gray-400">Q{i + 1}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BLOOMS_COLORS[q.blooms_level] || "bg-gray-100"}`}>
                            {q.blooms_level}
                          </span>
                          <span className="text-xs text-gray-500">{q.marks} marks</span>
                          <span className="text-xs text-gray-400">{q.topic}</span>
                        </div>
                        {editingQ === q.id ? (
                          <textarea
                            defaultValue={q.question_text}
                            className="w-full border rounded p-2 text-sm"
                            onBlur={(e) => {
                              editQ.mutate({ paperId: selectedPaper.id, qId: q.id, data: { question_text: e.target.value } });
                              setEditingQ(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <p className="text-sm text-gray-800">{q.question_text}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1 italic">Answer: {q.answer_key}</p>
                      </div>
                      <button onClick={() => setEditingQ(q.id)} className="text-gray-400 hover:text-blue-600">
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

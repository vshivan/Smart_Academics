"use client";
/**
 * Paper Preview — formatted in-browser preview before PDF download.
 * Shows exactly how the paper will look when printed.
 */
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPaper, exportPaperPdf } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Download, Eye, EyeOff, Printer, FileText, RefreshCw } from "lucide-react";

const BLOOMS_COLORS: Record<string, string> = {
  remember:   "bg-gray-100 text-gray-600",
  understand: "bg-blue-100 text-blue-700",
  apply:      "bg-green-100 text-green-700",
  analyze:    "bg-yellow-100 text-yellow-700",
  evaluate:   "bg-orange-100 text-orange-700",
  create:     "bg-purple-100 text-purple-700",
};

const SECTION_TITLES: Record<string, string> = {
  mcq:        "Section A — Multiple Choice Questions",
  short:      "Section B — Short Answer Questions",
  long:       "Section C — Long Answer Questions",
  case_study: "Section D — Case Study",
};

function groupByType(questions: any[]) {
  const groups: Record<string, any[]> = {};
  questions.forEach(q => {
    const t = q.question_type || "short";
    if (!groups[t]) groups[t] = [];
    groups[t].push(q);
  });
  return groups;
}

export default function PreviewPage() {
  const { success, error } = useToast();
  const [paperId, setPaperId] = useState("");
  const [activePaperId, setActivePaperId] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["paper-preview", activePaperId],
    queryFn: () => getPaper(activePaperId),
    enabled: !!activePaperId,
  });

  const paper = data?.data ?? data;
  const questions: any[] = paper?.questions ?? [];
  const grouped = groupByType(questions);

  async function handleDownload(withAnswers: boolean) {
    setDownloading(true);
    try {
      const blob = await exportPaperPdf(activePaperId, withAnswers);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `paper_${paper?.paper_set}_${paper?.exam_type}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      success("Downloaded!", "PDF saved to your downloads folder.");
    } catch {
      error("Download failed", "Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Paper Preview</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Preview your question paper before downloading or printing.
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-6 flex-wrap no-print">
        <input
          value={paperId}
          onChange={e => setPaperId(e.target.value)}
          onKeyDown={e => e.key === "Enter" && setActivePaperId(paperId)}
          placeholder="Enter Paper ID to preview"
          className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button onClick={() => setActivePaperId(paperId)} disabled={!paperId}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          Preview
        </button>
        {paper && (
          <>
            <button onClick={() => setShowAnswers(s => !s)}
              className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm transition">
              {showAnswers ? <EyeOff size={14} /> : <Eye size={14} />}
              {showAnswers ? "Hide" : "Show"} Answers
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm transition">
              <Printer size={14} /> Print
            </button>
            <button onClick={() => handleDownload(false)} disabled={downloading}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              {downloading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              Download PDF
            </button>
            <button onClick={() => handleDownload(true)} disabled={downloading}
              className="flex items-center gap-1.5 border border-green-300 text-green-700 hover:bg-green-50 px-4 py-2 rounded-lg text-sm font-medium transition">
              <Download size={14} /> With Answers
            </button>
          </>
        )}
      </div>

      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <RefreshCw size={24} className="animate-spin mx-auto text-blue-500 mb-3" />
          <p className="text-sm text-gray-500">Loading paper…</p>
        </div>
      )}

      {!isLoading && !activePaperId && (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Enter a Paper ID to preview it here.</p>
          <p className="text-xs mt-1">Generate a paper first from the Question Papers page.</p>
        </div>
      )}

      {/* Paper preview — styled like an actual exam paper */}
      {paper && (
        <div ref={printRef} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Paper header */}
          <div className="border-b-2 border-gray-800 p-6 text-center">
            <h1 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
              {paper.college_header || "Institution Name"}
            </h1>
            <div className="mt-2 text-sm text-gray-700">
              <p className="font-semibold">{paper.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 capitalize">
                {paper.exam_type} Examination — Set {paper.paper_set}
              </p>
            </div>
            <div className="mt-3 flex justify-center gap-8 text-xs text-gray-600">
              <span><strong>Total Marks:</strong> {paper.total_marks}</span>
              <span><strong>Duration:</strong> {paper.duration_minutes} minutes</span>
              <span><strong>Date:</strong> ___________</span>
            </div>
            {paper.instructions && (
              <p className="mt-3 text-xs text-gray-500 italic border-t border-gray-200 pt-2">
                Instructions: {paper.instructions}
              </p>
            )}
          </div>

          {/* Questions */}
          <div className="p-6 space-y-6">
            {Object.entries(grouped).map(([type, qs]) => (
              <div key={type}>
                <h2 className="font-bold text-sm text-gray-800 border-b border-gray-200 pb-2 mb-4">
                  {SECTION_TITLES[type] || type.toUpperCase()}
                </h2>
                <div className="space-y-4">
                  {qs.map((q: any, i: number) => {
                    const globalIdx = questions.findIndex(x => x.id === q.id) + 1;
                    return (
                      <div key={q.id} className="flex gap-3">
                        <span className="text-sm font-bold text-gray-500 w-6 flex-shrink-0 pt-0.5">
                          {globalIdx}.
                        </span>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm text-gray-800 leading-relaxed flex-1">
                              {q.question_text}
                            </p>
                            <span className="text-xs text-gray-400 flex-shrink-0 font-medium">
                              [{q.marks} marks]
                            </span>
                          </div>

                          {/* Bloom's tag — only in preview, not in print */}
                          <div className="no-print mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${BLOOMS_COLORS[q.blooms_level] || "bg-gray-100 text-gray-500"}`}>
                              {q.blooms_level} · {q.topic}
                            </span>
                          </div>

                          {/* Answer key */}
                          {showAnswers && q.answer_key && (
                            <div className="mt-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                              <p className="text-[10px] font-bold text-green-700 mb-0.5">Answer Key</p>
                              <p className="text-xs text-green-800 leading-relaxed">{q.answer_key}</p>
                            </div>
                          )}

                          {/* Answer space lines for print */}
                          <div className="print-only mt-2 space-y-2">
                            {Array.from({ length: q.question_type === "long" ? 6 : 3 }).map((_, i) => (
                              <div key={i} className="border-b border-gray-200 h-5" />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-3 flex justify-between text-xs text-gray-400">
            <span>Paper ID: {paper.id?.slice(0, 8)}…</span>
            <span>Set {paper.paper_set} · {paper.status}</span>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </div>
  );
}

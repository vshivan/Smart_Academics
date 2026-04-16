"use client";
import { useState } from "react";
import { exportPaperPdf, importFromPaper } from "@/lib/api";
import { Download, BookmarkPlus } from "lucide-react";

export default function ExportPage() {
  const [paperId, setPaperId] = useState("");
  const [includeAnswers, setIncludeAnswers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleExport() {
    if (!paperId) return;
    setLoading(true);
    setMsg("");
    try {
      const blob = await exportPaperPdf(paperId, includeAnswers);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `paper_${paperId.slice(0,8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("✅ PDF downloaded!");
    } catch {
      setMsg("❌ Export failed. Check the Paper ID.");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!paperId) return;
    setImporting(true);
    setMsg("");
    try {
      const res = await importFromPaper(paperId);
      setMsg(`✅ Imported ${res.imported} questions to Question Bank!`);
    } catch {
      setMsg("❌ Import failed. Check the Paper ID.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Export & Import</h1>
      <p className="text-gray-500 text-sm mb-6">Download papers as PDF or import questions to the bank.</p>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Paper ID</label>
          <input value={paperId} onChange={e => setPaperId(e.target.value)}
            placeholder="Paste paper ID from Question Papers page"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeAnswers} onChange={e => setIncludeAnswers(e.target.checked)} />
          Include Answer Key (separate page)
        </label>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleExport} disabled={!paperId || loading}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <Download size={14} />
            {loading ? "Generating..." : "Download PDF"}
          </button>
          <button onClick={handleImport} disabled={!paperId || importing}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            <BookmarkPlus size={14} />
            {importing ? "Importing..." : "Add to Bank"}
          </button>
        </div>

        {msg && (
          <p className={`text-sm text-center ${msg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>{msg}</p>
        )}
      </div>

      <div className="mt-6 bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">How to find your Paper ID</p>
        <p className="text-xs text-blue-600">Go to Question Papers → Generate a paper → The Paper ID appears in the URL or paper header.</p>
      </div>
    </div>
  );
}

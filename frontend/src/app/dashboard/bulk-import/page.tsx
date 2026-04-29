"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { bulkImportStudents, listClassStudents } from "@/lib/api";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { Users, Upload, Download, RefreshCw, CheckCircle } from "lucide-react";

export default function BulkImportPage() {
  const { success, error: toastError } = useToast();
  const [classId, setClassId] = useState("");
  const [activeClass, setActiveClass] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);

  const { data: students, refetch, isLoading } = useQuery({
    queryKey: ["class-students", activeClass],
    queryFn: () => listClassStudents(activeClass),
    enabled: !!activeClass,
  });

  const importMut = useMutation({
    mutationFn: () => bulkImportStudents(activeClass, file!),
    onSuccess: (data) => {
      setResult(data);
      refetch();
      success(`Imported ${data.imported} students!`, data.errors > 0 ? `${data.errors} rows had errors.` : undefined);
    },
    onError: () => toastError("Import failed", "Check your CSV format."),
  });

  const downloadTemplate = () => {
    const csv = "name,email,roll_number,phone,parent_phone,parent_email\nJohn Doe,john@example.com,CS001,9876543210,9876543211,parent@example.com";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "student_import_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Bulk Student Import</h1>
        <p className="text-gray-500 text-sm mt-0.5">Import students from a CSV file into a class.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Class ID</label>
          <div className="flex gap-2">
            <input value={classId} onChange={e => setClassId(e.target.value)}
              placeholder="Paste Class ID" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <button onClick={() => setActiveClass(classId)} disabled={!classId}
              className="bg-gray-800 hover:bg-gray-900 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              Load
            </button>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">CSV File</label>
            <button onClick={downloadTemplate} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Download size={11} /> Download template
            </button>
          </div>
          <input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          <p className="text-xs text-gray-400 mt-1">Required columns: name. Optional: email, roll_number, phone, parent_phone, parent_email</p>
        </div>

        <button onClick={() => importMut.mutate()} disabled={!file || !activeClass || importMut.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
          {importMut.isPending ? <><RefreshCw size={14} className="animate-spin" /> Importing...</> : <><Upload size={14} /> Import Students</>}
        </button>

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
            <p className="font-semibold text-green-800 flex items-center gap-2"><CheckCircle size={14} /> Import Complete</p>
            <p className="text-green-700 mt-1">✅ {result.imported} imported · ❌ {result.errors} failed</p>
          </div>
        )}
      </div>

      {activeClass && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Users size={16} /> Students in Class
            <span className="text-xs text-gray-400 font-normal">({students?.total ?? 0} total)</span>
          </h2>
          {isLoading ? <p className="text-sm text-gray-400">Loading...</p> :
            students?.students?.length === 0 ? (
              <EmptyState icon={Users} title="No students yet" description="Import a CSV to add students." />
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {students?.students?.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.student_name}</p>
                      <p className="text-xs text-gray-400">{s.roll_number} · {s.student_email}</p>
                    </div>
                    {s.parent_phone && <p className="text-xs text-gray-400">Parent: {s.parent_phone}</p>}
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}

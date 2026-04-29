"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { generateAccreditation, listAccreditationReports, listAcademicYears } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { Award, RefreshCw, Download, CheckCircle } from "lucide-react";

const REPORT_TYPES = [
  { value: "NBA",    label: "NBA",    desc: "National Board of Accreditation" },
  { value: "NAAC",   label: "NAAC",   desc: "National Assessment & Accreditation Council" },
  { value: "NIRF",   label: "NIRF",   desc: "National Institutional Ranking Framework" },
  { value: "custom", label: "Custom", desc: "Internal report" },
];

export default function AccreditationPage() {
  const { success, error: toastError } = useToast();
  const [reportType, setReportType] = useState("NBA");
  const [collegeId, setCollegeId] = useState("");
  const [generated, setGenerated] = useState<any>(null);

  const { data: reports, refetch, isLoading } = useQuery({
    queryKey: ["accreditation-reports"],
    queryFn: listAccreditationReports,
  });

  const generate = useMutation({
    mutationFn: () => generateAccreditation(reportType),
    onSuccess: (data) => { setGenerated(data); refetch(); success(`${reportType} report generated!`); },
    onError: () => toastError("Failed to generate report"),
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Accreditation Reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">Generate NBA, NAAC, NIRF reports from your academic data.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Generate New Report</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {REPORT_TYPES.map(rt => (
            <button key={rt.value} onClick={() => setReportType(rt.value)}
              className={`p-3 rounded-xl border-2 text-left transition ${reportType === rt.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
              <p className={`font-bold text-sm ${reportType === rt.value ? "text-blue-700" : "text-gray-700"}`}>{rt.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{rt.desc}</p>
            </button>
          ))}
        </div>
        <button onClick={() => generate.mutate()} disabled={generate.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
          {generate.isPending ? <><RefreshCw size={14} className="animate-spin" /> Generating...</> : <><Award size={14} /> Generate {reportType} Report</>}
        </button>
      </div>

      {/* Generated report preview */}
      {generated && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-green-600" />
            <h3 className="font-semibold text-green-800">{generated.data.report_type} Report Generated</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(generated.data.summary || {}).map(([key, val]) => (
              <div key={key} className="bg-white rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-blue-600">{String(val)}</p>
                <p className="text-xs text-gray-500 capitalize">{key.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-green-700">
            <p>✅ {generated.data.bloom_coverage}</p>
            <p>✅ {generated.data.automation_level}</p>
          </div>
        </div>
      )}

      {/* Past reports */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Past Reports</h2>
        {isLoading && <div className="space-y-2">{[1,2].map(i => <CardSkeleton key={i} />)}</div>}
        {!isLoading && (!reports?.reports || reports.reports.length === 0) && (
          <EmptyState icon={Award} title="No reports yet" description="Generate your first accreditation report above." />
        )}
        <div className="space-y-2">
          {reports?.reports?.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-800">{r.report_type} Report</p>
                <p className="text-xs text-gray-400">{new Date(r.generated_at).toLocaleString()}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "draft" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

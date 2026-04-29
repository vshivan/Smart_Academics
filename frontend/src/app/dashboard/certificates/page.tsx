"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { generateCertificate, listCertificates } from "@/lib/api";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { Award, Download, RefreshCw } from "lucide-react";

const CERT_TYPES = [
  { value: "participation", label: "Participation", desc: "Completed the course" },
  { value: "merit",         label: "Merit",         desc: "Scored above 75%" },
  { value: "distinction",   label: "Distinction",   desc: "Scored above 85%" },
  { value: "completion",    label: "Completion",    desc: "Finished all assignments" },
];

export default function CertificatesPage() {
  const { success, error: toastError } = useToast();
  const [classId, setClassId] = useState("");
  const [activeClass, setActiveClass] = useState("");
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["certificates", activeClass],
    queryFn: () => listCertificates(activeClass),
    enabled: !!activeClass,
  });

  const generate = useMutation({
    mutationFn: async (d: any) => {
      const blob = await generateCertificate(d);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `certificate_${d.student_name.replace(/\s/g,"_")}.pdf`; a.click();
      URL.revokeObjectURL(url);
      return d;
    },
    onSuccess: (d) => { refetch(); reset(); success("Certificate generated!", `Downloaded for ${d.student_name}.`); },
    onError: () => toastError("Failed to generate certificate"),
  });

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Certificates</h1>
        <p className="text-gray-500 text-sm mt-0.5">Generate and download student certificates.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Generate Certificate</h2>
        <form onSubmit={handleSubmit((d) => generate.mutate({ ...d, class_id: activeClass }))} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class ID</label>
            <div className="flex gap-2">
              <input value={classId} onChange={e => setClassId(e.target.value)}
                placeholder="Paste Class ID" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button type="button" onClick={() => setActiveClass(classId)} disabled={!classId}
                className="bg-gray-800 hover:bg-gray-900 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                Load
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student Google ID *</label>
            <input {...register("student_google_id", { required: true })} placeholder="e.g. 123456789012345678901"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student Name *</label>
            <input {...register("student_name", { required: true })} placeholder="e.g. John Doe"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Type</label>
            <div className="grid grid-cols-2 gap-2">
              {CERT_TYPES.map(ct => (
                <label key={ct.value} className="flex items-start gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition">
                  <input type="radio" {...register("certificate_type")} value={ct.value} defaultChecked={ct.value === "participation"} />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{ct.label}</p>
                    <p className="text-xs text-gray-400">{ct.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={generate.isPending || !activeClass}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
            {generate.isPending ? <><RefreshCw size={14} className="animate-spin" /> Generating...</> : <><Download size={14} /> Generate & Download</>}
          </button>
        </form>
      </div>

      {/* History */}
      {activeClass && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Generated Certificates</h2>
          {isLoading && <CardSkeleton />}
          {!isLoading && (!data?.certificates || data.certificates.length === 0) && (
            <EmptyState icon={Award} title="No certificates yet" description="Generate your first certificate above." />
          )}
          <div className="space-y-2">
            {data?.certificates?.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.student_name}</p>
                  <p className="text-xs text-gray-400">{c.certificate_type} · {c.issued_date}</p>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Issued</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

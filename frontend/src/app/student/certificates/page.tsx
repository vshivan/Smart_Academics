"use client";
import { useQuery } from "@tanstack/react-query";
import { getStudentResults } from "@/lib/api";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Award, Download } from "lucide-react";

export default function StudentCertificatesPage() {
  const auth     = useAuth();
  const googleId = auth.payload?.user_id ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["student-certificates", googleId],
    queryFn:  () => api.get(`/students/${googleId}/certificates`).then(r => r.data),
    enabled:  !!googleId,
  });

  const certs = data?.data?.certificates ?? data?.certificates ?? [];

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Certificates</h1>
        <p className="text-gray-500 text-sm mt-0.5">Your earned certificates.</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1,2].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-16" />
          ))}
        </div>
      )}

      {!isLoading && certs.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Award size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No certificates yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {certs.map((c: any) => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Award size={16} className="text-yellow-500" />
                <span className="font-semibold text-sm text-gray-900 capitalize">
                  {c.certificate_type} Certificate
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Issued: {c.issued_date}</p>
            </div>
            {c.pdf_url && (
              <a
                href={c.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg transition"
              >
                <Download size={12} /> Download
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getSyllabusVersions, restoreVersion } from "@/lib/api";
import { History, RotateCcw } from "lucide-react";

export default function VersionsPage() {
  const [subjectId, setSubjectId] = useState("");
  const [activeSubject, setActiveSubject] = useState("");

  const { data, refetch } = useQuery({
    queryKey: ["versions", activeSubject],
    queryFn: () => getSyllabusVersions(activeSubject),
    enabled: !!activeSubject,
  });

  const restore = useMutation({
    mutationFn: (versionId: string) => restoreVersion(activeSubject, versionId),
    onSuccess: () => { refetch(); alert("Version restored! Knowledge graph updated."); },
  });

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Syllabus Version History</h1>
      <p className="text-gray-500 text-sm mb-6">View and restore previous knowledge graph versions.</p>

      <div className="flex gap-3 mb-6">
        <input value={subjectId} onChange={e => setSubjectId(e.target.value)}
          placeholder="Subject ID" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        <button onClick={() => setActiveSubject(subjectId)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Load</button>
      </div>

      {data?.versions?.length > 0 ? (
        <div className="space-y-3">
          {data.versions.map((v: any, i: number) => (
            <div key={v.id} className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Version {v.version_number}</span>
                  {i === 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Current</span>}
                </div>
                {v.change_summary && <p className="text-xs text-gray-500 mt-0.5">{v.change_summary}</p>}
                <p className="text-xs text-gray-300 mt-1">
                  {new Date(v.created_at).toLocaleString()} · by {v.created_by_name || "System"}
                </p>
              </div>
              {i > 0 && (
                <button onClick={() => restore.mutate(v.id)} disabled={restore.isPending}
                  className="flex items-center gap-1 text-xs border border-orange-300 text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg">
                  <RotateCcw size={12} /> Restore
                </button>
              )}
            </div>
          ))}
        </div>
      ) : activeSubject ? (
        <div className="text-center py-12 text-gray-400">
          <History size={40} className="mx-auto mb-3 opacity-30" />
          <p>No version history found for this subject.</p>
        </div>
      ) : null}
    </div>
  );
}

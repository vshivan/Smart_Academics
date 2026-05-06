"use client";
/**
 * Audit Log Viewer — shows all actions taken in the system.
 * The audit_logs table already exists from init.sql.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import RoleGuard from "@/components/RoleGuard";
import { Shield, Search, Download, RefreshCw } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  LOGIN:  "bg-purple-100 text-purple-700",
  EXPORT: "bg-orange-100 text-orange-700",
  UPLOAD: "bg-teal-100 text-teal-700",
};

function getActionType(action: string): string {
  if (action.startsWith("CREATE") || action.startsWith("INSERT")) return "CREATE";
  if (action.startsWith("UPDATE") || action.startsWith("PATCH"))  return "UPDATE";
  if (action.startsWith("DELETE") || action.startsWith("REMOVE")) return "DELETE";
  if (action.startsWith("LOGIN")  || action.startsWith("AUTH"))   return "LOGIN";
  if (action.startsWith("EXPORT") || action.startsWith("DOWNLOAD")) return "EXPORT";
  if (action.startsWith("UPLOAD")) return "UPLOAD";
  return "ACTION";
}

export default function AuditPage() {
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", auth.collegeId, search, resourceType, page],
    queryFn: () => api.get(`/audit/${auth.collegeId}`, {
      params: { search: search || undefined, resource_type: resourceType || undefined, page, limit: 50 }
    }).then(r => r.data).catch(() => ({ data: { logs: [], total: 0 } })),
    enabled: !!auth.collegeId,
  });

  const logs = data?.data?.logs ?? data?.logs ?? [];
  const total = data?.data?.total ?? data?.total ?? 0;

  function exportCSV() {
    const rows = [["Time", "User", "Action", "Resource Type", "Resource ID", "Details"]];
    logs.forEach((l: any) => {
      rows.push([
        new Date(l.created_at).toLocaleString(),
        l.user_email || l.user_id,
        l.action,
        l.resource_type || "",
        l.resource_id || "",
        JSON.stringify(l.metadata || {}),
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit_log.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <RoleGuard roles={["admin", "hod"]} fallback={
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <Shield size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Admin or HOD access required.</p>
        </div>
      </div>
    }>
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Complete history of all actions taken in the system. {total > 0 && `${total} total entries.`}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => refetch()} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              <RefreshCw size={14} className="text-gray-500" />
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm transition">
              <Download size={14} /> Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search actions, users…"
              className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <select value={resourceType} onChange={e => { setResourceType(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Resources</option>
            <option value="college">College</option>
            <option value="subject">Subject</option>
            <option value="class">Class</option>
            <option value="paper">Paper</option>
            <option value="evaluation">Evaluation</option>
            <option value="user">User</option>
          </select>
        </div>

        {/* Log table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <RefreshCw size={20} className="animate-spin mx-auto text-blue-500 mb-2" />
              <p className="text-sm text-gray-500">Loading audit logs…</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Shield size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No audit logs found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-semibold">Time</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-semibold">User</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-semibold">Action</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-semibold">Resource</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => {
                    const actionType = getActionType(log.action);
                    return (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate">
                          {log.user_email || log.user_id?.slice(0, 8) + "…"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${ACTION_COLORS[actionType] ?? "bg-gray-100 text-gray-600"}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {log.resource_type && (
                            <span className="capitalize">{log.resource_type}</span>
                          )}
                          {log.resource_id && (
                            <span className="text-gray-300 ml-1">{log.resource_id.slice(0, 8)}…</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate">
                          {log.metadata ? JSON.stringify(log.metadata) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > 50 && (
          <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
            <span>Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition">
                Previous
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= total}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}

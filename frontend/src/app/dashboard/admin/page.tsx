"use client";
/**
 * Super Admin Panel — manage all colleges, view platform-wide stats.
 * Admin-only page.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listColleges, listFaculty } from "@/lib/api";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import RoleGuard from "@/components/RoleGuard";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import {
  Building2, Users, FileText, CheckSquare, BarChart2,
  Shield, RefreshCw, Search, ChevronRight, ToggleLeft, ToggleRight,
} from "lucide-react";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600", orange: "bg-orange-50 text-orange-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const auth = useAuth();
  const { success, error } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCollege, setSelectedCollege] = useState<any>(null);

  const { data: collegesData, isLoading } = useQuery({
    queryKey: ["all-colleges"],
    queryFn: listColleges,
    enabled: auth.isAuthenticated,
  });

  const { data: statsData } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: () => api.get("/admin/stats").then(r => r.data).catch(() => ({ data: { total_colleges: 0, total_users: 0, total_papers: 0, total_evaluations: 0 } })),
    enabled: auth.isAuthenticated,
  });

  const { data: facultyData } = useQuery({
    queryKey: ["college-faculty", selectedCollege?.id],
    queryFn: () => listFaculty(selectedCollege.id),
    enabled: !!selectedCollege?.id,
  });

  const toggleCollege = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/colleges/${id}`, { is_active: active }),
    onSuccess: () => { success("College status updated"); qc.invalidateQueries({ queryKey: ["all-colleges"] }); },
    onError: () => error("Failed to update"),
  });

  const updateRole = useMutation({
    mutationFn: ({ collegeId, userId, role }: { collegeId: string; userId: string; role: string }) =>
      api.patch(`/colleges/${collegeId}/faculty/${userId}/role`, role, { headers: { "Content-Type": "application/json" } }),
    onSuccess: () => { success("Role updated"); qc.invalidateQueries({ queryKey: ["college-faculty"] }); },
    onError: () => error("Failed to update role"),
  });

  const colleges = collegesData?.data?.colleges ?? collegesData?.colleges ?? [];
  const stats = statsData?.data ?? statsData ?? {};
  const faculty = facultyData?.data?.faculty ?? facultyData?.faculty ?? [];

  const filtered = colleges.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.domain || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <RoleGuard roles={["admin"]} fallback={
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <Shield size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Admin access required.</p>
        </div>
      </div>
    }>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Super Admin Panel</h1>
          <p className="text-gray-500 text-sm mt-0.5">Platform-wide management across all colleges.</p>
        </div>

        {/* Platform stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Colleges"    value={stats.total_colleges    ?? colleges.length} icon={Building2}   color="blue" />
          <StatCard label="Total Users"       value={stats.total_users       ?? "—"}             icon={Users}       color="green" />
          <StatCard label="Papers Generated"  value={stats.total_papers      ?? "—"}             icon={FileText}    color="purple" />
          <StatCard label="Evaluations Run"   value={stats.total_evaluations ?? "—"}             icon={CheckSquare} color="orange" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Colleges list */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm text-gray-900">All Colleges ({colleges.length})</h2>
            </div>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search colleges…"
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {filtered.map((college: any) => (
                  <div key={college.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                      selectedCollege?.id === college.id ? "border-blue-300 bg-blue-50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedCollege(college)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{college.name}</p>
                      <p className="text-xs text-gray-400">{college.domain || "No domain"}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); toggleCollege.mutate({ id: college.id, active: !college.is_active }); }}
                        className="text-gray-400 hover:text-blue-500 transition"
                        title={college.is_active ? "Deactivate" : "Activate"}
                      >
                        {college.is_active
                          ? <ToggleRight size={18} className="text-green-500" />
                          : <ToggleLeft size={18} className="text-gray-400" />
                        }
                      </button>
                      <ChevronRight size={14} className="text-gray-300" />
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No colleges found.</p>
                )}
              </div>
            )}
          </div>

          {/* College detail */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            {!selectedCollege ? (
              <div className="flex items-center justify-center h-full text-gray-400 py-12">
                <div className="text-center">
                  <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select a college to manage</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <h2 className="font-semibold text-gray-900">{selectedCollege.name}</h2>
                  <p className="text-xs text-gray-400">{selectedCollege.domain} · ID: {selectedCollege.id.slice(0, 8)}…</p>
                </div>

                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Faculty & Roles</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {faculty.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">No faculty found.</p>
                  ) : faculty.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-800 truncate">{f.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{f.email}</p>
                      </div>
                      <select
                        value={f.role}
                        onChange={e => updateRole.mutate({ collegeId: selectedCollege.id, userId: f.id, role: e.target.value })}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 ml-2"
                      >
                        <option value="faculty">Faculty</option>
                        <option value="hod">HOD</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}

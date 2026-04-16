"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listDepartments, createDepartment, getHodSummary } from "@/lib/api";
import { useForm } from "react-hook-form";
import { Users, Plus } from "lucide-react";

export default function DepartmentsPage() {
  const [collegeId, setCollegeId] = useState("");
  const [activeCollege, setActiveCollege] = useState("");
  const { register, handleSubmit, reset } = useForm();

  const { data: depts, refetch } = useQuery({
    queryKey: ["departments", activeCollege],
    queryFn: () => listDepartments(activeCollege),
    enabled: !!activeCollege,
  });

  const { data: summary } = useQuery({
    queryKey: ["hod-summary", activeCollege],
    queryFn: () => getHodSummary(activeCollege),
    enabled: !!activeCollege,
  });

  const create = useMutation({
    mutationFn: (d: any) => createDepartment(activeCollege, d),
    onSuccess: () => { refetch(); reset(); },
  });

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Departments & HOD View</h1>
      <p className="text-gray-500 text-sm mb-6">Manage departments and view institution-wide analytics.</p>

      <div className="flex gap-3 mb-6">
        <input value={collegeId} onChange={e => setCollegeId(e.target.value)}
          placeholder="College ID" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        <button onClick={() => setActiveCollege(collegeId)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Load</button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Subjects", value: summary.subjects },
            { label: "Classes", value: summary.classes },
            { label: "Faculty", value: summary.faculty },
            { label: "Papers", value: summary.papers_generated },
            { label: "Evaluations", value: summary.evaluation_sessions },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {activeCollege && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="font-semibold mb-3">Departments</h2>
            <div className="space-y-2">
              {depts?.departments?.map((d: any) => (
                <div key={d.id} className="bg-white rounded-xl shadow p-4">
                  <div className="flex justify-between">
                    <span className="font-medium text-sm">{d.name}</span>
                    <span className="text-xs text-gray-400">{d.code}</span>
                  </div>
                  {d.hod_name && <p className="text-xs text-gray-500 mt-0.5">HOD: {d.hod_name}</p>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-3">Add Department</h2>
            <form onSubmit={handleSubmit((d) => create.mutate(d))} className="bg-white rounded-xl shadow p-4 space-y-3">
              <input {...register("name", { required: true })} placeholder="Department Name *" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input {...register("code")} placeholder="Code (e.g. CS)" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input {...register("hod_id")} placeholder="HOD User ID (optional)" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                <Plus size={14} /> Add Department
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

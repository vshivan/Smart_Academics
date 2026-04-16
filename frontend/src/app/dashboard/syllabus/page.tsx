"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { uploadSyllabus, getSubjectFiles } from "@/lib/api";
import { useToast } from "@/components/Toast";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { Upload, CheckCircle, Clock, AlertCircle, FileText, RefreshCw } from "lucide-react";

const STATUS_CONFIG = {
  done:       { icon: CheckCircle, color: "text-green-500", bg: "bg-green-50",  label: "Processed" },
  pending:    { icon: Clock,       color: "text-yellow-500",bg: "bg-yellow-50", label: "Pending" },
  processing: { icon: RefreshCw,   color: "text-blue-500",  bg: "bg-blue-50",   label: "Processing..." },
  failed:     { icon: AlertCircle, color: "text-red-500",   bg: "bg-red-50",    label: "Failed" },
};

export default function SyllabusPage() {
  const { success, error, info } = useToast();
  const [subjectId, setSubjectId] = useState("");
  const [activeSubject, setActiveSubject] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: filesData, refetch, isLoading: filesLoading } = useQuery({
    queryKey: ["files", activeSubject],
    queryFn: () => getSubjectFiles(activeSubject),
    enabled: !!activeSubject,
    refetchInterval: (query) => {
      const files = (query.state.data as any)?.files ?? [];
      return files.some((f: any) => f.processing_status === "processing" || f.processing_status === "pending")
        ? 5000 : false;
    },
  });

  const upload = useMutation({
    mutationFn: (data: any) => {
      const fd = new FormData();
      fd.append("file", data.file[0]);
      fd.append("subject_id", data.subject_id);
      fd.append("file_type", data.file_type);
      return uploadSyllabus(fd);
    },
    onSuccess: (res) => {
      if (res.status === "already_processed") {
        info("Already processed", "This file was previously uploaded. Knowledge graph is ready!");
      } else {
        success("Upload queued!", "Processing in background. Status will update automatically.");
      }
      setActiveSubject(res.subject_id || subjectId);
      refetch();
      reset();
    },
    onError: () => error("Upload failed", "Check your Subject ID and try again."),
  });

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Upload Syllabus</h1>
        <p className="text-gray-500 text-sm mt-0.5">Upload once — topics extracted automatically and reused forever.</p>
      </div>

      {/* Upload form */}
      <form onSubmit={handleSubmit((d) => upload.mutate(d))} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject ID <span className="text-red-500">*</span>
          </label>
          <input
            {...register("subject_id", { required: "Subject ID is required" })}
            placeholder="e.g. CS301"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${errors.subject_id ? "border-red-400 bg-red-50" : "border-gray-300"}`}
          />
          {errors.subject_id && <p className="text-xs text-red-500 mt-1">{errors.subject_id.message as string}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">File Type</label>
          <select {...register("file_type")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="syllabus">Syllabus</option>
            <option value="reference">Reference Material</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PDF File <span className="text-red-500">*</span>
          </label>
          <input
            {...register("file", { required: "Please select a PDF file" })}
            type="file" accept=".pdf"
            className={`w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 ${errors.file ? "border border-red-400 rounded-lg p-1" : ""}`}
          />
          {errors.file && <p className="text-xs text-red-500 mt-1">{errors.file.message as string}</p>}
        </div>

        <button
          type="submit"
          disabled={upload.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition"
        >
          {upload.isPending ? (
            <><RefreshCw size={15} className="animate-spin" /> Uploading...</>
          ) : (
            <><Upload size={15} /> Upload & Process</>
          )}
        </button>
      </form>

      {/* View files section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-semibold text-sm text-gray-700">View Uploaded Files</h2>
        </div>
        <div className="flex gap-2 mb-4">
          <input
            value={subjectId}
            onChange={e => setSubjectId(e.target.value)}
            placeholder="Enter Subject ID to view files"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={() => setActiveSubject(subjectId)}
            disabled={!subjectId}
            className="bg-gray-800 hover:bg-gray-900 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Load
          </button>
        </div>

        {filesLoading && (
          <div className="space-y-2">
            {[1,2,3].map(i => <CardSkeleton key={i} />)}
          </div>
        )}

        {!filesLoading && activeSubject && filesData?.files?.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No files uploaded yet"
            description="Upload a syllabus PDF above to get started."
          />
        )}

        {!filesLoading && filesData?.files?.map((f: any) => {
          const cfg = STATUS_CONFIG[f.processing_status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
          const Icon = cfg.icon;
          return (
            <div key={f.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText size={14} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{f.file_name}</p>
                  <p className="text-xs text-gray-400">{f.file_type}</p>
                </div>
              </div>
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                <Icon size={11} className={f.processing_status === "processing" ? "animate-spin" : ""} />
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

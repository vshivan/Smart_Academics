"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { uploadSyllabus, getSubjectFiles } from "@/lib/api";
import { Upload, CheckCircle, Clock, AlertCircle } from "lucide-react";

const STATUS_ICON = {
  done: <CheckCircle className="text-green-500" size={16} />,
  pending: <Clock className="text-yellow-500" size={16} />,
  processing: <Clock className="text-blue-500" size={16} />,
  failed: <AlertCircle className="text-red-500" size={16} />,
};

export default function SyllabusPage() {
  const [subjectId, setSubjectId] = useState("");
  const { register, handleSubmit, reset } = useForm();

  const { data: filesData, refetch } = useQuery({
    queryKey: ["files", subjectId],
    queryFn: () => getSubjectFiles(subjectId),
    enabled: !!subjectId,
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
        alert("This file was already uploaded and processed. Knowledge graph is ready!");
      } else {
        alert("Upload queued! Processing in background.");
      }
      refetch();
      reset();
    },
  });

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Upload Syllabus / Reference Material</h1>
      <p className="text-sm text-gray-500 mb-6 bg-blue-50 p-3 rounded-lg">
        Files are processed once and stored permanently. Re-uploading the same file will reuse the existing knowledge graph.
      </p>

      <form onSubmit={handleSubmit((d) => upload.mutate(d))} className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Subject ID</label>
          <input {...register("subject_id", { required: true })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. sub_123" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">File Type</label>
          <select {...register("file_type")} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="syllabus">Syllabus</option>
            <option value="reference">Reference Material</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">PDF File</label>
          <input {...register("file", { required: true })} type="file" accept=".pdf" className="w-full text-sm" />
        </div>
        <button
          type="submit"
          disabled={upload.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition"
        >
          <Upload size={16} />
          {upload.isPending ? "Uploading..." : "Upload & Process"}
        </button>
      </form>

      {filesData?.files?.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold mb-3">Uploaded Files</h2>
          <div className="space-y-2">
            {filesData.files.map((f: any) => (
              <div key={f.id} className="bg-white rounded-lg border px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium">{f.file_name}</span>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  {STATUS_ICON[f.processing_status as keyof typeof STATUS_ICON]}
                  {f.processing_status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { Globe, CheckCircle, Clock } from "lucide-react";

const LMS_OPTIONS = [
  { name: "Google Classroom", icon: "🎓", status: "connected", desc: "OAuth connected — submissions auto-fetched" },
  { name: "Moodle",           icon: "📚", status: "coming",    desc: "REST API integration — coming soon" },
  { name: "Canvas LMS",       icon: "🖼️", status: "coming",    desc: "LTI 1.3 integration — coming soon" },
  { name: "Microsoft Teams",  icon: "💼", status: "coming",    desc: "Teams Assignments API — coming soon" },
];

export default function LMSPage() {
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">LMS Integrations</h1>
      <p className="text-gray-500 text-sm mb-6">Connect SAAP to your Learning Management System.</p>

      <div className="space-y-4">
        {LMS_OPTIONS.map((lms) => (
          <div key={lms.name} className="bg-white rounded-xl shadow p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-3xl">{lms.icon}</span>
              <div>
                <h3 className="font-semibold text-sm">{lms.name}</h3>
                <p className="text-xs text-gray-500">{lms.desc}</p>
              </div>
            </div>
            {lms.status === "connected" ? (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full font-medium">
                <CheckCircle size={12} /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
                <Clock size={12} /> Coming Soon
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 bg-blue-50 rounded-xl p-5">
        <h2 className="font-semibold text-blue-800 mb-2 flex items-center gap-2"><Globe size={16} /> Google Classroom — Active</h2>
        <p className="text-sm text-blue-700">
          Your Google account is connected. SAAP can fetch courses, coursework, and student submissions automatically.
          Go to the <a href="/dashboard/evaluation" className="underline font-medium">Evaluation page</a> to start grading.
        </p>
      </div>
    </div>
  );
}

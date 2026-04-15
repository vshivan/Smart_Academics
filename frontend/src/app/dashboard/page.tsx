"use client";
import Link from "next/link";
import { BookOpen, FileText, BarChart2, Upload, CheckSquare } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard/syllabus", icon: Upload, label: "Upload Syllabus", desc: "Upload once, reuse forever" },
  { href: "/dashboard/papers", icon: FileText, label: "Question Papers", desc: "Generate & manage papers" },
  { href: "/dashboard/evaluation", icon: CheckSquare, label: "Evaluation", desc: "Grade via Google Classroom" },
  { href: "/dashboard/analytics", icon: BarChart2, label: "Analytics", desc: "Performance & trends" },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="text-blue-600" size={24} />
          <span className="font-bold text-lg">SAAP</span>
        </div>
        <span className="text-sm text-gray-500">Faculty Dashboard</span>
      </header>

      <main className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-6">Welcome back</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {NAV_ITEMS.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="bg-white rounded-xl shadow hover:shadow-md transition p-6 flex items-start gap-4"
            >
              <div className="bg-blue-50 p-3 rounded-lg">
                <Icon className="text-blue-600" size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{label}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

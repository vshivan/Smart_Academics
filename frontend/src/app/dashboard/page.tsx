"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getNotifications } from "@/lib/api";
import {
  Upload, FileText, CheckSquare, BarChart2,
  Building2, Users, Database, Layout, History,
  Download, AlertTriangle, Sliders, Bell, Globe,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard/syllabus",      icon: Upload,         label: "Upload Syllabus",        desc: "Upload once, reuse forever",             color: "blue",   group: "Core" },
  { href: "/dashboard/papers",        icon: FileText,       label: "Question Papers",         desc: "Generate & manage papers",               color: "blue",   group: "Core" },
  { href: "/dashboard/evaluation",    icon: CheckSquare,    label: "Evaluation",              desc: "Grade via Google Classroom",             color: "blue",   group: "Core" },
  { href: "/dashboard/analytics",     icon: BarChart2,      label: "Analytics",               desc: "Performance & trends",                   color: "blue",   group: "Core" },
  { href: "/dashboard/setup",         icon: Building2,      label: "College Setup",           desc: "Colleges, subjects, classes, faculty",   color: "purple", group: "Management" },
  { href: "/dashboard/departments",   icon: Users,          label: "Departments & HOD",       desc: "Role-based access & department view",    color: "purple", group: "Management" },
  { href: "/dashboard/question-bank", icon: Database,       label: "Question Bank",           desc: "Searchable bank of all questions",       color: "green",  group: "Features" },
  { href: "/dashboard/rubrics",       icon: Layout,         label: "Rubric Builder",          desc: "Visual rubric designer for evaluation",  color: "green",  group: "Features" },
  { href: "/dashboard/versions",      icon: History,        label: "Syllabus Versions",       desc: "Version history & rollback",             color: "green",  group: "Features" },
  { href: "/dashboard/export",        icon: Download,       label: "Export Papers",           desc: "Download formatted PDF papers",          color: "green",  group: "Features" },
  { href: "/dashboard/plagiarism",    icon: AlertTriangle,  label: "Plagiarism Check",        desc: "Detect similar submissions",             color: "orange", group: "Features" },
  { href: "/dashboard/calibration",   icon: Sliders,        label: "Difficulty Calibration",  desc: "Auto-adjust question difficulty",        color: "orange", group: "Features" },
  { href: "/dashboard/notifications", icon: Bell,           label: "Notifications",           desc: "Alerts & processing updates",            color: "orange", group: "Features" },
  { href: "/dashboard/lms",           icon: Globe,          label: "LMS Integration",         desc: "Moodle, Canvas, Teams sync",             color: "gray",   group: "Integrations" },
];

const COLOR_MAP: Record<string, string> = {
  blue:   "bg-blue-50 text-blue-600",
  purple: "bg-purple-50 text-purple-600",
  green:  "bg-green-50 text-green-600",
  orange: "bg-orange-50 text-orange-600",
  gray:   "bg-gray-100 text-gray-600",
};

const groups = ["Core", "Management", "Features", "Integrations"];

export default function DashboardPage() {
  const { data: notifData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => getNotifications(true),
    refetchInterval: 30000,
  });
  const unreadCount = notifData?.unread_count ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Welcome back 👋</h1>
        <p className="text-gray-500 text-sm mt-0.5">Smart Academic Automation Platform</p>
      </div>

      {groups.map((group) => {
        const items = NAV_ITEMS.filter((n) => n.group === group);
        return (
          <div key={group} className="mb-7">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{group}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map(({ href, icon: Icon, label, desc, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition p-4 flex items-start gap-3 group"
                >
                  <div className={`p-2 rounded-lg flex-shrink-0 ${COLOR_MAP[color]}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition text-sm truncate">
                      {label}
                      {label === "Notifications" && unreadCount > 0 && (
                        <span className="ml-2 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

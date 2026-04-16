"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getNotifications } from "@/lib/api";

const LABELS: Record<string, string> = {
  dashboard:       "Dashboard",
  syllabus:        "Upload Syllabus",
  papers:          "Question Papers",
  evaluation:      "Evaluation",
  analytics:       "Analytics",
  setup:           "College Setup",
  departments:     "Departments",
  "question-bank": "Question Bank",
  rubrics:         "Rubrics",
  versions:        "Syllabus Versions",
  export:          "Export",
  plagiarism:      "Plagiarism",
  calibration:     "Calibration",
  notifications:   "Notifications",
  lms:             "LMS",
};

export default function Topbar() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const { data: notifData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => getNotifications(true),
    refetchInterval: 30000,
  });
  const unreadCount = notifData?.unread_count ?? 0;

  const crumbs = segments.map((seg, i) => ({
    label: LABELS[seg] ?? seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0">
      {/* Breadcrumbs — offset on mobile for hamburger */}
      <nav className="flex items-center gap-1 text-sm ml-10 md:ml-0 overflow-hidden">
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight size={13} className="text-gray-300 flex-shrink-0" />}
            {c.isLast ? (
              <span className="font-semibold text-gray-800 truncate">{c.label}</span>
            ) : (
              <Link href={c.href} className="text-gray-400 hover:text-blue-600 transition truncate hidden sm:block">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href="/dashboard/notifications"
          className="relative p-1.5 rounded-lg hover:bg-gray-100 transition">
          <Bell size={17} className="text-gray-500" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <a href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/docs`}
          target="_blank"
          className="text-xs text-gray-400 hover:text-blue-600 transition hidden sm:block border border-gray-200 px-2.5 py-1 rounded-lg">
          API Docs
        </a>
      </div>
    </header>
  );
}

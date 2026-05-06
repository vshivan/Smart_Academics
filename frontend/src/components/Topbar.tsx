"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronRight, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getNotifications } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, ROLE_COLORS, type Role } from "@/lib/auth";

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
  templates:       "Paper Templates",
  "bulk-import":   "Bulk Import",
  attendance:      "Attendance",
  certificates:    "Certificates",
  "bloom-report":  "Bloom Report",
  comparative:     "Comparative Analytics",
  accreditation:   "Accreditation",
  chatbot:         "AI Assistant",
};

export default function Topbar() {
  const pathname  = usePathname();
  const auth      = useAuth();
  const segments  = pathname.split("/").filter(Boolean);

  const { data: notifData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn:  () => getNotifications(true),
    refetchInterval: 30_000,
    enabled: auth.isAuthenticated,
  });
  const unreadCount = notifData?.data?.unread_count ?? notifData?.unread_count ?? 0;

  const crumbs = segments.map((seg, i) => ({
    label:  LABELS[seg] ?? seg,
    href:   "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0">
      {/* Breadcrumbs */}
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

      {/* Right side */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* User info */}
        {auth.user && (
          <div className="hidden sm:flex items-center gap-2">
            {/* Role badge */}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[auth.role as Role] ?? "bg-gray-100 text-gray-600"}`}>
              {ROLE_LABELS[auth.role as Role] ?? auth.role}
            </span>
            {/* Avatar */}
            {auth.user.picture ? (
              <img
                src={auth.user.picture}
                alt={auth.user.name}
                className="w-7 h-7 rounded-full border border-gray-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                {auth.user.name?.[0]?.toUpperCase() ?? "U"}
              </div>
            )}
            <span className="text-xs text-gray-600 font-medium max-w-[120px] truncate hidden lg:block">
              {auth.user.name}
            </span>
          </div>
        )}

        {/* Notifications bell */}
        <Link
          href="/dashboard/notifications"
          className="relative p-1.5 rounded-lg hover:bg-gray-100 transition"
          aria-label="Notifications"
        >
          <Bell size={17} className="text-gray-500" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        {/* API Docs link */}
        <a
          href={`${API_URL}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition border border-gray-200 px-2.5 py-1 rounded-lg"
        >
          API <ExternalLink size={10} />
        </a>

        {/* Keyboard shortcut hint */}
        <div className="hidden lg:flex items-center gap-1 text-[10px] text-gray-300 border border-gray-100 px-2 py-1 rounded-lg">
          <kbd className="font-mono">Ctrl</kbd>
          <span>+</span>
          <kbd className="font-mono">K</kbd>
        </div>
      </div>
    </header>
  );
}

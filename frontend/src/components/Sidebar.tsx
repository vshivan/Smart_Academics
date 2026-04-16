"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getNotifications } from "@/lib/api";
import {
  BookOpen, Upload, FileText, CheckSquare, BarChart2,
  Building2, Users, Database, Layout, History,
  Download, AlertTriangle, Sliders, Bell, Globe,
  ChevronLeft, ChevronRight, LogOut, Home, Menu, X,
} from "lucide-react";
import { useState, useEffect } from "react";

const NAV_GROUPS = [
  {
    label: "Core", color: "blue",
    items: [
      { href: "/dashboard/syllabus",   icon: Upload,       label: "Syllabus" },
      { href: "/dashboard/papers",     icon: FileText,     label: "Papers" },
      { href: "/dashboard/evaluation", icon: CheckSquare,  label: "Evaluation" },
      { href: "/dashboard/analytics",  icon: BarChart2,    label: "Analytics" },
    ],
  },
  {
    label: "Management", color: "purple",
    items: [
      { href: "/dashboard/setup",       icon: Building2, label: "College Setup" },
      { href: "/dashboard/departments", icon: Users,     label: "Departments" },
    ],
  },
  {
    label: "Features", color: "green",
    items: [
      { href: "/dashboard/question-bank", icon: Database,      label: "Question Bank" },
      { href: "/dashboard/rubrics",       icon: Layout,        label: "Rubrics" },
      { href: "/dashboard/versions",      icon: History,       label: "Versions" },
      { href: "/dashboard/export",        icon: Download,      label: "Export" },
      { href: "/dashboard/plagiarism",    icon: AlertTriangle, label: "Plagiarism" },
      { href: "/dashboard/calibration",   icon: Sliders,       label: "Calibration" },
    ],
  },
  {
    label: "Other", color: "gray",
    items: [
      { href: "/dashboard/notifications", icon: Bell,  label: "Notifications" },
      { href: "/dashboard/lms",           icon: Globe, label: "LMS" },
    ],
  },
];

const COLOR_ACTIVE: Record<string, string> = {
  blue:   "bg-blue-50 text-blue-700 border-l-2 border-blue-500",
  purple: "bg-purple-50 text-purple-700 border-l-2 border-purple-500",
  green:  "bg-green-50 text-green-700 border-l-2 border-green-500",
  gray:   "bg-gray-100 text-gray-700 border-l-2 border-gray-400",
};

function NavContent({
  collapsed, pathname, unreadCount, onNavigate,
}: {
  collapsed: boolean; pathname: string; unreadCount: number; onNavigate?: () => void;
}) {
  return (
    <>
      {/* Home */}
      <div className="px-2 pt-2">
        <Link href="/dashboard" onClick={onNavigate}
          className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition ${
            pathname === "/dashboard" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          }`}>
          <Home size={15} className="flex-shrink-0" />
          {!collapsed && "Dashboard"}
        </Link>
      </div>

      {/* Groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-1">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, icon: Icon, label }) => {
                const active = pathname === href;
                const isNotif = href === "/dashboard/notifications";
                return (
                  <Link key={href} href={href} onClick={onNavigate}
                    title={collapsed ? label : undefined}
                    className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition relative ${
                      active ? COLOR_ACTIVE[group.color] : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                    }`}>
                    <Icon size={15} className="flex-shrink-0" />
                    {!collapsed && <span>{label}</span>}
                    {isNotif && unreadCount > 0 && (
                      <span className={`${collapsed ? "absolute top-0.5 right-0.5" : "ml-auto"} bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold`}>
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 px-2 py-3">
        <a href="/" title={collapsed ? "Sign out" : undefined}
          className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
          <LogOut size={14} className="flex-shrink-0" />
          {!collapsed && "Sign out"}
        </a>
      </div>
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const { data: notifData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => getNotifications(true),
    refetchInterval: 30000,
  });
  const unreadCount = notifData?.unread_count ?? 0;

  const Logo = () => (
    <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100 flex-shrink-0">
      <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
        <BookOpen size={14} className="text-white" />
      </div>
      {!collapsed && <span className="font-bold text-gray-900 text-sm">SAAP</span>}
      <button onClick={() => setCollapsed(c => !c)} className="ml-auto text-gray-400 hover:text-gray-600 transition hidden md:block">
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger — shown in topbar via Topbar component */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-4 z-40 p-2 bg-white border border-gray-200 rounded-lg shadow-sm"
      >
        <Menu size={16} className="text-gray-600" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-56 bg-white flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                  <BookOpen size={14} className="text-white" />
                </div>
                <span className="font-bold text-gray-900 text-sm">SAAP</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <NavContent collapsed={false} pathname={pathname} unreadCount={unreadCount} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-gray-200 h-screen sticky top-0 transition-all duration-200 flex-shrink-0 ${collapsed ? "w-14" : "w-56"}`}>
        <Logo />
        <NavContent collapsed={collapsed} pathname={pathname} unreadCount={unreadCount} />
      </aside>
    </>
  );
}

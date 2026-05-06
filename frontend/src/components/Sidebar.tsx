"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getNotifications } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  BookOpen, Upload, FileText, CheckSquare, BarChart2,
  Building2, Users, Database, Layout, History,
  Download, AlertTriangle, Sliders, Bell, Globe,
  ChevronLeft, ChevronRight, LogOut, Home, Menu, X,
  CalendarCheck, Award, Brain, Shield, MessageCircle,
  Target, GitMerge, Eye, ClipboardCheck, Moon, Sun,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { Role } from "@/lib/auth";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  roles?: Role[];
  permission?: string;
}

interface NavGroup {
  label: string;
  color: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Core", color: "blue",
    items: [
      { href: "/dashboard/syllabus",   icon: Upload,       label: "Syllabus",   permission: "upload_syllabus" },
      { href: "/dashboard/papers",     icon: FileText,     label: "Papers",     permission: "generate_papers" },
      { href: "/dashboard/preview",    icon: Eye,          label: "Preview",    permission: "generate_papers" },
      { href: "/dashboard/evaluation", icon: CheckSquare,  label: "Evaluation", permission: "evaluate_assignments" },
      { href: "/dashboard/analytics",  icon: BarChart2,    label: "Analytics",  permission: "view_own_analytics" },
    ],
  },
  {
    label: "Accreditation", color: "purple",
    items: [
      { href: "/dashboard/co-po",       icon: Target,        label: "CO-PO Mapping",  permission: "generate_accreditation" },
      { href: "/dashboard/obe",         icon: GitMerge,      label: "OBE Attainment", permission: "view_own_analytics" },
      { href: "/dashboard/moderation",  icon: ClipboardCheck,label: "Moderation",     permission: "generate_papers" },
      { href: "/dashboard/accreditation",icon: Shield,       label: "Reports",        permission: "generate_accreditation" },
      { href: "/dashboard/bloom-report",icon: Brain,         label: "Bloom Report",   permission: "view_own_analytics" },
    ],
  },
  {
    label: "Management", color: "purple",
    items: [
      { href: "/dashboard/setup",       icon: Building2, label: "College Setup", permission: "manage_colleges" },
      { href: "/dashboard/departments", icon: Users,     label: "Departments",   roles: ["hod", "admin"] },
    ],
  },
  {
    label: "Features", color: "green",
    items: [
      { href: "/dashboard/question-bank", icon: Database,      label: "Question Bank", permission: "use_question_bank" },
      { href: "/dashboard/rubrics",       icon: Layout,        label: "Rubrics",       permission: "build_rubrics" },
      { href: "/dashboard/versions",      icon: History,       label: "Versions" },
      { href: "/dashboard/export",        icon: Download,      label: "Export" },
      { href: "/dashboard/plagiarism",    icon: AlertTriangle, label: "Plagiarism" },
      { href: "/dashboard/calibration",   icon: Sliders,       label: "Calibration" },
      { href: "/dashboard/templates",     icon: FileText,      label: "Templates" },
      { href: "/dashboard/bulk-import",   icon: Users,         label: "Bulk Import" },
      { href: "/dashboard/attendance",    icon: CalendarCheck, label: "Attendance" },
      { href: "/dashboard/certificates",  icon: Award,         label: "Certificates" },
      { href: "/dashboard/bloom-report",  icon: Brain,         label: "Bloom Report" },
      { href: "/dashboard/comparative",   icon: BarChart2,     label: "Comparative",   permission: "view_dept_analytics" },
      { href: "/dashboard/scanner",       icon: FileText,      label: "Sheet Scanner" },
      { href: "/dashboard/prediction",    icon: Brain,         label: "Prediction" },
    ],
  },
  {
    label: "Admin", color: "red",
    items: [
      { href: "/dashboard/schedule",      icon: CalendarCheck, label: "Exam Schedule" },
      { href: "/dashboard/notify",        icon: Bell,          label: "Notify",        roles: ["hod", "admin"] },
      { href: "/dashboard/audit",         icon: Shield,        label: "Audit Log",     roles: ["hod", "admin"] },
      { href: "/dashboard/admin",         icon: Users,         label: "Super Admin",   roles: ["admin"] },
    ],
  },
  {
    label: "Other", color: "gray",
    items: [
      { href: "/dashboard/notifications", icon: Bell,          label: "Notifications" },
      { href: "/dashboard/lms",           icon: Globe,         label: "LMS" },
      { href: "/dashboard/chatbot",       icon: MessageCircle, label: "AI Assistant" },
    ],
  },
];

const COLOR_ACTIVE: Record<string, string> = {
  blue:   "bg-blue-50 text-blue-700 border-l-2 border-blue-500",
  purple: "bg-purple-50 text-purple-700 border-l-2 border-purple-500",
  green:  "bg-green-50 text-green-700 border-l-2 border-green-500",
  gray:   "bg-gray-100 text-gray-700 border-l-2 border-gray-400",
  red:    "bg-red-50 text-red-700 border-l-2 border-red-500",
};

function NavContent({
  collapsed, pathname, unreadCount, onNavigate,
}: {
  collapsed: boolean; pathname: string; unreadCount: number; onNavigate?: () => void;
}) {
  const auth = useAuth();

  // Filter nav items based on role/permissions
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.roles && !auth.is(...item.roles)) return false;
      if (item.permission && !auth.can(item.permission)) return false;
      return true;
    }),
  })).filter((g) => g.items.length > 0);
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
        {visibleGroups.map((group) => (
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

      {/* Role badge + Footer */}
      <div className="border-t border-gray-100 px-2 py-3 space-y-1">
        {!collapsed && auth.role && (
          <div className="px-2 py-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              auth.role === "admin"   ? "bg-red-100 text-red-700" :
              auth.role === "hod"    ? "bg-purple-100 text-purple-700" :
              auth.role === "student"? "bg-green-100 text-green-700" :
                                       "bg-blue-100 text-blue-700"
            }`}>
              {auth.role.toUpperCase()}
            </span>
          </div>
        )}
        {/* Dark mode toggle */}
        <DarkModeToggle collapsed={collapsed} />
        <button
          onClick={auth.logout}
          title={collapsed ? "Sign out" : undefined}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
        >
          <LogOut size={14} className="flex-shrink-0" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </>
  );
}

function DarkModeToggle({ collapsed }: { collapsed: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  return (
    <button
      onClick={toggle}
      title={collapsed ? (dark ? "Light mode" : "Dark mode") : undefined}
      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition"
    >
      {dark ? <Sun size={14} className="flex-shrink-0" /> : <Moon size={14} className="flex-shrink-0" />}
      {!collapsed && (dark ? "Light mode" : "Dark mode")}
    </button>
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

"use client";
/**
 * Dashboard Home — real stats, quick actions, activity feed, onboarding wizard.
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  getNotifications, listColleges, listSubjects, listClasses,
} from "@/lib/api";
import { api } from "@/lib/api";
import {
  Upload, FileText, CheckSquare, BarChart2, Building2,
  Bell, ChevronRight, Zap, TrendingUp, Users, BookOpen,
  AlertTriangle, CheckCircle, Clock, ArrowRight, X,
  Brain, Shield, Database, Award,
} from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/auth";

// ── Onboarding steps ──────────────────────────────────────────
const ONBOARDING_STEPS = [
  { id: "college",  label: "Create your college",   href: "/dashboard/setup",    icon: Building2 },
  { id: "subject",  label: "Add a subject",          href: "/dashboard/setup",    icon: BookOpen },
  { id: "class",    label: "Create a class",         href: "/dashboard/setup",    icon: Users },
  { id: "syllabus", label: "Upload a syllabus PDF",  href: "/dashboard/syllabus", icon: Upload },
  { id: "paper",    label: "Generate your first paper", href: "/dashboard/papers", icon: FileText },
];

// ── Quick actions by role ─────────────────────────────────────
const QUICK_ACTIONS = {
  faculty: [
    { label: "Upload Syllabus",    href: "/dashboard/syllabus",   icon: Upload,      color: "blue" },
    { label: "Generate Paper",     href: "/dashboard/papers",     icon: FileText,    color: "purple" },
    { label: "Start Evaluation",   href: "/dashboard/evaluation", icon: CheckSquare, color: "green" },
    { label: "View Analytics",     href: "/dashboard/analytics",  icon: BarChart2,   color: "orange" },
  ],
  hod: [
    { label: "Department Summary", href: "/dashboard/analytics",     icon: BarChart2,   color: "blue" },
    { label: "Comparative View",   href: "/dashboard/comparative",   icon: TrendingUp,  color: "purple" },
    { label: "Accreditation",      href: "/dashboard/accreditation", icon: Shield,      color: "green" },
    { label: "Bloom's Report",     href: "/dashboard/bloom-report",  icon: Brain,       color: "orange" },
  ],
  admin: [
    { label: "College Setup",      href: "/dashboard/setup",         icon: Building2,   color: "blue" },
    { label: "Departments",        href: "/dashboard/departments",   icon: Users,       color: "purple" },
    { label: "Question Bank",      href: "/dashboard/question-bank", icon: Database,    color: "green" },
    { label: "Accreditation",      href: "/dashboard/accreditation", icon: Shield,      color: "orange" },
  ],
  student: [],
};

const COLOR_BG: Record<string, string> = {
  blue:   "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
  green:  "bg-green-50 text-green-600 group-hover:bg-green-100",
  orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
};

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${COLOR_BG[color]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Onboarding wizard ─────────────────────────────────────────
function OnboardingWizard({ collegeCount }: { collegeCount: number }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const d = localStorage.getItem("onboarding_dismissed");
    if (d) setDismissed(true);
  }, []);

  if (dismissed || collegeCount > 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 mb-6 text-white relative">
      <button
        onClick={() => { setDismissed(true); localStorage.setItem("onboarding_dismissed", "1"); }}
        className="absolute top-3 right-3 text-blue-200 hover:text-white transition"
      >
        <X size={16} />
      </button>
      <div className="flex items-center gap-2 mb-3">
        <Zap size={18} className="text-yellow-300" />
        <h2 className="font-bold text-sm">Get started in 5 steps</h2>
      </div>
      <div className="space-y-2">
        {ONBOARDING_STEPS.map((step, i) => (
          <Link key={step.id} href={step.href}
            className="flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-2.5 transition group">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {i + 1}
            </div>
            <step.icon size={14} className="flex-shrink-0 text-blue-200" />
            <span className="text-sm font-medium flex-1">{step.label}</span>
            <ArrowRight size={13} className="text-blue-300 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function DashboardPage() {
  const auth = useAuth();
  const role = (auth.role as Role) || "faculty";
  const collegeId = auth.collegeId ?? "";

  // Fetch stats
  const { data: notifData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => getNotifications(true),
    refetchInterval: 30_000,
    enabled: auth.isAuthenticated,
  });

  const { data: collegesData } = useQuery({
    queryKey: ["colleges"],
    queryFn: listColleges,
    enabled: auth.isAuthenticated,
  });

  const { data: subjectsData } = useQuery({
    queryKey: ["subjects", collegeId],
    queryFn: () => listSubjects(collegeId),
    enabled: !!collegeId,
  });

  const { data: classesData } = useQuery({
    queryKey: ["classes", collegeId],
    queryFn: () => listClasses(collegeId),
    enabled: !!collegeId,
  });

  const { data: papersData } = useQuery({
    queryKey: ["recent-papers"],
    queryFn: () => api.get("/papers/recent").then(r => r.data).catch(() => ({ data: [] })),
    enabled: auth.isAuthenticated,
  });

  // Handle both raw and enveloped responses
  const colleges  = collegesData?.data?.colleges  ?? collegesData?.colleges  ?? [];
  const subjects  = subjectsData?.data?.subjects  ?? subjectsData?.subjects  ?? [];
  const classes   = classesData?.data?.classes    ?? classesData?.classes    ?? [];
  const unread    = notifData?.data?.unread_count ?? notifData?.unread_count ?? 0;

  const quickActions = QUICK_ACTIONS[role] ?? QUICK_ACTIONS.faculty;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="max-w-5xl mx-auto p-6">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {greeting()}, {auth.user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {ROLE_LABELS[role]} · Smart Academic Automation Platform
          </p>
        </div>
        {unread > 0 && (
          <Link href="/dashboard/notifications"
            className="flex items-center gap-2 bg-red-50 text-red-600 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-red-100 transition">
            <Bell size={13} />
            {unread} unread
          </Link>
        )}
      </div>

      {/* Onboarding wizard — only shown to new users */}
      <OnboardingWizard collegeCount={colleges.length} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Colleges"  value={colleges.length}  icon={Building2}   color="blue" />
        <StatCard label="Subjects"  value={subjects.length}  icon={BookOpen}    color="purple" />
        <StatCard label="Classes"   value={classes.length}   icon={Users}       color="green" />
        <StatCard label="Unread"    value={unread}           icon={Bell}        color="orange"
          sub={unread > 0 ? "notifications" : "all caught up"} />
      </div>

      {/* Quick actions */}
      <div className="mb-6">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map(({ label, href, icon: Icon, color }) => (
            <Link key={href} href={href}
              className="group bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition p-4 flex flex-col items-center gap-2 text-center">
              <div className={`p-2.5 rounded-xl transition ${COLOR_BG[color]}`}>
                <Icon size={18} />
              </div>
              <span className="text-xs font-semibold text-gray-700 group-hover:text-blue-600 transition leading-tight">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Two-column: recent activity + tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Recent notifications as activity feed */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm text-gray-900">Recent Activity</h2>
            <Link href="/dashboard/notifications"
              className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <ActivityFeed />
        </div>

        {/* Feature highlights */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-sm text-gray-900 mb-4">Platform Highlights</h2>
          <div className="space-y-3">
            {[
              { icon: Brain,         color: "blue",   title: "Bloom's Taxonomy",    desc: "Auto-maps questions to all 6 cognitive levels" },
              { icon: CheckCircle,   color: "green",  title: "Auto Evaluation",     desc: "3-signal grading: keyword + semantic + rubric" },
              { icon: AlertTriangle, color: "orange", title: "Plagiarism Detection",desc: "TF-IDF cosine similarity across all submissions" },
              { icon: Award,         color: "purple", title: "Accreditation Ready", desc: "NBA, NAAC, NIRF reports generated automatically" },
              { icon: TrendingUp,    color: "blue",   title: "At-Risk Detection",   desc: "Flags students scoring below threshold early" },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className={`p-1.5 rounded-lg flex-shrink-0 ${COLOR_BG[color]}`}>
                  <Icon size={13} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">{title}</p>
                  <p className="text-[11px] text-gray-400 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Activity feed component ───────────────────────────────────
function ActivityFeed() {
  const auth = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications-feed"],
    queryFn: () => getNotifications(false),
    enabled: auth.isAuthenticated,
  });

  const notifications = data?.data?.notifications ?? data?.notifications ?? [];

  const typeIcon = (type: string) => {
    if (type?.includes("syllabus")) return { icon: Upload,      color: "blue" };
    if (type?.includes("eval"))     return { icon: CheckSquare, color: "green" };
    if (type?.includes("paper"))    return { icon: FileText,    color: "purple" };
    if (type?.includes("review"))   return { icon: AlertTriangle, color: "orange" };
    return { icon: Bell, color: "gray" };
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-7 h-7 bg-gray-100 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-100 rounded w-3/4" />
              <div className="h-2.5 bg-gray-50 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400">
        <Bell size={28} className="mx-auto mb-2 opacity-30" />
        <p className="text-xs">No activity yet.</p>
        <p className="text-[11px] mt-0.5">Upload a syllabus to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.slice(0, 6).map((n: any) => {
        const { icon: Icon, color } = typeIcon(n.type);
        return (
          <div key={n.id} className="flex items-start gap-3">
            <div className={`p-1.5 rounded-lg flex-shrink-0 ${COLOR_BG[color]}`}>
              <Icon size={12} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-medium truncate ${n.is_read ? "text-gray-500" : "text-gray-800"}`}>
                {n.title}
              </p>
              <p className="text-[11px] text-gray-400 truncate">{n.message}</p>
            </div>
            {!n.is_read && (
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}

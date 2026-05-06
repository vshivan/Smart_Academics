"use client";
/**
 * Student Portal Layout
 * Separate from the faculty/admin dashboard — students see only their own data.
 */
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import {
  BookOpen, BarChart2, CalendarCheck, Award,
  Bell, LogOut, Home, ChevronRight,
} from "lucide-react";

const NAV = [
  { href: "/student",             icon: Home,         label: "Overview" },
  { href: "/student/results",     icon: BarChart2,    label: "My Results" },
  { href: "/student/attendance",  icon: CalendarCheck,label: "Attendance" },
  { href: "/student/certificates",icon: Award,        label: "Certificates" },
];

function StudentContent({ children }: { children: React.ReactNode }) {
  const auth      = useAuth();
  const router    = useRouter();
  const pathname  = usePathname();
  const { error } = useToast();
  const params    = useSearchParams();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.replace("/");
    }
    if (!auth.isLoading && auth.isAuthenticated && !auth.is("student")) {
      // Faculty/admin accidentally hit /student — redirect to their dashboard
      router.replace("/dashboard");
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.role]);

  useEffect(() => {
    if (params.get("session_expired") === "1") {
      error("Session expired", "Please sign in again.");
    }
  }, [params]);

  if (auth.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-52 bg-white border-r border-gray-200 h-screen sticky top-0 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
            <BookOpen size={14} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-sm block">SAAP</span>
            <span className="text-[10px] text-green-600 font-semibold">Student Portal</span>
          </div>
        </div>

        {/* User info */}
        {auth.user && (
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {auth.user.picture ? (
                <img src={auth.user.picture} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-bold">
                  {auth.user.name?.[0]?.toUpperCase() ?? "S"}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{auth.user.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{auth.user.email}</p>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition ${
                  active
                    ? "bg-green-50 text-green-700 border-l-2 border-green-500"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}>
                <Icon size={15} className="flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 px-2 py-3">
          <button
            onClick={auth.logout}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-gray-400">Student Portal</span>
            <ChevronRight size={13} className="text-gray-300" />
            <span className="font-semibold text-gray-800">
              {NAV.find(n => n.href === pathname)?.label ?? ""}
            </span>
          </div>
          <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
            STUDENT
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <StudentContent>{children}</StudentContent>
    </Suspense>
  );
}

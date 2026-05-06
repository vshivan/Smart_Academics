"use client";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import CommandPalette from "@/components/CommandPalette";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { error }    = useToast();
  const auth         = useAuth();
  const router       = useRouter();

  // Show toast for permission errors from middleware redirect
  useEffect(() => {
    if (searchParams.get("error") === "insufficient_permissions") {
      error("Access denied", "You don't have permission to view that page.");
    }
    if (searchParams.get("session_expired") === "1") {
      error("Session expired", "Please sign in again.");
    }
  }, [searchParams]);

  // Client-side auth guard (belt-and-suspenders alongside middleware)
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.replace("/");
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  if (auth.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar />
        <main key={pathname} className="flex-1 overflow-y-auto animate-fade-in">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}

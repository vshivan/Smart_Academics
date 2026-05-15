"use client";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import CommandPalette from "@/components/CommandPalette";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveSession, decodeToken, type User } from "@/lib/auth";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { error, success } = useToast();
  const auth         = useAuth();
  const router       = useRouter();

  // Auto-refresh token if college_id is missing (stale JWT from before college was assigned)
  useEffect(() => {
    if (auth.isAuthenticated && !auth.collegeId) {
      api.post("/auth/refresh").then((resp) => {
        const newToken: string = resp.data?.access_token;
        if (newToken) {
          const payload = decodeToken(newToken);
          const currentUser = auth.user ?? { email: "", name: "", role: "faculty" as const };
          saveSession(newToken, {
            ...currentUser,
            role: (payload?.role as User["role"]) ?? currentUser.role,
          });
          // Reload page to pick up new JWT
          window.location.reload();
        }
      }).catch(() => {
        // Refresh failed silently — user can log out and back in manually
      });
    }
  }, [auth.isAuthenticated, auth.collegeId]);

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

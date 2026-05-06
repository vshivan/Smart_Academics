/**
 * Next.js Edge Middleware — Route Guards
 *
 * Runs on every request before the page renders.
 * Protects /dashboard routes by verifying the JWT stored in a cookie.
 *
 * Why cookie instead of localStorage?
 *   localStorage is not accessible in middleware (Edge Runtime).
 *   On login, the callback page writes the token to both localStorage
 *   (for the Axios client) and a secure HttpOnly-like cookie (for middleware).
 *
 * Role-based redirects:
 *   - /dashboard/accreditation  → hod, admin only
 *   - /dashboard/departments    → hod, admin only
 *   - /dashboard/comparative    → hod, admin only
 *   - /dashboard/setup          → admin only (college creation)
 *   All other /dashboard routes → any authenticated user
 */
import { NextRequest, NextResponse } from "next/server";

// ── JWT decode (Edge-safe, no crypto library needed for payload read) ─────────
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → Base64 → JSON
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenExpired(payload: Record<string, unknown>): boolean {
  const exp = payload["exp"];
  if (typeof exp !== "number") return true;
  return Date.now() / 1000 > exp;
}

// ── Route permission map ──────────────────────────────────────────────────────
const ROLE_RESTRICTED: Record<string, string[]> = {
  "/dashboard/accreditation": ["hod", "admin"],
  "/dashboard/departments":   ["hod", "admin"],
  "/dashboard/comparative":   ["hod", "admin"],
  "/dashboard/setup":         ["admin"],
};

// ── Middleware ────────────────────────────────────────────────────────────────
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard /dashboard and /student routes
  const isDashboard = pathname.startsWith("/dashboard");
  const isStudent   = pathname.startsWith("/student");

  if (!isDashboard && !isStudent) {
    return NextResponse.next();
  }

  // Read token from cookie (set by auth callback page)
  const token = request.cookies.get("saap_token")?.value;

  if (!token) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = decodeJwtPayload(token);

  if (!payload || isTokenExpired(payload)) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("session_expired", "1");
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("saap_token");
    return response;
  }

  const role = (payload["role"] as string) || "faculty";

  // Students must use /student, not /dashboard
  if (isDashboard && role === "student") {
    return NextResponse.redirect(new URL("/student", request.url));
  }

  // Non-students must use /dashboard, not /student
  if (isStudent && role !== "student") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Check role-restricted dashboard routes
  if (isDashboard) {
    const allowedRoles = ROLE_RESTRICTED[pathname];
    if (allowedRoles && !allowedRoles.includes(role)) {
      const dashboardUrl = new URL("/dashboard", request.url);
      dashboardUrl.searchParams.set("error", "insufficient_permissions");
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Inject user context into request headers for server components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id",    (payload["user_id"] as string) || "");
  requestHeaders.set("x-user-role",  role);
  requestHeaders.set("x-college-id", (payload["college_id"] as string) || "");

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/student/:path*",
  ],
};

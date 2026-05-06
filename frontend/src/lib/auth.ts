/**
 * Auth utilities — token management, user context, role helpers.
 *
 * Token storage strategy:
 *   - localStorage["access_token"]  → used by Axios interceptor for API calls
 *   - document.cookie "saap_token"  → used by Next.js middleware for SSR route guards
 *
 * Both are set on login and cleared on logout.
 */

export interface User {
  email: string;
  name: string;
  picture?: string;
  role: "admin" | "hod" | "faculty" | "student";
}

export interface JwtPayload {
  user_id: string;
  email: string;
  name?: string;
  picture?: string;
  college_id?: string;
  role: string;
  permissions: string[];
  exp: number;
}

// ── Token storage ─────────────────────────────────────────────────────────────
export function saveSession(token: string, user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", token);
  localStorage.setItem("user", JSON.stringify(user));
  // Write to cookie for middleware (SameSite=Strict, no HttpOnly so JS can clear it)
  const maxAge = 8 * 60 * 60; // 8 hours — matches JWT expiry
  document.cookie = `saap_token=${token}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
  // Expire the cookie
  document.cookie = "saap_token=; path=/; max-age=0; SameSite=Strict";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

// ── JWT decode (client-side, no signature verification) ───────────────────────
export function decodeToken(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload) return true;
  return Date.now() / 1000 > payload.exp;
}

export function getCurrentPayload(): JwtPayload | null {
  const token = getToken();
  if (!token) return null;
  if (isTokenExpired(token)) {
    clearSession();
    return null;
  }
  return decodeToken(token);
}

// ── Role helpers ──────────────────────────────────────────────────────────────
export type Role = "admin" | "hod" | "faculty" | "student";

export function getCurrentRole(): Role {
  const payload = getCurrentPayload();
  return (payload?.role as Role) || "faculty";
}

export function hasRole(...roles: Role[]): boolean {
  return roles.includes(getCurrentRole());
}

export function hasPermission(permission: string): boolean {
  const payload = getCurrentPayload();
  return payload?.permissions?.includes(permission) ?? false;
}

export function isAdmin(): boolean {
  return getCurrentRole() === "admin";
}

export function isHodOrAdmin(): boolean {
  return hasRole("hod", "admin");
}

export function isStudent(): boolean {
  return getCurrentRole() === "student";
}

// ── Role display helpers ──────────────────────────────────────────────────────
export const ROLE_LABELS: Record<Role, string> = {
  admin:   "Administrator",
  hod:     "Head of Department",
  faculty: "Faculty",
  student: "Student",
};

export const ROLE_COLORS: Record<Role, string> = {
  admin:   "bg-red-100 text-red-700",
  hod:     "bg-purple-100 text-purple-700",
  faculty: "bg-blue-100 text-blue-700",
  student: "bg-green-100 text-green-700",
};

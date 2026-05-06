/**
 * useAuth — React hook for accessing the current user's auth state.
 *
 * Reads from localStorage (populated by the callback page).
 * Returns null during SSR / before hydration.
 */
"use client";
import { useState, useEffect } from "react";
import {
  getCurrentPayload,
  getStoredUser,
  clearSession,
  hasPermission,
  hasRole,
  type JwtPayload,
  type User,
  type Role,
} from "@/lib/auth";

export interface AuthState {
  user: User | null;
  payload: JwtPayload | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: Role;
  permissions: string[];
  collegeId: string | null;
  userId: string | null;
  can: (permission: string) => boolean;
  is: (...roles: Role[]) => boolean;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [payload, setPayload]   = useState<JwtPayload | null>(null);
  const [user, setUser]         = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    const p = getCurrentPayload();
    const u = getStoredUser();
    setPayload(p);
    setUser(u);
    setLoading(false);
  }, []);

  const logout = () => {
    clearSession();
    window.location.href = "/";
  };

  return {
    user,
    payload,
    isLoading,
    isAuthenticated: !!payload,
    role:        (payload?.role as Role) ?? "faculty",
    permissions: payload?.permissions ?? [],
    collegeId:   payload?.college_id ?? null,
    userId:      payload?.user_id ?? null,
    can:         (permission: string) => payload?.permissions?.includes(permission) ?? false,
    is:          (...roles: Role[]) => roles.includes((payload?.role as Role) ?? "faculty"),
    logout,
  };
}

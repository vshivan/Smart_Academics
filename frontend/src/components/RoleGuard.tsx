"use client";
/**
 * RoleGuard — client-side component for role-based UI rendering.
 *
 * Usage:
 *   // Show only to admins
 *   <RoleGuard roles={["admin"]}>
 *     <AdminPanel />
 *   </RoleGuard>
 *
 *   // Show only if user has a specific permission
 *   <RoleGuard permission="generate_accreditation">
 *     <AccreditationButton />
 *   </RoleGuard>
 *
 *   // Show fallback to non-admins
 *   <RoleGuard roles={["admin"]} fallback={<p>Admin only</p>}>
 *     <AdminPanel />
 *   </RoleGuard>
 */
import { useAuth, type AuthState } from "@/hooks/useAuth";
import type { Role } from "@/lib/auth";

interface RoleGuardProps {
  children: React.ReactNode;
  /** Allowed roles — user must have at least one */
  roles?: Role[];
  /** Required permission — user must have this in their JWT permissions list */
  permission?: string;
  /** Rendered when the user does not meet the requirements */
  fallback?: React.ReactNode;
}

export default function RoleGuard({
  children,
  roles,
  permission,
  fallback = null,
}: RoleGuardProps) {
  const auth = useAuth();

  if (auth.isLoading) return null;

  // Check role requirement
  if (roles && roles.length > 0 && !auth.is(...roles)) {
    return <>{fallback}</>;
  }

  // Check permission requirement
  if (permission && !auth.can(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export function AdminOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return <RoleGuard roles={["admin"]} fallback={fallback}>{children}</RoleGuard>;
}

export function HodOrAdminOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return <RoleGuard roles={["hod", "admin"]} fallback={fallback}>{children}</RoleGuard>;
}

export function FacultyAndAbove({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return <RoleGuard roles={["faculty", "hod", "admin"]} fallback={fallback}>{children}</RoleGuard>;
}

export function StudentOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return <RoleGuard roles={["student"]} fallback={fallback}>{children}</RoleGuard>;
}

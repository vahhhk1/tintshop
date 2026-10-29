/**
 * Role-based access control. Isomorphic so navigation can hide items the
 * user cannot open — the server still enforces every permission.
 */
export const ROLES = ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const;
export type RoleName = (typeof ROLES)[number];

const STAFF_UP: readonly RoleName[] = ["STAFF", "ADMIN", "SUPER_ADMIN"];
const ADMIN_UP: readonly RoleName[] = ["ADMIN", "SUPER_ADMIN"];
const SUPER_ONLY: readonly RoleName[] = ["SUPER_ADMIN"];

export const PERMISSIONS = {
  "admin:access": STAFF_UP,
  "appointments:manage": STAFF_UP,
  "quotes:manage": STAFF_UP,
  "messages:manage": STAFF_UP,
  "customers:view": STAFF_UP,
  "gallery:manage": STAFF_UP,
  "customers:manage": ADMIN_UP,
  "reviews:manage": ADMIN_UP,
  "services:manage": ADMIN_UP,
  "pricing:manage": ADMIN_UP,
  "coupons:manage": ADMIN_UP,
  "technicians:manage": ADMIN_UP,
  "schedule:manage": ADMIN_UP,
  "payments:view": ADMIN_UP,
  "payments:manage": ADMIN_UP,
  "reports:view": ADMIN_UP,
  "settings:business": ADMIN_UP,
  /** Tax, deposits, policies and legal pages. */
  "settings:critical": SUPER_ONLY,
  /** Creating staff/admin accounts and changing roles. */
  "users:manage": SUPER_ONLY,
} as const satisfies Record<string, readonly RoleName[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: RoleName | null | undefined, permission: Permission) {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly RoleName[]).includes(role);
}

export function isStaffRole(role: RoleName | null | undefined) {
  return can(role, "admin:access");
}

export const ROLE_LABELS: Record<RoleName, string> = {
  CUSTOMER: "Customer",
  STAFF: "Staff",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super admin",
};

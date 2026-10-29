import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { auth } from "./index";
import { can, type Permission, type RoleName } from "./roles";

export interface SessionUser {
  id: string;
  name: string | null;
  email: string;
  role: RoleName;
  image: string | null;
  phone: string | null;
}

/**
 * Current user, re-read from the database on every request (deduped per render)
 * so role changes and deactivations take effect immediately.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, image: true, phone: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, image: user.image, phone: user.phone };
});

/** For pages: redirect to login when signed out. */
export async function requireUser(callbackUrl = "/dashboard") {
  const user = await getSessionUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return user;
}

/** For admin pages: redirect when the user lacks a permission. */
export async function requirePermission(permission: Permission, callbackUrl = "/admin") {
  const user = await getSessionUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  if (!can(user.role, "admin:access")) redirect("/dashboard");
  if (!can(user.role, permission)) redirect("/admin?denied=1");
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function assertPermission(permission: Permission) {
  const user = await getSessionUser();
  if (!user) throw new AuthorizationError("Please sign in again.");
  if (!can(user.role, permission)) throw new AuthorizationError();
  return user;
}

export async function assertUser() {
  const user = await getSessionUser();
  if (!user) throw new AuthorizationError("Please sign in again.");
  return user;
}

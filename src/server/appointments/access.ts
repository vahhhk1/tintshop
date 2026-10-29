import "server-only";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";

export function tokenMatches(expected: string, provided?: string | null) {
  if (!provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const appointmentDetailInclude = {
  service: { select: { id: true, name: true, slug: true, imageUrl: true, parentId: true } },
  serviceOption: { select: { id: true, name: true } },
  filmType: { select: { id: true, name: true } },
  vehicleType: { select: { id: true, name: true } },
  vehicleSize: { select: { id: true, name: true } },
  technician: { select: { id: true, name: true } },
  items: { orderBy: { id: "asc" as const } },
  payments: { orderBy: { createdAt: "desc" as const } },
  coupon: { select: { code: true } },
  review: { select: { id: true, status: true } },
} as const;

export async function findAppointmentDetail(id: string) {
  return prisma.appointment.findUnique({ where: { id }, include: appointmentDetailInclude });
}
export type AppointmentDetail = NonNullable<Awaited<ReturnType<typeof findAppointmentDetail>>>;

/**
 * Loads an appointment if the viewer may see it: via the secret guest token,
 * as the owning customer, or as staff.
 */
export async function getAppointmentForViewer(id: string, token?: string | null) {
  const appointment = await findAppointmentDetail(id);
  if (!appointment) return null;
  if (tokenMatches(appointment.manageToken, token)) return { appointment, isStaff: false };
  const user = await getSessionUser();
  if (!user) return null;
  const isStaff = can(user.role, "appointments:manage");
  if (appointment.userId === user.id || isStaff) return { appointment, isStaff };
  return null;
}

export async function getAppointmentByToken(token: string) {
  if (!token || token.length > 128) return null;
  const appointment = await prisma.appointment.findUnique({ where: { manageToken: token }, include: appointmentDetailInclude });
  return appointment;
}

export const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "DEPOSIT_PAID", "IN_PROGRESS"] as const;

export function isHoldExpired(a: { status: string; holdExpiresAt: Date | null; amountPaid: number }) {
  return a.status === "PENDING" && a.amountPaid === 0 && a.holdExpiresAt !== null && a.holdExpiresAt.getTime() < Date.now();
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { assertUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { limitByIp } from "@/lib/rate-limit";
import { fieldErrors, idField, type ActionResult } from "@/lib/validation/common";
import { changePasswordSchema, profileSchema, vehicleSchema } from "@/lib/validation/public";
import { getAppointmentByToken } from "@/server/appointments/access";

async function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Error && error.name === "AuthorizationError") return { ok: false, error: error.message };
    console.error("[customer-action]", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Links a guest booking to the signed-in account when the email matches. */
export async function claimAppointmentAction(input: { token: string }): Promise<ActionResult> {
  return guard(async () => {
    const user = await assertUser();
    const a = await getAppointmentByToken(input.token);
    if (!a) return { ok: false, error: "Appointment not found." };
    if (a.userId) return { ok: false, error: "This booking is already linked to an account." };
    if (a.customerEmail.toLowerCase() !== user.email.toLowerCase()) return { ok: false, error: "This booking was made with a different email address." };
    await prisma.appointment.update({ where: { id: a.id }, data: { userId: user.id } });
    await prisma.payment.updateMany({ where: { appointmentId: a.id, userId: null }, data: { userId: user.id } });
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Booking added to your account." };
  });
}

export async function saveVehicleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const user = await assertUser();
    const raw = (input ?? {}) as { id?: string };
    const parsed = vehicleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const data = parsed.data;
    if (raw.id) {
      const existing = await prisma.vehicle.findFirst({ where: { id: raw.id, userId: user.id } });
      if (!existing) return { ok: false, error: "Vehicle not found." };
      await prisma.vehicle.update({ where: { id: existing.id }, data });
      revalidatePath("/dashboard/vehicles");
      return { ok: true, message: "Vehicle updated.", data: { id: existing.id } };
    }
    const count = await prisma.vehicle.count({ where: { userId: user.id } });
    if (count >= 20) return { ok: false, error: "You can save up to 20 vehicles." };
    const vehicle = await prisma.vehicle.create({ data: { ...data, userId: user.id } });
    revalidatePath("/dashboard/vehicles");
    return { ok: true, message: "Vehicle saved.", data: { id: vehicle.id } };
  });
}

export async function deleteVehicleAction(input: { id: string }): Promise<ActionResult> {
  return guard(async () => {
    const user = await assertUser();
    const id = idField.parse(input.id);
    const result = await prisma.vehicle.deleteMany({ where: { id, userId: user.id } });
    if (!result.count) return { ok: false, error: "Vehicle not found." };
    revalidatePath("/dashboard/vehicles");
    return { ok: true, message: "Vehicle removed." };
  });
}

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const user = await assertUser();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const { name, phone, ...profile } = parsed.data;
    await prisma.user.update({
      where: { id: user.id },
      data: { name, phone, profile: { upsert: { create: profile, update: profile } } },
    });
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Profile saved." };
  });
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  return guard(async () => {
    const user = await assertUser();
    const limit = await limitByIp(`password-change:${user.id}`, 6, 15 * 60);
    if (!limit.success) return { ok: false, error: "Too many attempts. Please wait a few minutes." };
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    if (record.passwordHash) {
      const ok = parsed.data.currentPassword ? await verifyPassword(parsed.data.currentPassword, record.passwordHash) : false;
      if (!ok) return { ok: false, error: "Your current password is incorrect.", fieldErrors: { currentPassword: ["Incorrect password"] } };
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } });
    return { ok: true, message: record.passwordHash ? "Password changed." : "Password set — you can now sign in with email too." };
  });
}

export async function markNotificationsReadAction(input: { id?: string } = {}): Promise<ActionResult> {
  return guard(async () => {
    const user = await assertUser();
    const id = input.id ? z.string().max(64).parse(input.id) : undefined;
    await prisma.notification.updateMany({ where: { userId: user.id, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  });
}

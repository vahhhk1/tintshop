"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import type { ActionResult } from "@/lib/validation/common";
import { hmField, idField } from "@/lib/validation/common";
import {
  bookingRulesSchema,
  breakSchema,
  businessHoursSchema,
  businessSettingsSchema,
  couponSchema,
  holidaySchema,
  legalPageSchema,
  paymentSettingsSchema,
  staffUserSchema,
  technicianSchema,
  timeOffSchema,
} from "@/lib/validation/admin";
import { DEFAULT_SETTINGS } from "@/server/settings";
import { ymdToDateOnly, zonedToUtc, addDaysYmd } from "@/lib/time";
import { getSettings } from "@/server/settings";
import { adminAction, invalidate, parseForm } from "./helpers";

// ─── Coupons ─────────────────────────────────────────────────────────────────

export async function saveCouponAction(input: FormData): Promise<ActionResult> {
  return adminAction("coupons:manage", async () => {
    const parsed = parseForm(couponSchema, input);
    if (!parsed.ok) return parsed.result;
    const id = input.get("id");
    const { serviceIds, ...data } = parsed.data;
    if (typeof id === "string" && id) {
      await prisma.coupon.update({ where: { id }, data: { ...data, services: { set: serviceIds.map((s) => ({ id: s })) } } });
    } else {
      await prisma.coupon.create({ data: { ...data, services: { connect: serviceIds.map((s) => ({ id: s })) } } });
    }
    revalidatePath("/admin/coupons");
    return { ok: true, message: "Coupon saved." };
  });
}

export async function setCouponActiveAction(id: string, active: boolean): Promise<ActionResult> {
  return adminAction("coupons:manage", async () => {
    await prisma.coupon.update({ where: { id: idField.parse(id) }, data: { active } });
    revalidatePath("/admin/coupons");
    return { ok: true, message: active ? "Coupon enabled." : "Coupon disabled." };
  });
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  return adminAction("coupons:manage", async () => {
    const cid = idField.parse(id);
    const used = await prisma.couponRedemption.count({ where: { couponId: cid } });
    if (used) {
      await prisma.coupon.update({ where: { id: cid }, data: { active: false } });
      revalidatePath("/admin/coupons");
      return { ok: true, message: "This code has been redeemed, so it was disabled instead of deleted." };
    }
    await prisma.coupon.delete({ where: { id: cid } });
    revalidatePath("/admin/coupons");
    return { ok: true, message: "Coupon deleted." };
  });
}

// ─── Technicians ─────────────────────────────────────────────────────────────

export async function saveTechnicianAction(input: FormData): Promise<ActionResult> {
  return adminAction("technicians:manage", async () => {
    const parsed = parseForm(technicianSchema, input);
    if (!parsed.ok) return parsed.result;
    const id = input.get("id");
    const { serviceIds, ...data } = parsed.data;
    if (typeof id === "string" && id) {
      await prisma.technician.update({ where: { id }, data: { ...data, services: { set: serviceIds.map((s) => ({ id: s })) } } });
    } else {
      await prisma.technician.create({ data: { ...data, services: { connect: serviceIds.map((s) => ({ id: s })) } } });
    }
    invalidate("schedule");
    return { ok: true, message: "Technician saved." };
  });
}

const scheduleFormSchema = z.object({ technicianId: idField, useBusinessHours: z.string().optional() });

/** Weekly hours from a form with fields day-{n}-working / -start / -end. */
export async function saveTechnicianScheduleAction(input: FormData): Promise<ActionResult> {
  return adminAction("technicians:manage", async () => {
    const base = parseForm(scheduleFormSchema, input);
    if (!base.ok) return base.result;
    const { technicianId } = base.data;
    if (base.data.useBusinessHours) {
      await prisma.technicianSchedule.deleteMany({ where: { technicianId } });
      invalidate("schedule");
      return { ok: true, message: "Technician now follows business hours." };
    }
    const days = [];
    for (let d = 0; d < 7; d++) {
      const working = input.get(`day-${d}-working`) === "on";
      const start = hmField.safeParse(input.get(`day-${d}-start`));
      const end = hmField.safeParse(input.get(`day-${d}-end`));
      if (!working) continue;
      if (!start.success || !end.success || end.data <= start.data) return { ok: false, error: `Check the hours for day ${d === 0 ? "Sunday" : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d - 1]}.` };
      days.push({ technicianId, dayOfWeek: d, startTime: start.data, endTime: end.data });
    }
    await prisma.$transaction([prisma.technicianSchedule.deleteMany({ where: { technicianId } }), prisma.technicianSchedule.createMany({ data: days })]);
    invalidate("schedule");
    return { ok: true, message: "Schedule saved." };
  });
}

export async function addTimeOffAction(input: FormData): Promise<ActionResult> {
  return adminAction("technicians:manage", async () => {
    const parsed = parseForm(timeOffSchema, input);
    if (!parsed.ok) return parsed.result;
    const settings = await getSettings();
    const { technicianId, startDate, endDate, reason } = parsed.data;
    await prisma.technicianTimeOff.create({
      data: { technicianId, startsAt: zonedToUtc(startDate, "00:00", settings.timezone), endsAt: zonedToUtc(addDaysYmd(endDate, 1), "00:00", settings.timezone), reason },
    });
    invalidate("schedule");
    return { ok: true, message: "Time off added." };
  });
}

export async function deleteTimeOffAction(id: string): Promise<ActionResult> {
  return adminAction("technicians:manage", async () => {
    await prisma.technicianTimeOff.delete({ where: { id: idField.parse(id) } });
    invalidate("schedule");
    return { ok: true, message: "Time off removed." };
  });
}

export async function deleteTechnicianAction(id: string): Promise<ActionResult> {
  return adminAction("technicians:manage", async () => {
    const tid = idField.parse(id);
    const upcoming = await prisma.appointment.count({ where: { technicianId: tid, startsAt: { gt: new Date() }, status: { notIn: ["CANCELLED", "NO_SHOW"] } } });
    if (upcoming) return { ok: false, error: `Reassign their ${upcoming} upcoming appointments first, or deactivate them instead.` };
    await prisma.technician.delete({ where: { id: tid } });
    invalidate("schedule");
    return { ok: true, message: "Technician removed." };
  });
}

// ─── Hours, holidays, breaks, booking rules ─────────────────────────────────

export async function saveBusinessHoursAction(input: FormData): Promise<ActionResult> {
  return adminAction("schedule:manage", async () => {
    const days = Array.from({ length: 7 }, (_, d) => ({
      dayOfWeek: d,
      isOpen: input.get(`day-${d}-open`) === "on",
      openTime: String(input.get(`day-${d}-start`) ?? "09:00"),
      closeTime: String(input.get(`day-${d}-end`) ?? "18:00"),
    }));
    const parsed = businessHoursSchema.safeParse({ days });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the hours." };
    await prisma.$transaction(parsed.data.days.map((d) => prisma.businessHours.upsert({ where: { dayOfWeek: d.dayOfWeek }, create: d, update: d })));
    invalidate("schedule");
    return { ok: true, message: "Business hours saved." };
  });
}

export async function addHolidayAction(input: FormData): Promise<ActionResult> {
  return adminAction("schedule:manage", async () => {
    const parsed = parseForm(holidaySchema, input);
    if (!parsed.ok) return parsed.result;
    const { date, ...rest } = parsed.data;
    await prisma.holiday.upsert({ where: { date: ymdToDateOnly(date) }, create: { date: ymdToDateOnly(date), ...rest }, update: rest });
    invalidate("schedule");
    return { ok: true, message: "Holiday saved." };
  });
}

export async function deleteHolidayAction(id: string): Promise<ActionResult> {
  return adminAction("schedule:manage", async () => {
    await prisma.holiday.delete({ where: { id: idField.parse(id) } });
    invalidate("schedule");
    return { ok: true, message: "Holiday removed." };
  });
}

export async function addBreakAction(input: FormData): Promise<ActionResult> {
  return adminAction("schedule:manage", async () => {
    const parsed = parseForm(breakSchema, input);
    if (!parsed.ok) return parsed.result;
    await prisma.breakPeriod.create({ data: parsed.data });
    invalidate("schedule");
    return { ok: true, message: "Break added." };
  });
}

export async function deleteBreakAction(id: string): Promise<ActionResult> {
  return adminAction("schedule:manage", async () => {
    await prisma.breakPeriod.delete({ where: { id: idField.parse(id) } });
    invalidate("schedule");
    return { ok: true, message: "Break removed." };
  });
}

async function upsertSettings(data: Record<string, unknown>) {
  const existing = await prisma.siteSettings.findUnique({ where: { id: "default" }, select: { id: true } });
  if (existing) await prisma.siteSettings.update({ where: { id: "default" }, data });
  else {
    const { id: _id, ...defaults } = DEFAULT_SETTINGS;
    await prisma.siteSettings.create({ data: { ...defaults, ...data, id: "default" } });
  }
}

export async function saveBookingRulesAction(input: FormData): Promise<ActionResult> {
  return adminAction("schedule:manage", async () => {
    const parsed = parseForm(bookingRulesSchema, input);
    if (!parsed.ok) return parsed.result;
    await upsertSettings(parsed.data);
    invalidate("settings", "schedule");
    return { ok: true, message: "Booking rules saved." };
  });
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function saveBusinessSettingsAction(input: FormData): Promise<ActionResult> {
  return adminAction("settings:business", async () => {
    const parsed = parseForm(businessSettingsSchema, input);
    if (!parsed.ok) return parsed.result;
    await upsertSettings(parsed.data);
    invalidate("settings");
    return { ok: true, message: "Business settings saved." };
  });
}

/** Tax, deposits and policies — SUPER_ADMIN only. */
export async function savePaymentSettingsAction(input: FormData): Promise<ActionResult> {
  return adminAction("settings:critical", async () => {
    const parsed = parseForm(paymentSettingsSchema, input);
    if (!parsed.ok) return parsed.result;
    const { taxRatePercent, ...rest } = parsed.data;
    await upsertSettings({ ...rest, taxRateBps: taxRatePercent });
    invalidate("settings");
    return { ok: true, message: "Payment settings & policies saved." };
  });
}

export async function saveLegalPageAction(input: FormData): Promise<ActionResult> {
  return adminAction("settings:critical", async () => {
    const parsed = parseForm(legalPageSchema, input);
    if (!parsed.ok) return parsed.result;
    const { slug, title, content } = parsed.data;
    await prisma.legalPage.upsert({ where: { slug }, create: { slug, title, content }, update: { title, content } });
    invalidate("legal");
    return { ok: true, message: `${title} published.` };
  });
}

// ─── Staff accounts (SUPER_ADMIN) ────────────────────────────────────────────

export async function saveStaffUserAction(input: FormData): Promise<ActionResult> {
  return adminAction("users:manage", async (actor) => {
    const parsed = parseForm(staffUserSchema, input);
    if (!parsed.ok) return parsed.result;
    const id = input.get("id");
    const { password, ...data } = parsed.data;
    if (typeof id === "string" && id) {
      if (id === actor.id && (data.role !== "SUPER_ADMIN" || !data.isActive)) {
        return { ok: false, error: "You can’t remove your own super-admin access or deactivate yourself." };
      }
      await prisma.user.update({ where: { id }, data: { ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
    } else {
      const exists = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
      if (exists) {
        // Promote/update an existing account (e.g. a customer who joins the team).
        await prisma.user.update({ where: { id: exists.id }, data: { ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
        revalidatePath("/admin/users");
        return { ok: true, message: "Existing account updated with the new role." };
      }
      if (!password) return { ok: false, error: "Set an initial password for the new account.", fieldErrors: { password: ["Required for new accounts"] } };
      await prisma.user.create({ data: { ...data, passwordHash: await hashPassword(password), emailVerified: new Date() } });
    }
    revalidatePath("/admin/users");
    return { ok: true, message: "Account saved." };
  });
}

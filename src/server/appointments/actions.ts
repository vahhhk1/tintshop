"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getPaymentMode } from "@/lib/stripe";
import { limitByIp } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/validation/common";
import { bookingSchema, cancelSchema, rescheduleSchema } from "@/lib/validation/public";
import { notify } from "@/server/notifications";
import { refundAppointmentPayments } from "@/server/payments/service";
import { getSettings } from "@/server/settings";
import { getAppointmentForViewer } from "./access";
import { reserveSlot, SlotUnavailableError } from "./availability";
import { BookingError, createAppointment } from "./booking";

export async function createBookingAction(
  input: unknown,
): Promise<ActionResult<{ url: string; appointmentId: string; reference: string; paymentChoice: string }>> {
  const limit = await limitByIp("booking", 10, 60 * 60);
  if (!limit.success) return { ok: false, error: "Too many booking attempts. Please call us or try again later." };

  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  const data = parsed.data;
  if (data.company) return { ok: false, error: "Unable to process this booking." };

  const [user, settings] = await Promise.all([getSessionUser(), getSettings()]);
  const mode = getPaymentMode();
  let choice = data.paymentChoice;
  if (mode === "offline") {
    choice = "later";
  } else {
    if (choice === "later" && settings.requireDeposit) return { ok: false, error: "A deposit is required to reserve this appointment." };
    if (choice === "full" && !settings.allowPayInFull) return { ok: false, error: "Please choose the deposit option." };
  }

  let vehicleId: string | null = null;
  if (user && data.vehicle.vehicleId) {
    const owned = await prisma.vehicle.findFirst({ where: { id: data.vehicle.vehicleId, userId: user.id }, select: { id: true } });
    vehicleId = owned?.id ?? null;
  }

  let appointment;
  try {
    appointment = await createAppointment({
      config: data.config,
      date: data.date,
      time: data.time,
      technicianId: data.technicianId,
      contact: data.contact,
      vehicle: { ...data.vehicle, vehicleId },
      customerNotes: data.notes,
      userId: user?.id ?? null,
      source: "WEBSITE",
      status: "PENDING",
      holdMinutes: choice === "later" ? null : settings.holdMinutes,
    });
  } catch (error) {
    if (error instanceof BookingError || error instanceof SlotUnavailableError) return { ok: false, error: error.message };
    console.error("[booking] failed", error);
    return { ok: false, error: "We couldn't complete your booking. Please try again or call us." };
  }

  if (user) {
    if (data.vehicle.saveVehicle && !vehicleId) {
      const vehicle = await prisma.vehicle.create({
        data: {
          userId: user.id,
          year: data.vehicle.vehicleYear,
          make: data.vehicle.vehicleMake,
          model: data.vehicle.vehicleModel,
          color: data.vehicle.vehicleColor ?? null,
          vehicleTypeId: data.config.vehicleTypeId,
          vehicleSizeId: data.config.vehicleSizeId ?? null,
        },
      });
      await prisma.appointment.update({ where: { id: appointment.id }, data: { vehicleId: vehicle.id } });
    }
    if (!user.phone) await prisma.user.update({ where: { id: user.id }, data: { phone: data.contact.phone } });
  }

  const token = encodeURIComponent(appointment.manageToken);
  if (choice === "later") {
    after(() => notify.bookingCreated(appointment.id));
    return {
      ok: true,
      data: { appointmentId: appointment.id, reference: appointment.reference, paymentChoice: choice, url: `/checkout/success?appointment=${appointment.id}&t=${token}` },
    };
  }
  return {
    ok: true,
    data: {
      appointmentId: appointment.id,
      reference: appointment.reference,
      paymentChoice: choice,
      url: `/checkout/${appointment.id}?t=${token}&type=${choice === "full" ? "FULL" : "DEPOSIT"}`,
    },
  };
}

const CHANGEABLE = ["PENDING", "CONFIRMED", "DEPOSIT_PAID"];

function revalidateAppointmentViews(id: string) {
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/admin/appointments/${id}`);
}

export async function cancelAppointmentAction(input: unknown): Promise<ActionResult<{ refunded: number }>> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const access = await getAppointmentForViewer(parsed.data.appointmentId, parsed.data.token);
  if (!access) return { ok: false, error: "Appointment not found." };
  const a = access.appointment;
  if (!CHANGEABLE.includes(a.status)) return { ok: false, error: "This appointment can't be cancelled online." };

  const settings = await getSettings();
  const hoursUntil = (a.startsAt.getTime() - Date.now()) / 3_600_000;
  if (hoursUntil < settings.cancellationWindowHours) {
    return { ok: false, error: `Online cancellation closes ${settings.cancellationWindowHours} hours before your appointment. Please call us at ${settings.phone}.` };
  }

  await prisma.appointment.update({
    where: { id: a.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: parsed.data.reason ?? "Cancelled by customer", holdExpiresAt: null },
  });
  const { refunded } = await refundAppointmentPayments(a.id);
  after(() => notify.cancelled(a.id, { reason: parsed.data.reason, byCustomer: true }));
  revalidateAppointmentViews(a.id);
  return { ok: true, message: refunded > 0 ? "Appointment cancelled. Your refund is on its way." : "Appointment cancelled.", data: { refunded } };
}

export async function rescheduleAppointmentAction(input: unknown): Promise<ActionResult> {
  const limit = await limitByIp("reschedule", 20, 60 * 60);
  if (!limit.success) return { ok: false, error: "Too many attempts. Please try again later." };
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please choose a new date and time." };
  const access = await getAppointmentForViewer(parsed.data.appointmentId, parsed.data.token);
  if (!access) return { ok: false, error: "Appointment not found." };
  const a = access.appointment;
  if (!CHANGEABLE.includes(a.status)) return { ok: false, error: "This appointment can't be rescheduled online." };

  const settings = await getSettings();
  const hoursUntil = (a.startsAt.getTime() - Date.now()) / 3_600_000;
  if (hoursUntil < settings.cancellationWindowHours) {
    return { ok: false, error: `Online changes close ${settings.cancellationWindowHours} hours before your appointment. Please call us at ${settings.phone}.` };
  }

  const durationMinutes = Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000);
  const serviceId = a.service.parentId ?? a.service.id;
  const previous = a.startsAt;
  try {
    await prisma.$transaction(async (tx) => {
      let slot;
      try {
        slot = await reserveSlot(tx, { date: parsed.data.date, time: parsed.data.time, durationMinutes, serviceId, technicianId: a.technicianId, excludeAppointmentId: a.id });
      } catch (e) {
        if (!(e instanceof SlotUnavailableError) || !a.technicianId) throw e;
        slot = await reserveSlot(tx, { date: parsed.data.date, time: parsed.data.time, durationMinutes, serviceId, technicianId: null, excludeAppointmentId: a.id });
      }
      await tx.appointment.update({
        where: { id: a.id },
        data: { startsAt: slot.startsAt, endsAt: slot.endsAt, technicianId: slot.technicianId, reminderSentAt: null },
      });
    });
  } catch (error) {
    if (error instanceof SlotUnavailableError) return { ok: false, error: error.message };
    console.error("[reschedule] failed", error);
    return { ok: false, error: "Could not reschedule. Please try another time." };
  }

  after(async () => {
    await notify.rescheduled(a.id, previous);
    await prisma.notification.create({
      data: { audience: "ADMIN", type: "APPOINTMENT_RESCHEDULED", title: `Rescheduled by customer: ${a.reference}`, body: `${a.customerName} moved their appointment`, link: `/admin/appointments/${a.id}` },
    });
  });
  revalidateAppointmentViews(a.id);
  return { ok: true, message: "Your appointment has been rescheduled." };
}

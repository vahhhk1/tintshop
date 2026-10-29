"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ActionResult } from "@/lib/validation/common";
import { idField, optionalId, optionalText } from "@/lib/validation/common";
import { adminAppointmentSchema, adminRescheduleSchema, appointmentStatusSchema, manualPaymentSchema } from "@/lib/validation/admin";
import { emailField, requiredText, vehicleYearField } from "@/lib/validation/common";
import { blockingAppointmentWhere, reserveSlot, SlotUnavailableError } from "@/server/appointments/availability";
import { BookingError, createAppointment } from "@/server/appointments/booking";
import { receiptNumber } from "@/server/codes";
import { notify } from "@/server/notifications";
import { markPaymentSucceeded, refundAppointmentPayments } from "@/server/payments/service";
import { adminAction, parseForm } from "./helpers";

function refresh(id?: string) {
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  if (id) revalidatePath(`/admin/appointments/${id}`);
}

export async function createAdminAppointmentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction("appointments:manage", async (user) => {
    const parsed = adminAppointmentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
    const d = parsed.data;

    // Link to an existing customer account when staff chose one or the email matches.
    let userId = d.userId;
    if (userId) {
      const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!exists) userId = null;
    }
    if (!userId) {
      const match = await prisma.user.findUnique({ where: { email: d.customerEmail }, select: { id: true } });
      userId = match?.id ?? null;
    }

    try {
      const appointment = await createAppointment({
        config: d.config,
        date: d.date,
        time: d.time,
        technicianId: d.technicianId,
        contact: { name: d.customerName, email: d.customerEmail, phone: d.customerPhone },
        vehicle: d.vehicle,
        customerNotes: d.customerNotes,
        internalNotes: [d.internalNotes, `Created by ${user.name ?? user.email}`].filter(Boolean).join("\n"),
        userId,
        source: d.quoteId ? "QUOTE" : "ADMIN",
        status: d.status,
        holdMinutes: null,
        allowOverlap: d.allowOverlap,
        ignoreNotice: true,
        quoteId: d.quoteId,
        priceOverride: d.priceOverride ?? null,
      });
      if (d.quoteId) await prisma.quote.update({ where: { id: d.quoteId }, data: { status: "CONVERTED" } });
      if (d.sendConfirmation) after(() => (d.status === "CONFIRMED" ? notify.bookingConfirmed(appointment.id) : notify.bookingCreated(appointment.id)));
      refresh(appointment.id);
      return { ok: true, message: `Appointment ${appointment.reference} created.`, data: { id: appointment.id } };
    } catch (error) {
      if (error instanceof BookingError || error instanceof SlotUnavailableError) return { ok: false, error: error.message };
      throw error;
    }
  });
}

export async function updateAppointmentStatusAction(input: FormData): Promise<ActionResult> {
  return adminAction("appointments:manage", async () => {
    const parsed = parseForm(appointmentStatusSchema.extend({ refund: z.union([z.literal("on"), z.literal("true"), z.undefined(), z.null(), z.literal("")]).optional() }), input);
    if (!parsed.ok) return parsed.result;
    const { appointmentId, status, reason, notifyCustomer, refund } = parsed.data;
    const a = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!a) return { ok: false, error: "Appointment not found." };
    if (a.status === status) return { ok: true, message: "No change." };

    const now = new Date();
    const data: Prisma.AppointmentUpdateInput = { status };
    if (status === "CONFIRMED" && !a.confirmedAt) data.confirmedAt = now;
    if (status === "COMPLETED") data.completedAt = now;
    if (status === "CANCELLED") {
      data.cancelledAt = now;
      data.cancellationReason = reason ?? "Cancelled by staff";
      data.holdExpiresAt = null;
    }
    if (["PENDING", "CONFIRMED", "DEPOSIT_PAID", "IN_PROGRESS"].includes(status)) {
      data.holdExpiresAt = null;
      if (a.status === "CANCELLED") {
        data.cancelledAt = null;
        data.cancellationReason = null;
      }
    }
    await prisma.appointment.update({ where: { id: a.id }, data });

    let refundNote = "";
    if (status === "CANCELLED" && refund) {
      const { refunded, errors } = await refundAppointmentPayments(a.id);
      refundNote = refunded > 0 ? ` Refunded $${(refunded / 100).toFixed(2)}.` : "";
      if (errors.length) refundNote += ` Some refunds failed: ${errors.join("; ")}`;
    }

    if (notifyCustomer) {
      after(async () => {
        if (status === "CONFIRMED") await notify.bookingConfirmed(a.id);
        else if (status === "COMPLETED") await notify.completed(a.id);
        else if (status === "CANCELLED") await notify.cancelled(a.id, { reason, byCustomer: false });
      });
    }
    refresh(a.id);
    return { ok: true, message: `Status updated.${refundNote}` };
  });
}

export async function adminRescheduleAction(input: FormData): Promise<ActionResult> {
  return adminAction("appointments:manage", async () => {
    const parsed = parseForm(adminRescheduleSchema, input);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    const a = await prisma.appointment.findUnique({ where: { id: d.appointmentId }, include: { service: { select: { id: true, parentId: true } } } });
    if (!a) return { ok: false, error: "Appointment not found." };
    const durationMinutes = Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000);
    const previous = a.startsAt;
    try {
      await prisma.$transaction(async (tx) => {
        const slot = await reserveSlot(tx, {
          date: d.date,
          time: d.time,
          durationMinutes,
          serviceId: a.service.parentId ?? a.service.id,
          technicianId: d.technicianId ?? a.technicianId,
          excludeAppointmentId: a.id,
          ignoreNotice: true,
          allowOverlap: d.allowOverlap,
        });
        await tx.appointment.update({ where: { id: a.id }, data: { startsAt: slot.startsAt, endsAt: slot.endsAt, technicianId: slot.technicianId, reminderSentAt: null } });
      });
    } catch (error) {
      if (error instanceof SlotUnavailableError) return { ok: false, error: "That time isn’t available. Tick “Allow overlap” to book it anyway." };
      throw error;
    }
    if (d.notifyCustomer) after(() => notify.rescheduled(a.id, previous));
    refresh(a.id);
    return { ok: true, message: "Appointment rescheduled." };
  });
}

export async function assignTechnicianAction(input: FormData): Promise<ActionResult> {
  return adminAction("appointments:manage", async () => {
    const parsed = parseForm(z.object({ appointmentId: idField, technicianId: optionalId, force: z.string().optional() }), input);
    if (!parsed.ok) return parsed.result;
    const { appointmentId, technicianId, force } = parsed.data;
    const a = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!a) return { ok: false, error: "Appointment not found." };
    if (technicianId && !force) {
      const clash = await prisma.appointment.findFirst({
        where: { ...blockingAppointmentWhere(), id: { not: a.id }, technicianId, startsAt: { lt: a.endsAt }, endsAt: { gt: a.startsAt } },
        select: { reference: true },
      });
      if (clash) return { ok: false, error: `That technician already has ${clash.reference} at this time.` };
    }
    await prisma.appointment.update({ where: { id: a.id }, data: { technicianId } });
    refresh(a.id);
    return { ok: true, message: technicianId ? "Technician assigned." : "Technician unassigned." };
  });
}

const detailsSchema = z.object({
  appointmentId: idField,
  customerName: requiredText("Name", 100),
  customerEmail: emailField,
  customerPhone: requiredText("Phone", 30),
  vehicleYear: vehicleYearField,
  vehicleMake: requiredText("Make", 60),
  vehicleModel: requiredText("Model", 60),
  vehicleColor: optionalText(40),
  customerNotes: optionalText(1500),
  internalNotes: optionalText(5000),
});

export async function updateAppointmentDetailsAction(input: FormData): Promise<ActionResult> {
  return adminAction("appointments:manage", async () => {
    const parsed = parseForm(detailsSchema, input);
    if (!parsed.ok) return parsed.result;
    const { appointmentId, ...data } = parsed.data;
    await prisma.appointment.update({ where: { id: appointmentId }, data });
    refresh(appointmentId);
    return { ok: true, message: "Appointment details saved." };
  });
}

export async function recordManualPaymentAction(input: FormData): Promise<ActionResult> {
  return adminAction("payments:manage", async () => {
    const parsed = parseForm(manualPaymentSchema, input);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;
    const a = await prisma.appointment.findUnique({ where: { id: d.appointmentId } });
    if (!a) return { ok: false, error: "Appointment not found." };
    const payment = await prisma.payment.create({
      data: {
        appointmentId: a.id,
        userId: a.userId,
        amount: d.amount,
        type: d.type,
        status: "PENDING",
        provider: "MANUAL",
        receiptNumber: receiptNumber(),
        method: d.method,
        note: d.note,
        billingName: a.customerName,
        billingEmail: a.customerEmail,
      },
    });
    const result = await markPaymentSucceeded(payment.id, { method: d.method });
    after(() => notify.paymentReceived(payment.id, { firstPayment: result.firstPayment }));
    refresh(a.id);
    return { ok: true, message: "Payment recorded." };
  });
}

export async function refundAppointmentAction(appointmentId: string): Promise<ActionResult> {
  return adminAction("payments:manage", async () => {
    const id = idField.parse(appointmentId);
    const { refunded, errors } = await refundAppointmentPayments(id);
    refresh(id);
    if (errors.length && refunded === 0) return { ok: false, error: errors.join("; ") };
    return { ok: true, message: refunded ? `Refunded $${(refunded / 100).toFixed(2)}.${errors.length ? ` Some failed: ${errors.join("; ")}` : ""}` : "No online payments to refund." };
  });
}

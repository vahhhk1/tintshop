import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getStripe } from "@/lib/stripe";

export const HOLD_EXPIRED_REASON = "Checkout not completed before the reservation expired";

export interface PaymentDetails {
  stripePaymentIntentId?: string | null;
  method?: string | null;
  billingName?: string | null;
  billingEmail?: string | null;
  billingAddress?: Prisma.InputJsonValue | null;
  receiptUrl?: string | null;
}

/**
 * Idempotently marks a payment as succeeded and updates the appointment:
 * amount paid, status (deposit paid / confirmed), hold release and coupon redemption.
 * Called only from trusted server paths (Stripe webhook / verified session, demo gateway, staff).
 */
export async function markPaymentSucceeded(paymentId: string, details: PaymentDetails = {}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error(`Payment ${paymentId} not found`);
    if (payment.status === "SUCCEEDED" || payment.status === "REFUNDED") {
      return { alreadyProcessed: true, firstPayment: false, appointmentId: payment.appointmentId };
    }

    const appointment = await tx.appointment.findUniqueOrThrow({ where: { id: payment.appointmentId } });
    const firstPayment = appointment.amountPaid === 0 && (appointment.status === "PENDING" || appointment.status === "CANCELLED");
    const amountPaid = appointment.amountPaid + payment.amount;
    const now = new Date();

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        paidAt: now,
        stripePaymentIntentId: details.stripePaymentIntentId ?? payment.stripePaymentIntentId,
        method: details.method ?? payment.method,
        billingName: details.billingName ?? payment.billingName,
        billingEmail: details.billingEmail ?? payment.billingEmail,
        billingAddress: details.billingAddress ?? undefined,
        receiptUrl: details.receiptUrl ?? payment.receiptUrl,
      },
    });

    let status = appointment.status;
    const data: Prisma.AppointmentUpdateInput = { amountPaid, holdExpiresAt: null };
    if (status === "PENDING" || status === "CANCELLED") {
      status = amountPaid >= appointment.total ? "CONFIRMED" : "DEPOSIT_PAID";
      data.confirmedAt = now;
      if (appointment.status === "CANCELLED") {
        data.cancelledAt = null;
        data.cancellationReason = null;
        data.internalNotes = [appointment.internalNotes, "⚠ Payment arrived after the reservation expired — please verify the schedule."]
          .filter(Boolean)
          .join("\n");
      }
    }
    data.status = status;
    await tx.appointment.update({ where: { id: appointment.id }, data });

    if (firstPayment && appointment.couponId) {
      const existing = await tx.couponRedemption.findUnique({ where: { appointmentId: appointment.id } });
      if (!existing) {
        await tx.couponRedemption.create({
          data: {
            couponId: appointment.couponId,
            appointmentId: appointment.id,
            userId: appointment.userId,
            email: appointment.customerEmail.toLowerCase(),
            amount: appointment.discount,
          },
        });
        await tx.coupon.update({ where: { id: appointment.couponId }, data: { usageCount: { increment: 1 } } });
      }
    }

    return { alreadyProcessed: false, firstPayment, appointmentId: appointment.id };
  });
}

export async function markPaymentFailed(paymentId: string, status: "FAILED" | "CANCELLED") {
  await prisma.payment.updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status } });
}

/**
 * Refunds every successful online payment for an appointment.
 * Manual (cash/terminal) payments are left for staff to settle in person.
 */
export async function refundAppointmentPayments(appointmentId: string) {
  const payments = await prisma.payment.findMany({ where: { appointmentId, status: "SUCCEEDED", provider: { in: ["STRIPE", "DEMO"] } } });
  const stripe = getStripe();
  let refunded = 0;
  const errors: string[] = [];
  for (const p of payments) {
    try {
      if (p.provider === "STRIPE") {
        if (!stripe || !p.stripePaymentIntentId) {
          errors.push(`${p.receiptNumber}: Stripe not configured`);
          continue;
        }
        await stripe.refunds.create({ payment_intent: p.stripePaymentIntentId }, { idempotencyKey: `refund-${p.id}` });
      }
      await prisma.payment.update({ where: { id: p.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
      await prisma.appointment.update({ where: { id: appointmentId }, data: { amountPaid: { decrement: p.amount } } });
      refunded += p.amount;
    } catch (error) {
      errors.push(`${p.receiptNumber}: ${error instanceof Error ? error.message : "refund failed"}`);
    }
  }
  return { refunded, errors };
}

/** Cancels unpaid online reservations whose hold has lapsed so the slot is released everywhere. */
export async function releaseExpiredHolds() {
  const result = await prisma.appointment.updateMany({
    where: { status: "PENDING", amountPaid: 0, holdExpiresAt: { lt: new Date() } },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: HOLD_EXPIRED_REASON },
  });
  await prisma.payment.updateMany({
    where: { status: "PENDING", appointment: { status: "CANCELLED", cancellationReason: HOLD_EXPIRED_REASON } },
    data: { status: "CANCELLED" },
  });
  return result.count;
}

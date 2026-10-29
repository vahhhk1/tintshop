"use server";

import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { getPaymentMode, getStripe } from "@/lib/stripe";
import { limitByIp } from "@/lib/rate-limit";
import { formatDateTime } from "@/lib/time";
import { vehicleLabel } from "@/lib/utils";
import type { ActionResult } from "@/lib/validation/common";
import { checkoutSchema, couponApplySchema } from "@/lib/validation/public";
import { getAppointmentForViewer, isHoldExpired, tokenMatches } from "@/server/appointments/access";
import { recalculateAppointmentTotals } from "@/server/appointments/booking";
import { receiptNumber } from "@/server/codes";
import { notify } from "@/server/notifications";
import { getSettings } from "@/server/settings";
import { validateCoupon } from "./coupons";
import { markPaymentSucceeded } from "./service";

const CLOSED_STATUSES = ["CANCELLED", "COMPLETED", "NO_SHOW"];

export async function applyCouponAction(input: unknown): Promise<ActionResult> {
  const limit = await limitByIp("coupon", 20, 15 * 60);
  if (!limit.success) return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  const parsed = couponApplySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid code" };

  const access = await getAppointmentForViewer(parsed.data.appointmentId, parsed.data.token);
  if (!access) return { ok: false, error: "Appointment not found." };
  const a = access.appointment;
  if (a.amountPaid > 0 || CLOSED_STATUSES.includes(a.status)) return { ok: false, error: "Codes can only be applied before payment." };

  const check = await validateCoupon(parsed.data.code, {
    subtotal: a.subtotal,
    serviceIds: [a.service.id, a.service.parentId].filter(Boolean) as string[],
    email: a.customerEmail,
    excludeAppointmentId: a.id,
  });
  if (!check.ok) return { ok: false, error: check.error };
  await recalculateAppointmentTotals(a.id, check.discount, check.couponId);
  return { ok: true, message: `Code ${check.code} applied.` };
}

export async function removeCouponAction(input: { appointmentId: string; token?: string | null }): Promise<ActionResult> {
  const access = await getAppointmentForViewer(input.appointmentId, input.token);
  if (!access) return { ok: false, error: "Appointment not found." };
  if (access.appointment.amountPaid > 0) return { ok: false, error: "Payment already started." };
  await recalculateAppointmentTotals(access.appointment.id, 0, null);
  return { ok: true };
}

function amountFor(type: "DEPOSIT" | "FULL" | "BALANCE", a: { depositAmount: number; total: number; amountPaid: number }) {
  const remaining = Math.max(0, a.total - a.amountPaid);
  if (type === "DEPOSIT") return a.amountPaid > 0 ? 0 : Math.min(a.depositAmount, remaining);
  if (type === "FULL") return a.amountPaid > 0 ? 0 : remaining;
  return a.amountPaid > 0 ? remaining : 0;
}

export async function startCheckoutAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  const limit = await limitByIp("checkout", 20, 15 * 60);
  if (!limit.success) return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid checkout request." };

  const access = await getAppointmentForViewer(parsed.data.appointmentId, parsed.data.token);
  if (!access) return { ok: false, error: "Appointment not found." };
  const a = access.appointment;
  if (CLOSED_STATUSES.includes(a.status)) return { ok: false, error: "This appointment can no longer be paid online." };
  if (isHoldExpired(a)) return { ok: false, error: "Your reservation expired. Please choose a new time." };

  const settings = await getSettings();
  const type = parsed.data.paymentType;
  if (type === "FULL" && !settings.allowPayInFull) return { ok: false, error: "Paying in full online is not available." };
  const amount = amountFor(type, a);
  if (amount <= 0) return { ok: false, error: "Nothing is due for this payment option." };

  const mode = getPaymentMode();
  if (mode === "offline") return { ok: false, error: "Online payments are not available. Please pay at the shop." };

  // Supersede earlier unfinished attempts.
  const stale = await prisma.payment.findMany({ where: { appointmentId: a.id, status: "PENDING" } });
  if (stale.length) {
    await prisma.payment.updateMany({ where: { id: { in: stale.map((p) => p.id) } }, data: { status: "CANCELLED" } });
    const stripe = getStripe();
    if (stripe) {
      await Promise.allSettled(stale.filter((p) => p.stripeCheckoutSessionId).map((p) => stripe.checkout.sessions.expire(p.stripeCheckoutSessionId!)));
    }
  }

  const payment = await prisma.payment.create({
    data: {
      appointmentId: a.id,
      userId: a.userId,
      amount,
      currency: settings.currency,
      type,
      status: "PENDING",
      provider: mode === "stripe" ? "STRIPE" : "DEMO",
      receiptNumber: receiptNumber(),
      billingEmail: a.customerEmail,
    },
  });

  const tokenParam = `t=${encodeURIComponent(a.manageToken)}`;

  if (mode === "demo") {
    return { ok: true, data: { url: `/checkout/demo?payment=${payment.id}&${tokenParam}` } };
  }

  const stripe = getStripe()!;
  // Stripe requires 30 min – 24 h. Keep the slot held for the life of the session.
  const holdSeconds = Math.min(Math.max(settings.holdMinutes * 60, 30 * 60 + 60), 23 * 3600);
  const expiresAt = Math.floor(Date.now() / 1000) + holdSeconds;
  const label = type === "DEPOSIT" ? "Deposit" : type === "BALANCE" ? "Balance" : "Payment";
  const serviceName = [a.service.name, a.serviceOption?.name].filter(Boolean).join(" — ");

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: a.customerEmail,
        client_reference_id: a.id,
        billing_address_collection: "required",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: settings.currency,
              unit_amount: amount,
              product_data: {
                name: `${label} — ${serviceName}`,
                description: `${vehicleLabel(a)} · ${formatDateTime(a.startsAt, settings.timezone)} · Ref ${a.reference}`,
              },
            },
          },
        ],
        metadata: { appointmentId: a.id, paymentId: payment.id, paymentType: type },
        payment_intent_data: {
          description: `${settings.businessName} ${a.reference} (${label.toLowerCase()})`,
          metadata: { appointmentId: a.id, paymentId: payment.id, paymentType: type },
        },
        expires_at: expiresAt,
        success_url: `${env.siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.siteUrl}/checkout/${a.id}?${tokenParam}&cancelled=1`,
      },
      { idempotencyKey: `checkout-${payment.id}` },
    );

    await prisma.payment.update({ where: { id: payment.id }, data: { stripeCheckoutSessionId: session.id } });
    if (a.status === "PENDING" && a.amountPaid === 0) {
      await prisma.appointment.update({ where: { id: a.id }, data: { holdExpiresAt: new Date(expiresAt * 1000 + 120_000) } });
    }
    if (!session.url) return { ok: false, error: "Could not start checkout." };
    return { ok: true, data: { url: session.url } };
  } catch (error) {
    console.error("[checkout] stripe session failed", error);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return { ok: false, error: "Payment provider error. Please try again." };
  }
}

/**
 * Development-only simulated gateway, used when Stripe is not configured.
 * Disabled in production and whenever Stripe keys exist.
 */
export async function completeDemoPaymentAction(input: { paymentId: string; token: string }): Promise<ActionResult<{ url: string }>> {
  if (!env.demoPaymentsEnabled) return { ok: false, error: "Demo payments are disabled." };
  const payment = await prisma.payment.findUnique({ where: { id: input.paymentId }, include: { appointment: true } });
  if (!payment || payment.provider !== "DEMO" || !tokenMatches(payment.appointment.manageToken, input.token)) {
    return { ok: false, error: "Payment not found." };
  }
  if (payment.status === "PENDING") {
    const result = await markPaymentSucceeded(payment.id, { method: "Demo card •••• 4242", billingName: payment.appointment.customerName });
    if (!result.alreadyProcessed) after(() => notify.paymentReceived(payment.id, { firstPayment: result.firstPayment }));
  }
  return { ok: true, data: { url: `/checkout/success?payment=${payment.id}&t=${encodeURIComponent(input.token)}` } };
}

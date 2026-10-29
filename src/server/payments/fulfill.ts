import "server-only";
import { after } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { getStripe } from "@/lib/stripe";
import { notify } from "@/server/notifications";
import { markPaymentFailed, markPaymentSucceeded } from "./service";

function describeMethod(session: Stripe.Checkout.Session) {
  const pi = session.payment_intent;
  if (pi && typeof pi !== "string") {
    const charge = pi.latest_charge;
    if (charge && typeof charge !== "string") {
      const card = charge.payment_method_details?.card;
      if (card) return { method: `${card.brand?.toUpperCase() ?? "Card"} •••• ${card.last4}`, receiptUrl: charge.receipt_url ?? null };
      return { method: charge.payment_method_details?.type ?? "card", receiptUrl: charge.receipt_url ?? null };
    }
  }
  return { method: session.payment_method_types?.[0] ?? "card", receiptUrl: null };
}

/**
 * Verifies a Checkout Session with Stripe's API and records the payment.
 * Safe to call repeatedly (webhook + success page) — processing is idempotent.
 */
export async function fulfillCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  if (!stripe) return { status: "unconfigured" as const };

  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] });
  const payment = await prisma.payment.findUnique({ where: { stripeCheckoutSessionId: session.id } });
  if (!payment) return { status: "unknown" as const };

  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    if (session.status === "expired") await markPaymentFailed(payment.id, "CANCELLED");
    return { status: "pending" as const, paymentId: payment.id, appointmentId: payment.appointmentId };
  }

  const { method, receiptUrl } = describeMethod(session);
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  const address = session.customer_details?.address;

  const result = await markPaymentSucceeded(payment.id, {
    stripePaymentIntentId: paymentIntentId,
    method,
    receiptUrl,
    billingName: session.customer_details?.name ?? null,
    billingEmail: session.customer_details?.email ?? null,
    billingAddress: address ? JSON.parse(JSON.stringify(address)) : null,
  });

  if (!result.alreadyProcessed) {
    after(() => notify.paymentReceived(payment.id, { firstPayment: result.firstPayment }));
  }
  return { status: "paid" as const, paymentId: payment.id, appointmentId: payment.appointmentId };
}

import type Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { fulfillCheckoutSession } from "@/server/payments/fulfill";
import { markPaymentFailed } from "@/server/payments/service";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook. The signature is verified against STRIPE_WEBHOOK_SECRET using the
 * raw request body, and each event id is processed once (StripeEvent table).
 * Payment status is always re-read from Stripe's API inside fulfillCheckoutSession.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = env.stripe.webhookSecret;
  if (!stripe || !secret) return new Response("Stripe is not configured", { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    console.warn("[stripe-webhook] invalid signature", error instanceof Error ? error.message : error);
    return new Response("Invalid signature", { status: 400 });
  }

  const seen = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
  if (seen) return Response.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await fulfillCheckoutSession((event.data.object as Stripe.Checkout.Session).id);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const payment = await prisma.payment.findUnique({ where: { stripeCheckoutSessionId: session.id } });
        if (payment) await markPaymentFailed(payment.id, event.type === "checkout.session.expired" ? "CANCELLED" : "FAILED");
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (intentId && charge.refunded) {
          const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: intentId } });
          if (payment && payment.status === "SUCCEEDED") {
            await prisma.$transaction([
              prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED", refundedAt: new Date() } }),
              prisma.appointment.update({ where: { id: payment.appointmentId }, data: { amountPaid: { decrement: payment.amount } } }),
            ]);
          }
        }
        break;
      }
      default:
        break;
    }
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (error) {
    console.error(`[stripe-webhook] failed processing ${event.type}`, error);
    // 500 lets Stripe retry later.
    return new Response("Webhook handler failed", { status: 500 });
  }

  return Response.json({ received: true });
}

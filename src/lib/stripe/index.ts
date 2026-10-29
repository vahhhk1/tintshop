import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null = null;

/** Returns a configured Stripe client, or null when STRIPE_SECRET_KEY is not set. */
export function getStripe(): Stripe | null {
  if (!env.stripe.secretKey) return null;
  if (!client) {
    client = new Stripe(env.stripe.secretKey, {
      appInfo: { name: "tint-shop" },
      maxNetworkRetries: 2,
    });
  }
  return client;
}

export type PaymentMode = "stripe" | "demo" | "offline";

export function getPaymentMode(): PaymentMode {
  if (env.stripe.enabled) return "stripe";
  if (env.demoPaymentsEnabled) return "demo";
  return "offline";
}

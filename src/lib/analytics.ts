/**
 * Provider-agnostic analytics. Events are pushed to `window.dataLayer` (works with
 * Google Tag Manager / GA4) and forwarded to `gtag` when GA4 is loaded.
 * To add another provider, forward events inside `track()`.
 */
export type AnalyticsEvent =
  | "page_view"
  | "quote_started"
  | "quote_completed"
  | "booking_started"
  | "booking_completed"
  | "checkout_started"
  | "payment_completed"
  | "contact_submitted"
  | "review_submitted"
  | "call_clicked";

type Params = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: AnalyticsEvent, params: Params = {}) {
  if (typeof window === "undefined") return;
  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event, ...params });
    window.gtag?.("event", event, params);
    if (process.env.NODE_ENV === "development") console.debug("[analytics]", event, params);
  } catch {
    // analytics must never break the UI
  }
}

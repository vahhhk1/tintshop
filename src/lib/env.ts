import "server-only";

/**
 * Central place for reading server configuration and feature flags.
 * Integrations degrade gracefully when their credentials are missing.
 */
const read = (key: string) => {
  const value = process.env[key];
  return value && value.trim() !== "" ? value.trim() : undefined;
};

export const env = {
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get siteUrl() {
    return (read("NEXT_PUBLIC_SITE_URL") ?? read("NEXTAUTH_URL") ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get authSecret() {
    return read("AUTH_SECRET") ?? read("NEXTAUTH_SECRET");
  },
  google: {
    get clientId() {
      return read("GOOGLE_CLIENT_ID");
    },
    get clientSecret() {
      return read("GOOGLE_CLIENT_SECRET");
    },
    get enabled() {
      return Boolean(read("GOOGLE_CLIENT_ID") && read("GOOGLE_CLIENT_SECRET"));
    },
  },
  stripe: {
    get secretKey() {
      return read("STRIPE_SECRET_KEY");
    },
    get webhookSecret() {
      return read("STRIPE_WEBHOOK_SECRET");
    },
    get enabled() {
      return Boolean(read("STRIPE_SECRET_KEY"));
    },
  },
  /** Simulated checkout for local development when Stripe is not configured. */
  get demoPaymentsEnabled() {
    return !read("STRIPE_SECRET_KEY") && read("ALLOW_DEMO_PAYMENTS") === "true" && process.env.NODE_ENV !== "production";
  },
  email: {
    get apiKey() {
      return read("EMAIL_API_KEY");
    },
    get from() {
      return read("EMAIL_FROM") ?? "Tint Studio <onboarding@resend.dev>";
    },
    get adminRecipient() {
      return read("ADMIN_NOTIFICATION_EMAIL");
    },
    get enabled() {
      return Boolean(read("EMAIL_API_KEY"));
    },
  },
  storage: {
    get provider(): "local" | "cloudinary" | "s3" {
      const p = read("STORAGE_PROVIDER");
      return p === "cloudinary" || p === "s3" ? p : "local";
    },
    get apiKey() {
      return read("STORAGE_API_KEY");
    },
    get secret() {
      return read("STORAGE_SECRET");
    },
    get bucket() {
      return read("STORAGE_BUCKET");
    },
    get endpoint() {
      return read("STORAGE_ENDPOINT");
    },
    get region() {
      return read("STORAGE_REGION") ?? "auto";
    },
    get publicUrl() {
      return read("STORAGE_PUBLIC_URL");
    },
  },
  sms: {
    get provider() {
      return read("SMS_PROVIDER");
    },
    get twilioSid() {
      return read("TWILIO_ACCOUNT_SID");
    },
    get twilioToken() {
      return read("TWILIO_AUTH_TOKEN");
    },
    get twilioFrom() {
      return read("TWILIO_FROM_NUMBER");
    },
  },
  get cronSecret() {
    return read("CRON_SECRET");
  },
};

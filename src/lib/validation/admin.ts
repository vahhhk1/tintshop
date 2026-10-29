import { z } from "zod";
import {
  centsField,
  checkbox,
  emailField,
  hmField,
  idField,
  optionalCents,
  optionalId,
  optionalPhone,
  optionalText,
  passwordField,
  requiredText,
  ymdField,
} from "./common";
import { jobConfigSchema, vehicleDetailsSchema } from "./public";

const lines = z
  .string()
  .optional()
  .nullable()
  .transform((v) =>
    (v ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 30),
  );

const intField = (min: number, max: number, fallback?: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? fallback : v),
    z.coerce.number({ error: "Enter a number" }).int("Whole numbers only").min(min, `Minimum ${min}`).max(max, `Maximum ${max}`),
  );

const optionalInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(min).max(max).nullable());

/** Accepts site-relative paths or http(s) URLs. */
export const urlOrPath = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || v.startsWith("/") || /^https?:\/\//i.test(v), "Must be a URL or a /path");

export const httpUrl = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https:\/\//i.test(v), "Must start with https://");

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .max(80)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), "Lowercase letters, numbers and dashes only");

const idList = z.preprocess(
  (v) => (v == null || v === "" ? [] : Array.isArray(v) ? v : [v]),
  z.array(z.string().trim().min(1).max(64)).max(100),
);

export const serviceSchema = z.object({
  name: requiredText("Name", 100),
  slug: slugField,
  category: z.enum(["WINDOW_TINT", "PAINT_PROTECTION", "COATING", "LIGHTING"]),
  tagline: optionalText(160),
  shortDescription: requiredText("Short description", 300),
  description: requiredText("Description", 5000),
  benefits: lines,
  features: lines,
  imageUrl: urlOrPath,
  startingPrice: centsField,
  durationMinutes: intField(15, 24 * 60),
  durationLabel: optionalText(60),
  warranty: optionalText(500),
  usesFilm: checkbox,
  filmTypeId: optionalId,
  parentId: optionalId,
  depositAmount: optionalCents,
  bookable: checkbox,
  featured: checkbox,
  active: checkbox,
  sortOrder: intField(0, 1000, 0),
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
});

export const serviceOptionSchema = z.object({
  id: optionalId,
  serviceId: idField,
  name: requiredText("Name", 100),
  description: optionalText(300),
  kind: z.enum(["COVERAGE", "ADDON"]),
  windowCount: intField(0, 50, 0),
  durationMinutes: optionalInt(0, 24 * 60),
  price: optionalCents,
  active: checkbox,
  sortOrder: intField(0, 1000, 0),
});

export const faqSchema = z.object({
  id: optionalId,
  serviceId: optionalId,
  question: requiredText("Question", 300),
  answer: requiredText("Answer", 3000),
  sortOrder: intField(0, 1000, 0),
  active: checkbox,
});

export const pricingRuleSchema = z.object({
  id: optionalId,
  name: optionalText(100),
  serviceId: optionalId,
  serviceOptionId: optionalId,
  filmTypeId: optionalId,
  vehicleTypeId: optionalId,
  vehicleSizeId: optionalId,
  price: centsField,
  pricePerWindow: optionalCents.transform((v) => v ?? 0),
  durationMinutes: optionalInt(0, 24 * 60),
  priority: intField(-100, 100, 0),
  active: checkbox,
});

export const priceMatrixSchema = z.object({
  serviceId: idField,
  serviceOptionId: optionalId,
  vehicleSizeId: optionalId,
  cells: z
    .array(
      z.object({
        vehicleTypeId: idField,
        filmTypeId: optionalId,
        price: z.union([z.null(), z.number().int().min(0).max(100_000_000)]),
      }),
    )
    .max(500),
});

export const filmTypeSchema = z.object({
  name: requiredText("Name", 80),
  slug: slugField,
  tagline: optionalText(160),
  description: optionalText(2000),
  heatRejection: optionalInt(0, 100),
  uvRejection: optionalInt(0, 100),
  glareReduction: optionalInt(0, 100),
  warrantyYears: optionalInt(0, 100),
  shades: z
    .string()
    .optional()
    .transform((v) =>
      Array.from(
        new Set(
          (v ?? "")
            .split(/[\s,]+/)
            .map((s) => Number.parseInt(s, 10))
            .filter((n) => Number.isInteger(n) && n > 0 && n <= 100),
        ),
      ).sort((a, b) => a - b),
    ),
  features: lines,
  sortOrder: intField(0, 1000, 0),
  active: checkbox,
});

export const vehicleTypeSchema = z.object({
  id: optionalId,
  name: requiredText("Name", 60),
  slug: slugField,
  description: optionalText(200),
  sortOrder: intField(0, 1000, 0),
  active: checkbox,
});

export const vehicleSizeSchema = z.object({
  id: optionalId,
  name: requiredText("Name", 60),
  slug: slugField,
  description: optionalText(200),
  priceAdjustPercent: intField(-90, 500, 0),
  durationAdjustPercent: intField(-90, 500, 0),
  sortOrder: intField(0, 1000, 0),
  active: checkbox,
});

export const packageSchema = z.object({
  id: optionalId,
  name: requiredText("Name", 80),
  slug: slugField,
  tagline: optionalText(160),
  description: optionalText(1000),
  price: centsField,
  priceSuffix: optionalText(40),
  features: lines,
  recommendedFor: lines,
  serviceId: optionalId,
  serviceOptionId: optionalId,
  filmTypeId: optionalId,
  highlighted: checkbox,
  active: checkbox,
  sortOrder: intField(0, 1000, 0),
});

const optionalDateTime = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(v) : null))
  .refine((v) => v === null || !Number.isNaN(v.getTime()), "Invalid date");

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, "Code is required")
      .max(40)
      .regex(/^[A-Z0-9_-]+$/, "Letters, numbers, dashes and underscores only"),
    description: optionalText(200),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.coerce.number({ error: "Enter a value" }).positive("Must be greater than 0").max(100_000),
    minPurchase: optionalCents,
    maxDiscount: optionalCents,
    startsAt: optionalDateTime,
    expiresAt: optionalDateTime,
    usageLimit: optionalInt(1, 1_000_000),
    perCustomerLimit: optionalInt(1, 1000),
    active: checkbox,
    serviceIds: idList,
  })
  .refine((d) => d.type !== "PERCENT" || d.value <= 100, { path: ["value"], message: "Percent cannot exceed 100" })
  .transform((d) => ({ ...d, value: d.type === "PERCENT" ? Math.round(d.value) : Math.round(d.value * 100) }));

export const technicianSchema = z.object({
  name: requiredText("Name", 80),
  title: optionalText(80),
  bio: optionalText(1000),
  avatarUrl: urlOrPath,
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #3b82f6")
    .default("#3b82f6"),
  active: checkbox,
  sortOrder: intField(0, 1000, 0),
  userId: optionalId,
  serviceIds: idList,
});

export const technicianScheduleSchema = z.object({
  technicianId: idField,
  days: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        working: z.boolean(),
        startTime: hmField,
        endTime: hmField,
      }),
    )
    .length(7),
  useBusinessHours: z.boolean(),
});

export const timeOffSchema = z
  .object({
    technicianId: idField,
    startDate: ymdField,
    endDate: ymdField,
    reason: optionalText(200),
  })
  .refine((d) => d.endDate >= d.startDate, { path: ["endDate"], message: "End must be after start" });

export const businessHoursSchema = z.object({
  days: z
    .array(
      z
        .object({
          dayOfWeek: z.number().int().min(0).max(6),
          isOpen: z.boolean(),
          openTime: hmField,
          closeTime: hmField,
        })
        .refine((d) => !d.isOpen || d.closeTime > d.openTime, { message: "Closing time must be after opening time" }),
    )
    .length(7),
});

export const holidaySchema = z
  .object({
    date: ymdField,
    name: requiredText("Name", 100),
    closed: checkbox,
    openTime: z.string().optional().nullable().transform((v) => (v ? v : null)),
    closeTime: z.string().optional().nullable().transform((v) => (v ? v : null)),
  })
  .refine((d) => d.closed || (d.openTime && d.closeTime && d.closeTime > d.openTime), {
    path: ["closeTime"],
    message: "Special hours need an opening and closing time",
  });

export const breakSchema = z
  .object({
    dayOfWeek: z.preprocess((v) => (v === "" || v == null || v === "all" ? null : v), z.coerce.number().int().min(0).max(6).nullable()),
    startTime: hmField,
    endTime: hmField,
    label: optionalText(60),
  })
  .refine((d) => d.endTime > d.startTime, { path: ["endTime"], message: "End must be after start" });

export const bookingRulesSchema = z.object({
  slotIntervalMinutes: intField(5, 240),
  bufferMinutes: intField(0, 240),
  minNoticeHours: intField(0, 24 * 14),
  maxAdvanceDays: intField(1, 365),
  holdMinutes: intField(30, 24 * 60),
  reminderHoursBefore: intField(1, 24 * 7),
  cancellationWindowHours: intField(0, 24 * 14),
  shopCapacity: intField(1, 50),
});

export const businessSettingsSchema = z.object({
  businessName: requiredText("Business name", 100),
  tagline: optionalText(160),
  logoUrl: urlOrPath,
  phone: requiredText("Phone", 30),
  email: emailField,
  addressLine1: requiredText("Address", 120),
  addressLine2: optionalText(120),
  city: requiredText("City", 80),
  state: requiredText("State", 40),
  postalCode: requiredText("Postal code", 20),
  country: requiredText("Country", 2).pipe(z.string().length(2, "Use a 2-letter country code")),
  latitude: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(-90).max(90).nullable()),
  longitude: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(-180).max(180).nullable()),
  googleMapsUrl: httpUrl,
  googleMapsEmbedUrl: httpUrl.refine(
    (v) => v === null || /^https:\/\/(www\.)?google\.com\/maps\/embed/i.test(v),
    "Use the https://www.google.com/maps/embed?... URL from Google Maps → Share → Embed",
  ),
  instagramUrl: httpUrl,
  facebookUrl: httpUrl,
  tiktokUrl: httpUrl,
  youtubeUrl: httpUrl,
  googleReviewsUrl: httpUrl,
  timezone: z
    .string()
    .trim()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown time zone"),
  yearsInBusiness: optionalInt(0, 200),
  vehiclesCompleted: optionalInt(0, 10_000_000),
  heroHeadline: optionalText(120),
  heroSubheadline: optionalText(300),
});

export const paymentSettingsSchema = z.object({
  taxRatePercent: z.coerce.number().min(0).max(30).transform((v) => Math.round(v * 100)),
  depositPercent: intField(0, 100),
  depositMinimum: centsField,
  requireDeposit: checkbox,
  allowPayInFull: checkbox,
  currency: z.string().trim().toLowerCase().regex(/^[a-z]{3}$/, "3-letter currency code"),
  cancellationPolicy: requiredText("Cancellation policy", 3000),
  warrantyInfo: requiredText("Warranty information", 3000),
});

export const legalPageSchema = z.object({
  slug: z.enum(["privacy", "terms", "cancellation", "refund", "warranty"]),
  title: requiredText("Title", 120),
  content: requiredText("Content", 50_000),
});

export const galleryImageSchema = z.object({
  title: requiredText("Title", 120),
  caption: optionalText(300),
  alt: requiredText("Alt text", 200),
  imageUrl: urlOrPath.refine((v) => v !== null, "Upload an image"),
  beforeImageUrl: urlOrPath,
  categories: z.preprocess(
    (v) => (v == null || v === "" ? [] : Array.isArray(v) ? v : [v]),
    z.array(z.enum(["SEDAN", "TRUCK", "SUV", "LUXURY", "SPORTS", "CERAMIC", "WINDSHIELD", "FULL_VEHICLE"])).max(8),
  ),
  vehicle: optionalText(100),
  serviceId: optionalId,
  featured: checkbox,
  published: checkbox,
  width: optionalInt(1, 20000),
  height: optionalInt(1, 20000),
});

export const adminAppointmentSchema = z.object({
  userId: optionalId,
  customerName: requiredText("Customer name", 100),
  customerEmail: emailField,
  customerPhone: requiredText("Phone", 30),
  config: jobConfigSchema,
  vehicle: vehicleDetailsSchema.extend({ vehicleColor: optionalText(40) }),
  date: ymdField,
  time: hmField,
  technicianId: optionalId,
  status: z.enum(["PENDING", "CONFIRMED"]).default("CONFIRMED"),
  customerNotes: optionalText(1500),
  internalNotes: optionalText(3000),
  allowOverlap: z.boolean().default(false),
  sendConfirmation: z.boolean().default(true),
  quoteId: optionalId,
  priceOverride: z.number().int().min(0).max(100_000_000).nullable().optional(),
});
export type AdminAppointmentInput = z.input<typeof adminAppointmentSchema>;

export const appointmentStatusSchema = z.object({
  appointmentId: idField,
  status: z.enum(["PENDING", "CONFIRMED", "DEPOSIT_PAID", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  reason: optionalText(500),
  notifyCustomer: checkbox,
});

export const adminRescheduleSchema = z.object({
  appointmentId: idField,
  date: ymdField,
  time: hmField,
  technicianId: optionalId,
  allowOverlap: checkbox,
  notifyCustomer: checkbox,
});

export const manualPaymentSchema = z.object({
  appointmentId: idField,
  amount: centsField.refine((v) => v > 0, "Amount must be greater than 0"),
  type: z.enum(["DEPOSIT", "FULL", "BALANCE"]),
  method: requiredText("Method", 40),
  note: optionalText(300),
});

export const quoteResponseSchema = z.object({
  quoteId: idField,
  quotedPrice: optionalCents,
  message: requiredText("Message", 5000),
});

export const quoteStatusSchema = z.object({
  quoteId: idField,
  status: z.enum(["NEW", "CONTACTED", "ESTIMATE_SENT", "APPROVED", "DECLINED", "CONVERTED"]),
});

export const staffUserSchema = z.object({
  name: requiredText("Name", 100),
  email: emailField,
  phone: optionalPhone,
  role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
  password: z.union([z.literal(""), passwordField]).optional(),
  isActive: checkbox,
});

export const reviewAdminSchema = z.object({
  reviewId: idField,
  name: requiredText("Name", 80),
  rating: z.coerce.number().int().min(1).max(5),
  title: optionalText(120),
  body: requiredText("Review", 2000),
  vehicle: optionalText(80),
  adminReply: optionalText(1000),
});

import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { DAY_NAMES } from "@/lib/time";

export const CACHE_TAGS = {
  settings: "settings",
  catalog: "catalog",
  gallery: "gallery",
  reviews: "reviews",
  legal: "legal",
  schedule: "schedule",
} as const;

/** Used until the database is seeded, so the site never renders blank. */
export const DEFAULT_SETTINGS = {
  id: "default",
  businessName: "Obsidian Tint Studio",
  tagline: "Premium automotive window tint" as string | null,
  logoUrl: null as string | null,
  phone: "(555) 010-2040",
  email: "hello@example.com",
  addressLine1: "1200 Ember Ave, Suite 4",
  addressLine2: null as string | null,
  city: "Los Angeles",
  state: "CA",
  postalCode: "90021",
  country: "US",
  latitude: null as number | null,
  longitude: null as number | null,
  googleMapsUrl: null as string | null,
  googleMapsEmbedUrl: null as string | null,
  instagramUrl: null as string | null,
  facebookUrl: null as string | null,
  tiktokUrl: null as string | null,
  youtubeUrl: null as string | null,
  googleReviewsUrl: null as string | null,
  timezone: "America/Los_Angeles",
  currency: "usd",
  taxRateBps: 0,
  depositPercent: 25,
  depositMinimum: 5000,
  requireDeposit: false,
  allowPayInFull: true,
  slotIntervalMinutes: 30,
  bufferMinutes: 15,
  minNoticeHours: 12,
  maxAdvanceDays: 60,
  holdMinutes: 30,
  reminderHoursBefore: 24,
  cancellationWindowHours: 24,
  shopCapacity: 2,
  cancellationPolicy: "Cancel or reschedule at least 24 hours before your appointment for a full deposit refund.",
  warrantyInfo: "All film installations include a written warranty against bubbling, peeling and fading.",
  yearsInBusiness: null as number | null,
  vehiclesCompleted: null as number | null,
  heroHeadline: null as string | null,
  heroSubheadline: null as string | null,
};

export type Settings = typeof DEFAULT_SETTINGS;

const loadSettings = unstable_cache(
  async (): Promise<Settings> => {
    const row = await prisma.siteSettings.findUnique({ where: { id: "default" } });
    if (!row) return DEFAULT_SETTINGS;
    const { updatedAt: _updatedAt, ...rest } = row;
    return { ...DEFAULT_SETTINGS, ...rest };
  },
  ["site-settings"],
  { tags: [CACHE_TAGS.settings], revalidate: 3600 },
);

export const getSettings = cache(() => loadSettings());

export interface HoursRow {
  dayOfWeek: number;
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

const loadBusinessHours = unstable_cache(
  async (): Promise<HoursRow[]> => {
    const rows = await prisma.businessHours.findMany({ orderBy: { dayOfWeek: "asc" } });
    return DAY_NAMES.map((day, dayOfWeek) => {
      const row = rows.find((r) => r.dayOfWeek === dayOfWeek);
      return {
        dayOfWeek,
        day,
        isOpen: row?.isOpen ?? (dayOfWeek !== 0),
        openTime: row?.openTime ?? "09:00",
        closeTime: row?.closeTime ?? "18:00",
      };
    });
  },
  ["business-hours"],
  { tags: [CACHE_TAGS.schedule], revalidate: 3600 },
);

export const getBusinessHours = cache(() => loadBusinessHours());

export function formatAddress(s: Pick<Settings, "addressLine1" | "addressLine2" | "city" | "state" | "postalCode">) {
  return [s.addressLine1, s.addressLine2, `${s.city}, ${s.state} ${s.postalCode}`].filter(Boolean).join(", ");
}

export function mapsLink(s: Settings) {
  return s.googleMapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.businessName} ${formatAddress(s)}`)}`;
}

export function mapsEmbed(s: Settings) {
  return s.googleMapsEmbedUrl ?? `https://www.google.com/maps?q=${encodeURIComponent(formatAddress(s))}&output=embed`;
}

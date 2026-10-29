import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats integer cents as currency, e.g. 39900 → "$399". */
export function formatCurrency(cents: number, opts: { currency?: string; exact?: boolean } = {}) {
  const { currency = "usd", exact = false } = opts;
  const value = cents / 100;
  const hasFraction = Math.round(cents) % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: exact || hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function dollarsToCents(value: string | number): number {
  const n = typeof value === "number" ? value : Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function centsToDollarsInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr${h > 1 ? "s" : ""}`;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}

/** Splits a textarea value into trimmed, non-empty lines. */
export function linesToArray(value: string | null | undefined) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Canonical base URL: NEXT_PUBLIC_SITE_URL, else the Vercel production domain, else localhost. */
export function siteBaseUrl() {
  const vercel = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/$/, "");
}

export function absoluteUrl(path = "/") {
  const base = siteBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function vehicleLabel(v: { vehicleYear?: number | null; vehicleMake?: string | null; vehicleModel?: string | null }) {
  return [v.vehicleYear, v.vehicleMake, v.vehicleModel].filter(Boolean).join(" ") || "Vehicle";
}

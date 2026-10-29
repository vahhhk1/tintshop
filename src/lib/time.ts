/**
 * Time-zone helpers built on Intl (no dependencies). Business hours are stored as
 * wall-clock "HH:mm" in the shop's timezone; appointments are stored as UTC instants.
 * Dates without time are passed around as "YYYY-MM-DD" strings.
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, timeZone: string) {
  const parts: Record<string, string> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday] ?? 0,
  };
}

/** Offset of `timeZone` from UTC at `date`, in minutes (e.g. -420 for PDT). */
export function tzOffsetMinutes(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Converts a wall-clock date + time in `timeZone` to a UTC Date. */
export function zonedToUtc(ymd: string, hm: string, timeZone: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, min] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = tzOffsetMinutes(new Date(guess), timeZone);
  let result = guess - first * 60000;
  const second = tzOffsetMinutes(new Date(result), timeZone);
  if (second !== first) result = guess - second * 60000;
  return new Date(result);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toYmd(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function toHm(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function todayYmd(timeZone: string) {
  return toYmd(new Date(), timeZone);
}

export function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function weekdayOfYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isValidYmd(ymd: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "YYYY-MM-DD" → Date at UTC midnight (for @db.Date columns). */
export function ymdToDateOnly(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function dateOnlyToYmd(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function hmToMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHm(total: number) {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function formatHm(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad(m)} ${suffix}`;
}

export function formatInTz(date: Date | string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(new Date(date));
}

export function formatDate(date: Date | string, timeZone: string) {
  return formatInTz(date, timeZone, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function formatLongDate(date: Date | string, timeZone: string) {
  return formatInTz(date, timeZone, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function formatTime(date: Date | string, timeZone: string) {
  return formatInTz(date, timeZone, { hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(date: Date | string, timeZone: string) {
  return `${formatDate(date, timeZone)} · ${formatTime(date, timeZone)}`;
}

export function formatYmd(ymd: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(ymdToDateOnly(ymd));
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** A Date `days` before now (negative = in the future). */
export function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

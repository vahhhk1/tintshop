import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { addDaysYmd, formatHm, todayYmd, weekdayOfYmd, ymdToDateOnly, zonedToUtc, toHm } from "@/lib/time";
import { getSettings, type Settings } from "@/server/settings";

type Db = Prisma.TransactionClient | typeof prisma;

interface Interval {
  start: number;
  end: number;
}

export interface Slot {
  time: string;
  label: string;
  startsAt: string;
  technicianIds: string[];
}

export interface AvailabilityInput {
  date: string;
  durationMinutes: number;
  serviceId: string;
  technicianId?: string | null;
  excludeAppointmentId?: string | null;
  /** Staff may book inside the minimum-notice window. */
  ignoreNotice?: boolean;
}

export interface AvailabilityResult {
  slots: Slot[];
  closedReason?: string;
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;
const contains = (outer: Interval, inner: Interval) => outer.start <= inner.start && inner.end <= outer.end;

/** Appointments that occupy time: everything except cancellations, no-shows and expired unpaid holds. */
export function blockingAppointmentWhere(now = new Date()): Prisma.AppointmentWhereInput {
  return {
    status: { notIn: ["CANCELLED", "NO_SHOW"] },
    OR: [{ status: { not: "PENDING" } }, { holdExpiresAt: null }, { holdExpiresAt: { gt: now } }, { amountPaid: { gt: 0 } }],
  };
}

function subtract(windows: Interval[], blocks: Interval[]) {
  let result = windows;
  for (const block of blocks) {
    const next: Interval[] = [];
    for (const w of result) {
      if (!overlaps(w, block)) {
        next.push(w);
        continue;
      }
      if (block.start > w.start) next.push({ start: w.start, end: block.start });
      if (block.end < w.end) next.push({ start: block.end, end: w.end });
    }
    result = next;
  }
  return result;
}

/** Opening hours for a date after holidays are applied. */
export async function getOpeningWindow(date: string, settings: Settings, db: Db = prisma) {
  const weekday = weekdayOfYmd(date);
  const [hours, holiday, breaks] = await Promise.all([
    db.businessHours.findUnique({ where: { dayOfWeek: weekday } }),
    db.holiday.findUnique({ where: { date: ymdToDateOnly(date) } }),
    db.breakPeriod.findMany({ where: { OR: [{ dayOfWeek: null }, { dayOfWeek: weekday }] } }),
  ]);

  let openHm: string;
  let closeHm: string;
  if (holiday) {
    if (holiday.closed || !holiday.openTime || !holiday.closeTime) return { open: null, reason: `Closed for ${holiday.name}` } as const;
    openHm = holiday.openTime;
    closeHm = holiday.closeTime;
  } else {
    if (hours && !hours.isOpen) return { open: null, reason: "Closed on this day" } as const;
    if (!hours && weekday === 0) return { open: null, reason: "Closed on this day" } as const;
    openHm = hours?.openTime ?? "09:00";
    closeHm = hours?.closeTime ?? "18:00";
  }
  const tz = settings.timezone;
  const open: Interval = { start: zonedToUtc(date, openHm, tz).getTime(), end: zonedToUtc(date, closeHm, tz).getTime() };
  const breakIntervals = breaks.map((b) => ({ start: zonedToUtc(date, b.startTime, tz).getTime(), end: zonedToUtc(date, b.endTime, tz).getTime() }));
  return { open, breaks: breakIntervals, weekday, reason: undefined } as const;
}

export async function computeAvailability(input: AvailabilityInput, db: Db = prisma): Promise<AvailabilityResult> {
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayYmd(tz);
  if (input.date < today) return { slots: [], closedReason: "That date has passed" };
  if (!input.ignoreNotice && input.date > addDaysYmd(today, settings.maxAdvanceDays)) {
    return { slots: [], closedReason: `Bookings open up to ${settings.maxAdvanceDays} days ahead` };
  }

  const day = await getOpeningWindow(input.date, settings, db);
  if (!day.open) return { slots: [], closedReason: day.reason };
  const { open, breaks, weekday } = day;

  const bufferMs = settings.bufferMinutes * 60_000;
  const durationMs = input.durationMinutes * 60_000;
  const now = new Date();

  const [technicians, appointments] = await Promise.all([
    db.technician.findMany({
      where: { active: true, OR: [{ services: { none: {} } }, { services: { some: { id: input.serviceId } } }] },
      select: {
        id: true,
        schedules: { where: { dayOfWeek: weekday } },
        timeOff: { where: { startsAt: { lt: new Date(open.end) }, endsAt: { gt: new Date(open.start) } } },
        _count: { select: { schedules: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    db.appointment.findMany({
      where: {
        ...blockingAppointmentWhere(now),
        ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
        startsAt: { lt: new Date(open.end + bufferMs) },
        endsAt: { gt: new Date(open.start - bufferMs) },
      },
      select: { startsAt: true, endsAt: true, technicianId: true },
    }),
  ]);

  const booked = appointments.map((a) => ({
    interval: { start: a.startsAt.getTime() - bufferMs, end: a.endsAt.getTime() + bufferMs },
    technicianId: a.technicianId,
  }));

  const techWindows = new Map<string, Interval[]>();
  for (const tech of technicians) {
    let windows: Interval[];
    if (tech._count.schedules === 0) {
      windows = [open];
    } else {
      windows = tech.schedules
        .map((s) => ({ start: zonedToUtc(input.date, s.startTime, tz).getTime(), end: zonedToUtc(input.date, s.endTime, tz).getTime() }))
        .map((w) => ({ start: Math.max(w.start, open.start), end: Math.min(w.end, open.end) }))
        .filter((w) => w.end > w.start);
    }
    windows = subtract(
      windows,
      tech.timeOff.map((t) => ({ start: t.startsAt.getTime(), end: t.endsAt.getTime() })),
    );
    techWindows.set(tech.id, windows);
  }

  if (input.technicianId && !techWindows.has(input.technicianId)) {
    return { slots: [], closedReason: "That technician isn't available for this service" };
  }

  const earliest = input.ignoreNotice ? now.getTime() : now.getTime() + settings.minNoticeHours * 3_600_000;
  const step = settings.slotIntervalMinutes * 60_000;
  const slots: Slot[] = [];

  for (let start = open.start; start + durationMs <= open.end; start += step) {
    const candidate: Interval = { start, end: start + durationMs };
    if (start < earliest) continue;
    if (breaks.some((b) => overlaps(b, candidate))) continue;

    const overlapping = booked.filter((b) => overlaps(b.interval, candidate));

    let technicianIds: string[] = [];
    let available: boolean;
    if (technicians.length > 0) {
      technicianIds = technicians
        .filter((t) => techWindows.get(t.id)!.some((w) => contains(w, candidate)))
        .filter((t) => !overlapping.some((b) => b.technicianId === t.id))
        .map((t) => t.id);
      // Unassigned bookings still need someone — reserve capacity for them.
      const unassigned = overlapping.filter((b) => !b.technicianId).length;
      if (input.technicianId) {
        available = technicianIds.includes(input.technicianId) && technicianIds.length - 1 >= unassigned;
      } else {
        available = technicianIds.length - unassigned > 0;
      }
    } else {
      available = overlapping.length < settings.shopCapacity;
    }

    if (available) {
      const time = toHm(new Date(start), tz);
      slots.push({ time, label: formatHm(time), startsAt: new Date(start).toISOString(), technicianIds });
    }
  }

  return { slots, closedReason: slots.length ? undefined : "Fully booked — please try another day" };
}

/** Choose the technician with the fewest bookings that day among those free. */
export async function pickTechnician(candidates: string[], date: string, settings: Settings, db: Db = prisma) {
  if (candidates.length <= 1) return candidates[0] ?? null;
  const dayStart = zonedToUtc(date, "00:00", settings.timezone);
  const dayEnd = zonedToUtc(addDaysYmd(date, 1), "00:00", settings.timezone);
  const counts = await db.appointment.groupBy({
    by: ["technicianId"],
    where: { technicianId: { in: candidates }, startsAt: { gte: dayStart, lt: dayEnd }, ...blockingAppointmentWhere() },
    _count: { _all: true },
  });
  const load = new Map(counts.map((c) => [c.technicianId, c._count._all]));
  return [...candidates].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0))[0] ?? null;
}

export class SlotUnavailableError extends Error {
  constructor(message = "Sorry — that time was just taken. Please choose another slot.") {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

/**
 * Re-checks availability inside a transaction while holding a per-day advisory
 * lock, so two customers can never book the same capacity concurrently.
 */
export async function reserveSlot(
  tx: Prisma.TransactionClient,
  input: AvailabilityInput & { time: string; allowOverlap?: boolean },
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${input.date}`}))`;
  const settings = await getSettings();
  const startsAt = zonedToUtc(input.date, input.time, settings.timezone);
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);

  if (input.allowOverlap) {
    return { startsAt, endsAt, technicianId: input.technicianId ?? null };
  }

  const { slots } = await computeAvailability(input, tx);
  const slot = slots.find((s) => s.time === input.time);
  if (!slot) throw new SlotUnavailableError();

  const technicianId = input.technicianId ?? (await pickTechnician(slot.technicianIds, input.date, settings, tx));
  return { startsAt, endsAt, technicianId };
}

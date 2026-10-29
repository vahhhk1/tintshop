import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { limitByIp } from "@/lib/rate-limit";
import { addDaysYmd, todayYmd } from "@/lib/time";
import { idField, optionalId, ymdField } from "@/lib/validation/common";
import { tokenMatches } from "@/server/appointments/access";
import { computeAvailability } from "@/server/appointments/availability";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  date: ymdField.optional(),
  from: ymdField.optional(),
  days: z.coerce.number().int().min(1).max(21).default(14),
  serviceId: idField,
  duration: z.coerce.number().int().min(15).max(24 * 60),
  technicianId: optionalId,
  exclude: optionalId,
  token: z.string().max(128).optional(),
});

/**
 * GET /api/availability
 *   ?date=YYYY-MM-DD&serviceId&duration[&technicianId]          → open slots for one day
 *   ?from=YYYY-MM-DD&days=14&serviceId&duration[&technicianId]  → slot counts per day
 * `exclude` (an appointment id being rescheduled) requires that appointment's manage token
 * or a signed-in owner — enforced by only honouring it when the token matches.
 */
export async function GET(request: Request) {
  const limit = await limitByIp("availability", 120, 60);
  if (!limit.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const q = parsed.data;

  let excludeAppointmentId: string | null = null;
  if (q.exclude && q.token) {
    const a = await prisma.appointment.findUnique({ where: { id: q.exclude }, select: { manageToken: true } });
    if (a && tokenMatches(a.manageToken, q.token)) excludeAppointmentId = q.exclude;
  }

  const base = { serviceId: q.serviceId, durationMinutes: q.duration, technicianId: q.technicianId, excludeAppointmentId };

  if (q.date) {
    const result = await computeAvailability({ ...base, date: q.date });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  }

  const settings = await getSettings();
  const start = q.from ?? todayYmd(settings.timezone);
  const days = await Promise.all(
    Array.from({ length: q.days }, async (_, i) => {
      const date = addDaysYmd(start, i);
      const r = await computeAvailability({ ...base, date });
      return { date, count: r.slots.length, closedReason: r.closedReason ?? null };
    }),
  );
  return NextResponse.json({ days }, { headers: { "Cache-Control": "no-store" } });
}

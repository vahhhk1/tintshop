import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { notify } from "@/server/notifications";
import { releaseExpiredHolds } from "@/server/payments/service";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = env.cronSecret;
  if (!secret) return !env.isProduction; // open in development only
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Daily job (vercel.json, 15:00 UTC = morning in Los Angeles; Vercel Hobby allows one run a
 * day): releases unpaid holds that have lapsed and sends reminders for appointments within
 * the next `reminderHoursBefore` hours. With the default 24 h window every appointment gets
 * its reminder; a shorter window needs an hourly schedule (Vercel Pro). Lapsed holds stop
 * blocking availability on their own, so the release is only housekeeping.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const released = await releaseExpiredHolds();
  const settings = await getSettings();
  const now = new Date();
  const horizon = new Date(now.getTime() + settings.reminderHoursBefore * 3_600_000);

  const due = await prisma.appointment.findMany({
    where: {
      reminderSentAt: null,
      startsAt: { gt: now, lte: horizon },
      status: { in: ["PENDING", "CONFIRMED", "DEPOSIT_PAID"] },
      OR: [{ status: { not: "PENDING" } }, { holdExpiresAt: null }],
    },
    select: { id: true },
    take: 200,
  });

  let sent = 0;
  for (const a of due) {
    // Claim first so overlapping runs never double-send.
    const claimed = await prisma.appointment.updateMany({ where: { id: a.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
    if (claimed.count === 0) continue;
    await notify.reminder(a.id);
    sent++;
  }

  return Response.json({ ok: true, released, reminders: sent });
}

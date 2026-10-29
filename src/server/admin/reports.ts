import "server-only";
import { prisma } from "@/lib/db/prisma";
import { addDaysYmd, toYmd, todayYmd, weekdayOfYmd, zonedToUtc } from "@/lib/time";
import type { Settings } from "@/server/settings";

/** Monday of the week containing `ymd`. */
function weekStart(ymd: string) {
  const wd = weekdayOfYmd(ymd);
  return addDaysYmd(ymd, -((wd + 6) % 7));
}

const shortDate = (ymd: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));

export async function getDashboardData(settings: Settings) {
  const tz = settings.timezone;
  const today = todayYmd(tz);
  const dayStart = zonedToUtc(today, "00:00", tz);
  const dayEnd = zonedToUtc(addDaysYmd(today, 1), "00:00", tz);
  const weekAhead = zonedToUtc(addDaysYmd(today, 8), "00:00", tz);
  const thirtyAgo = zonedToUtc(addDaysYmd(today, -30), "00:00", tz);
  const sixtyAgo = zonedToUtc(addDaysYmd(today, -60), "00:00", tz);
  const firstWeek = weekStart(addDaysYmd(today, -7 * 11));
  const chartStart = zonedToUtc(firstWeek, "00:00", tz);
  const monthsBack = 6;
  const growthStartYmd = `${today.slice(0, 7)}-01`;
  const [gy, gm] = growthStartYmd.split("-").map(Number);
  const growthStart = new Date(Date.UTC(gy!, gm! - 1 - (monthsBack - 1), 1));

  const include = { service: { select: { name: true } }, serviceOption: { select: { name: true } }, technician: { select: { name: true, color: true } } } as const;

  const [
    todays,
    upcoming,
    revenue30,
    revenuePrev30,
    pendingQuotes,
    newCustomers30,
    completed30,
    cancelled30,
    recentPayments,
    chartPayments,
    chartAppointments,
    serviceCounts,
    customersBefore,
    customersSince,
  ] = await Promise.all([
    prisma.appointment.findMany({ where: { startsAt: { gte: dayStart, lt: dayEnd }, status: { notIn: ["CANCELLED"] } }, orderBy: { startsAt: "asc" }, include }),
    prisma.appointment.findMany({
      where: { startsAt: { gte: dayEnd, lt: weekAhead }, status: { in: ["PENDING", "CONFIRMED", "DEPOSIT_PAID"] } },
      orderBy: { startsAt: "asc" },
      take: 8,
      include,
    }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED", paidAt: { gte: thirtyAgo } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED", paidAt: { gte: sixtyAgo, lt: thirtyAgo } }, _sum: { amount: true } }),
    prisma.quote.count({ where: { status: { in: ["NEW", "CONTACTED"] } } }),
    prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: thirtyAgo } } }),
    prisma.appointment.count({ where: { status: "COMPLETED", startsAt: { gte: thirtyAgo, lt: dayEnd } } }),
    prisma.appointment.count({ where: { status: { in: ["CANCELLED", "NO_SHOW"] }, startsAt: { gte: thirtyAgo, lt: dayEnd } } }),
    prisma.payment.findMany({
      where: { status: { in: ["SUCCEEDED", "REFUNDED"] } },
      orderBy: { paidAt: "desc" },
      take: 6,
      include: { appointment: { select: { id: true, customerName: true, reference: true, service: { select: { name: true } } } } },
    }),
    prisma.payment.findMany({ where: { status: "SUCCEEDED", paidAt: { gte: chartStart } }, select: { amount: true, paidAt: true } }),
    prisma.appointment.findMany({ where: { startsAt: { gte: chartStart, lt: dayEnd } }, select: { startsAt: true, status: true } }),
    prisma.appointment.groupBy({
      by: ["serviceId"],
      where: { startsAt: { gte: zonedToUtc(addDaysYmd(today, -90), "00:00", tz) }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      _count: { _all: true },
    }),
    prisma.user.count({ where: { role: "CUSTOMER", createdAt: { lt: growthStart } } }),
    prisma.user.findMany({ where: { role: "CUSTOMER", createdAt: { gte: growthStart } }, select: { createdAt: true } }),
  ]);

  // Weekly buckets
  const weeks = Array.from({ length: 12 }, (_, i) => addDaysYmd(firstWeek, i * 7));
  const revenueByWeek = new Map(weeks.map((w) => [w, 0]));
  for (const p of chartPayments) {
    if (!p.paidAt) continue;
    const w = weekStart(toYmd(p.paidAt, tz));
    if (revenueByWeek.has(w)) revenueByWeek.set(w, revenueByWeek.get(w)! + p.amount);
  }
  const apptByWeek = new Map(weeks.map((w) => [w, { completed: 0, cancelled: 0, scheduled: 0 }]));
  for (const a of chartAppointments) {
    const bucket = apptByWeek.get(weekStart(toYmd(a.startsAt, tz)));
    if (!bucket) continue;
    if (a.status === "COMPLETED") bucket.completed++;
    else if (a.status === "CANCELLED" || a.status === "NO_SHOW") bucket.cancelled++;
    else bucket.scheduled++;
  }

  const services = await prisma.service.findMany({ where: { id: { in: serviceCounts.map((s) => s.serviceId) } }, select: { id: true, name: true } });
  const popular = serviceCounts
    .map((s) => ({ name: services.find((x) => x.id === s.serviceId)?.name ?? "Other", count: s._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const months = Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(Date.UTC(growthStart.getUTCFullYear(), growthStart.getUTCMonth() + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  let running = customersBefore;
  const growth = months.map((m) => {
    const added = customersSince.filter((u) => toYmd(u.createdAt, tz).startsWith(m)).length;
    running += added;
    const [y, mo] = m.split("-").map(Number);
    return { label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y!, mo! - 1, 1))), customers: running, added };
  });

  return {
    todays,
    upcoming,
    kpis: {
      revenue30: revenue30._sum.amount ?? 0,
      revenuePrev30: revenuePrev30._sum.amount ?? 0,
      pendingQuotes,
      newCustomers30,
      completed30,
      cancelled30,
      upcomingWeek: upcoming.length,
    },
    recentPayments,
    charts: {
      revenue: weeks.map((w) => ({ label: shortDate(w), value: Math.round(revenueByWeek.get(w)! / 100) })),
      appointments: weeks.map((w) => ({ label: shortDate(w), ...apptByWeek.get(w)! })),
      popular,
      growth,
    },
  };
}

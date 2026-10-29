import Link from "next/link";
import { Bell, CalendarCheck, CalendarDays, Car, ClipboardList, Wallet } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { AppointmentRow } from "@/components/dashboard/appointment-row";
import { Button } from "@/components/ui/button";
import { EmptyState, StatTile } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, formatLongDate, formatTime } from "@/lib/time";
import { formatCurrency, vehicleLabel } from "@/lib/utils";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Overview" };

const ACTIVE = ["PENDING", "CONFIRMED", "DEPOSIT_PAID", "IN_PROGRESS"] as const;

export default async function DashboardOverview() {
  const user = await requireUser("/dashboard");
  const now = new Date();
  const [settings, upcoming, upcomingCount, spent, vehicles, openQuotes, notifications] = await Promise.all([
    getSettings(),
    prisma.appointment.findMany({
      where: { userId: user.id, status: { in: [...ACTIVE] }, endsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 3,
      include: { service: { select: { name: true } }, serviceOption: { select: { name: true } } },
    }),
    prisma.appointment.count({ where: { userId: user.id, status: { in: [...ACTIVE] }, endsAt: { gte: now } } }),
    prisma.payment.aggregate({ where: { userId: user.id, status: "SUCCEEDED" }, _sum: { amount: true } }),
    prisma.vehicle.count({ where: { userId: user.id } }),
    prisma.quote.count({ where: { userId: user.id, status: { in: ["NEW", "CONTACTED", "ESTIMATE_SENT"] } } }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const next = upcoming[0];

  return (
    <>
      <PageHeader
        title={`Hi${user.name ? `, ${user.name.split(" ")[0]}` : ""} 👋`}
        description="Here’s what’s happening with your vehicles."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/quote">Get a quote</Link>
            </Button>
            <Button asChild>
              <Link href="/book">
                <CalendarCheck aria-hidden /> Book service
              </Link>
            </Button>
          </>
        }
      />

      {next ? (
        <Link
          href={`/dashboard/appointments/${next.id}`}
          className="group mb-8 block overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.12] via-card to-card p-6 transition-colors hover:border-primary/50 sm:p-8"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Next appointment</p>
            <StatusBadge kind="appointment" status={next.status} />
          </div>
          <p className="mt-3 text-2xl font-semibold sm:text-3xl">
            {formatLongDate(next.startsAt, settings.timezone)} · {formatTime(next.startsAt, settings.timezone)}
          </p>
          <p className="mt-2 text-muted-foreground">
            {[next.service.name, next.serviceOption?.name].filter(Boolean).join(" — ")} · {vehicleLabel(next)}
          </p>
          <p className="mt-4 text-sm font-medium text-primary">View details, reschedule or pay →</p>
        </Link>
      ) : (
        <EmptyState
          className="mb-8"
          icon={CalendarDays}
          title="No upcoming appointments"
          description="Ready for a refresh? Book online in under two minutes."
          action={
            <Button asChild>
              <Link href="/book">Book now</Link>
            </Button>
          }
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Upcoming" value={upcomingCount} icon={CalendarDays} />
        <StatTile label="Total spent" value={formatCurrency(spent._sum.amount ?? 0)} icon={Wallet} />
        <StatTile label="Saved vehicles" value={vehicles} icon={Car} />
        <StatTile label="Open quotes" value={openQuotes} icon={ClipboardList} />
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <section aria-labelledby="up-h">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="up-h" className="text-lg font-semibold">
              Upcoming
            </h2>
            <Link href="/dashboard/appointments" className="text-sm text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          {upcoming.length ? (
            <ul className="grid gap-3">
              {upcoming.map((a) => (
                <AppointmentRow key={a.id} a={a} href={`/dashboard/appointments/${a.id}`} timeZone={settings.timezone} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
          )}
        </section>
        <section aria-labelledby="notif-h">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="notif-h" className="text-lg font-semibold">
              Recent updates
            </h2>
            <Link href="/dashboard/notifications" className="text-sm text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          {notifications.length ? (
            <ul className="grid gap-2">
              {notifications.map((n) => (
                <li key={n.id} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-card p-4">
                  <Bell className={n.readAt ? "mt-0.5 size-4 text-muted-foreground" : "mt-0.5 size-4 text-primary"} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(n.createdAt, settings.timezone)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          )}
        </section>
      </div>
    </>
  );
}

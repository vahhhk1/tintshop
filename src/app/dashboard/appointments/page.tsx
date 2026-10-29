import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { AppointmentRow } from "@/components/dashboard/appointment-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Appointments" };

export default async function MyAppointmentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, user, settings] = await Promise.all([searchParams, requireUser("/dashboard/appointments"), getSettings()]);
  const past = tab === "past";
  const now = new Date();
  const appointments = await prisma.appointment.findMany({
    where: past
      ? { userId: user.id, OR: [{ endsAt: { lt: now } }, { status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] } }] }
      : { userId: user.id, endsAt: { gte: now }, status: { in: ["PENDING", "CONFIRMED", "DEPOSIT_PAID", "IN_PROGRESS"] } },
    orderBy: { startsAt: past ? "desc" : "asc" },
    take: 100,
    include: { service: { select: { name: true } }, serviceOption: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader
        title="Appointments"
        actions={
          <Button asChild>
            <Link href="/book">Book new</Link>
          </Button>
        }
      />
      <div role="tablist" className="mb-6 inline-flex rounded-full border border-white/10 p-1">
        {[
          ["upcoming", "Upcoming"],
          ["past", "Past"],
        ].map(([value, label]) => {
          const active = (value === "past") === past;
          return (
            <Link
              key={value}
              role="tab"
              aria-selected={active}
              href={value === "past" ? "/dashboard/appointments?tab=past" : "/dashboard/appointments"}
              className={cn("rounded-full px-5 py-2 text-sm font-medium transition-colors", active ? "bg-white text-black" : "text-foreground/70 hover:text-foreground")}
            >
              {label}
            </Link>
          );
        })}
      </div>
      {appointments.length ? (
        <ul className="grid gap-3">
          {appointments.map((a) => (
            <AppointmentRow key={a.id} a={a} href={`/dashboard/appointments/${a.id}`} timeZone={settings.timezone} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title={past ? "No past appointments" : "No upcoming appointments"}
          description={past ? "Completed and cancelled appointments will appear here." : "Book online and it will show up here."}
          action={
            !past ? (
              <Button asChild>
                <Link href="/book">Book now</Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </>
  );
}

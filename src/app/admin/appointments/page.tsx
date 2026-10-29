import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus, Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/dashboard/shell";
import { AppointmentRow } from "@/components/dashboard/appointment-row";
import { MonthGrid, TimeGrid } from "@/components/admin/calendar";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { statusOptions } from "@/components/ui/status";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { addDaysYmd, formatYmd, isValidYmd, todayYmd, weekdayOfYmd, zonedToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Appointments" };

type View = "list" | "day" | "week" | "month";

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; q?: string; status?: string; tech?: string; when?: string }>;
}) {
  const [sp] = await Promise.all([searchParams, requirePermission("appointments:manage", "/admin/appointments")]);
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayYmd(tz);
  const view: View = (["list", "day", "week", "month"] as const).includes(sp.view as View) ? (sp.view as View) : "list";
  const date = sp.date && isValidYmd(sp.date) ? sp.date : today;
  const technicians = await prisma.technician.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, color: true } });

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { view, date: view === "list" ? undefined : date, q: sp.q, status: sp.status, tech: sp.tech, when: sp.when, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/appointments?${p}`;
  };

  const where: Prisma.AppointmentWhereInput = {};
  if (sp.status) where.status = sp.status as Prisma.AppointmentWhereInput["status"];
  if (sp.tech) where.technicianId = sp.tech === "none" ? null : sp.tech;
  if (sp.q) {
    const q = sp.q.trim();
    where.OR = [
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q } },
      { reference: { contains: q.toUpperCase() } },
      { vehicleMake: { contains: q, mode: "insensitive" } },
      { vehicleModel: { contains: q, mode: "insensitive" } },
    ];
  }

  let rangeStart: string;
  let days: string[] = [];
  if (view === "day") {
    rangeStart = date;
    days = [date];
  } else if (view === "week") {
    rangeStart = addDaysYmd(date, -((weekdayOfYmd(date) + 6) % 7));
    days = Array.from({ length: 7 }, (_, i) => addDaysYmd(rangeStart, i));
  } else if (view === "month") {
    const first = `${date.slice(0, 7)}-01`;
    rangeStart = addDaysYmd(first, -((weekdayOfYmd(first) + 6) % 7));
    days = Array.from({ length: 42 }, (_, i) => addDaysYmd(rangeStart, i));
  } else {
    rangeStart = today;
  }

  const include = { service: { select: { name: true } }, serviceOption: { select: { name: true } }, technician: { select: { name: true, color: true } } } as const;
  const now = new Date();
  const appointments =
    view === "list"
      ? await prisma.appointment.findMany({
          where: {
            ...where,
            ...(sp.when === "past" ? { startsAt: { lt: now } } : sp.when === "all" ? {} : { endsAt: { gte: zonedToUtc(today, "00:00", tz) } }),
          },
          orderBy: { startsAt: sp.when === "past" ? "desc" : "asc" },
          take: 200,
          include,
        })
      : await prisma.appointment.findMany({
          where: { ...where, startsAt: { gte: zonedToUtc(days[0]!, "00:00", tz), lt: zonedToUtc(addDaysYmd(days[days.length - 1]!, 1), "00:00", tz) } },
          orderBy: { startsAt: "asc" },
          include,
        });

  const step = view === "day" ? 1 : view === "week" ? 7 : 0;
  const prevDate = view === "month" ? addMonths(date, -1) : addDaysYmd(date, -step);
  const nextDate = view === "month" ? addMonths(date, 1) : addDaysYmd(date, step);
  const title =
    view === "day"
      ? formatYmd(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : view === "week"
        ? `Week of ${formatYmd(days[0]!, { month: "long", day: "numeric", year: "numeric" })}`
        : view === "month"
          ? formatYmd(`${date.slice(0, 7)}-01`, { month: "long", year: "numeric" })
          : null;

  return (
    <>
      <PageHeader
        title="Appointments"
        actions={
          <Button asChild>
            <Link href="/admin/appointments/new">
              <Plus aria-hidden /> New appointment
            </Link>
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="inline-flex w-fit rounded-full border border-white/10 p-1" role="tablist" aria-label="View">
          {(
            [
              ["list", "List", List],
              ["day", "Day", CalendarDays],
              ["week", "Week", CalendarDays],
              ["month", "Month", CalendarDays],
            ] as const
          ).map(([v, label, Icon]) => (
            <Link
              key={v}
              role="tab"
              aria-selected={view === v}
              href={qs({ view: v, date: v === "list" ? undefined : date })}
              className={cn("flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium", view === v ? "bg-white text-black" : "text-foreground/70 hover:text-foreground")}
            >
              <Icon className="size-3.5" aria-hidden /> {label}
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap items-center gap-2" action="/admin/appointments">
          <input type="hidden" name="view" value={view} />
          {view !== "list" && <input type="hidden" name="date" value={date} />}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={sp.q} placeholder="Name, phone, reference…" className="h-10 w-56 pl-9" aria-label="Search appointments" />
          </div>
          <NativeSelect name="status" defaultValue={sp.status ?? ""} className="h-10 w-40" aria-label="Status">
            <option value="">All statuses</option>
            {statusOptions("appointment").map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="tech" defaultValue={sp.tech ?? ""} className="h-10 w-40" aria-label="Technician">
            <option value="">All technicians</option>
            <option value="none">Unassigned</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
          {view === "list" && (
            <NativeSelect name="when" defaultValue={sp.when ?? ""} className="h-10 w-36" aria-label="Time range">
              <option value="">Upcoming</option>
              <option value="past">Past</option>
              <option value="all">All</option>
            </NativeSelect>
          )}
          <Button type="submit" variant="subtle" size="sm" className="h-10">
            Filter
          </Button>
        </form>
      </div>

      {title && (
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="flex items-center gap-1">
            <Button asChild variant="outline" size="icon-sm">
              <Link href={qs({ date: prevDate })} aria-label="Previous">
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={qs({ date: today })}>Today</Link>
            </Button>
            <Button asChild variant="outline" size="icon-sm">
              <Link href={qs({ date: nextDate })} aria-label="Next">
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {view === "list" &&
        (appointments.length ? (
          <ul className="grid gap-2">
            {appointments.map((a) => (
              <AppointmentRow key={a.id} a={a} href={`/admin/appointments/${a.id}`} timeZone={tz} showCustomer />
            ))}
          </ul>
        ) : (
          <EmptyState icon={CalendarDays} title="No appointments match" description="Try changing the filters or time range." />
        ))}
      {(view === "day" || view === "week") && <TimeGrid days={days} appointments={appointments} timeZone={tz} today={today} />}
      {view === "month" && <MonthGrid month={date.slice(0, 7)} appointments={appointments} timeZone={tz} today={today} />}

      {view !== "list" && technicians.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Technician colors">
          {technicians.map((t) => (
            <li key={t.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: t.color }} aria-hidden /> {t.name}
            </li>
          ))}
          <li>Dashed = pending · faded = cancelled</li>
        </ul>
      )}
    </>
  );
}

function addMonths(ymd: string, delta: number) {
  const [y, m] = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

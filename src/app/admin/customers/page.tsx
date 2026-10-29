import Link from "next/link";
import { ChevronRight, Search, Users } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/time";
import { cn, formatCurrency, initials } from "@/lib/utils";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Customers" };

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string; sort?: string }> }) {
  const [sp] = await Promise.all([searchParams, requirePermission("customers:view", "/admin/customers")]);
  const settings = await getSettings();
  const q = sp.q?.trim();
  const guests = sp.tab === "guests";

  return (
    <>
      <PageHeader title="Customers" description="Search by name, email, phone or vehicle." />
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-fit rounded-full border border-white/10 p-1">
          {[
            ["", "Accounts"],
            ["guests", "Guest bookings"],
          ].map(([tab, label]) => (
            <Link
              key={tab}
              href={`/admin/customers${tab ? `?tab=${tab}` : ""}`}
              className={cn("rounded-full px-4 py-1.5 text-sm font-medium", (tab === "guests") === guests ? "bg-white text-black" : "text-foreground/70 hover:text-foreground")}
            >
              {label}
            </Link>
          ))}
        </div>
        <form action="/admin/customers" className="flex flex-wrap gap-2">
          {guests && <input type="hidden" name="tab" value="guests" />}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={q} placeholder="Search customers" className="h-10 w-64 pl-9" aria-label="Search customers" />
          </div>
          {!guests && (
            <NativeSelect name="sort" defaultValue={sp.sort ?? ""} className="h-10 w-44" aria-label="Sort">
              <option value="">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="active">Recently active</option>
            </NativeSelect>
          )}
          <Button type="submit" variant="subtle" className="h-10">
            Apply
          </Button>
        </form>
      </div>
      {guests ? <GuestList q={q} timeZone={settings.timezone} /> : <AccountList q={q} sort={sp.sort} timeZone={settings.timezone} />}
    </>
  );
}

async function AccountList({ q, sort, timeZone }: { q?: string; sort?: string; timeZone: string }) {
  const where: Prisma.UserWhereInput = { role: "CUSTOMER" };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { vehicles: { some: { OR: [{ make: { contains: q, mode: "insensitive" } }, { model: { contains: q, mode: "insensitive" } }] } } },
    ];
  }
  const customers = await prisma.user.findMany({
    where,
    orderBy: sort === "name" ? { name: "asc" } : sort === "active" ? { lastLoginAt: { sort: "desc", nulls: "last" } } : { createdAt: "desc" },
    take: 200,
    include: { _count: { select: { appointments: true, vehicles: true } }, payments: { where: { status: "SUCCEEDED" }, select: { amount: true } } },
  });
  if (!customers.length) return <EmptyState icon={Users} title="No customers found" />;
  return (
    <ul className="grid gap-2">
      {customers.map((c) => (
        <li key={c.id}>
          <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-card p-4 transition-colors hover:border-white/15">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{initials(c.name ?? c.email)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {c.name ?? "—"} {!c.isActive && <span className="ml-2 text-xs text-red-300">disabled</span>}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {c.email} {c.phone ? `· ${c.phone}` : ""}
              </p>
            </div>
            <div className="hidden text-right text-sm sm:block">
              <p>
                {c._count.appointments} bookings · {c._count.vehicles} vehicles
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(c.payments.reduce((s, p) => s + p.amount, 0))} spent · joined {formatDate(c.createdAt, timeZone)}
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function GuestList({ q, timeZone }: { q?: string; timeZone: string }) {
  const where: Prisma.AppointmentWhereInput = { userId: null };
  if (q) where.OR = [{ customerName: { contains: q, mode: "insensitive" } }, { customerEmail: { contains: q, mode: "insensitive" } }, { customerPhone: { contains: q } }];
  const groups = await prisma.appointment.groupBy({
    by: ["customerEmail"],
    where,
    _count: { _all: true },
    _sum: { amountPaid: true },
    _max: { startsAt: true },
    orderBy: { _max: { startsAt: "desc" } },
    take: 200,
  });
  if (!groups.length) return <EmptyState icon={Users} title="No guest bookings found" />;
  const latest = await prisma.appointment.findMany({
    where: { userId: null, customerEmail: { in: groups.map((g) => g.customerEmail) } },
    orderBy: { startsAt: "desc" },
    distinct: ["customerEmail"],
    select: { customerEmail: true, customerName: true, customerPhone: true },
  });
  return (
    <ul className="grid gap-2">
      {groups.map((g) => {
        const info = latest.find((l) => l.customerEmail === g.customerEmail);
        return (
          <li key={g.customerEmail}>
            <Link
              href={`/admin/appointments?q=${encodeURIComponent(g.customerEmail)}&when=all`}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-card p-4 transition-colors hover:border-white/15"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-sm font-semibold">{initials(info?.customerName)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{info?.customerName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {g.customerEmail} · {info?.customerPhone}
                </p>
              </div>
              <div className="hidden text-right text-sm sm:block">
                <p>{g._count._all} bookings</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(g._sum.amountPaid ?? 0)} paid · last {g._max.startsAt ? formatDate(g._max.startsAt, timeZone) : "—"}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

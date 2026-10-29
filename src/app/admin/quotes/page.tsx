import Link from "next/link";
import { ChevronRight, ClipboardList, Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge, statusOptions } from "@/components/ui/status";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { cn, formatCurrency } from "@/lib/utils";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Quotes" };

export default async function AdminQuotesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const [sp] = await Promise.all([searchParams, requirePermission("quotes:manage", "/admin/quotes")]);
  const settings = await getSettings();
  const where: Prisma.QuoteWhereInput = {};
  if (sp.status) where.status = sp.status as Prisma.QuoteWhereInput["status"];
  if (sp.q) {
    const q = sp.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { reference: { contains: q.toUpperCase() } },
    ];
  }
  const [quotes, counts] = await Promise.all([
    prisma.quote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { service: { select: { name: true } }, serviceOption: { select: { name: true } }, filmType: { select: { name: true } } },
    }),
    prisma.quote.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countFor = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader title="Quotes" description="Incoming quote requests from the website." />
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          <Link
            href="/admin/quotes"
            className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm", !sp.status ? "border-primary bg-primary text-primary-foreground" : "border-white/10 text-foreground/70 hover:text-foreground")}
          >
            All
          </Link>
          {statusOptions("quote").map((o) => (
            <Link
              key={o.value}
              href={`/admin/quotes?status=${o.value}`}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm",
                sp.status === o.value ? "border-primary bg-primary text-primary-foreground" : "border-white/10 text-foreground/70 hover:text-foreground",
              )}
            >
              {o.label} <span className="ml-1 text-xs opacity-70">{countFor(o.value)}</span>
            </Link>
          ))}
        </div>
        <form action="/admin/quotes" className="flex gap-2">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={sp.q} placeholder="Search quotes" className="h-10 w-60 pl-9" aria-label="Search quotes" />
          </div>
          <Button type="submit" variant="subtle" className="h-10">
            Search
          </Button>
        </form>
      </div>

      {quotes.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No quotes found" />
      ) : (
        <ul className="grid gap-2">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link href={`/admin/quotes/${q.id}`} className="group flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-card p-4 transition-colors hover:border-white/15">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{q.name}</p>
                    <StatusBadge kind="quote" status={q.status} />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {[q.service?.name, q.serviceOption?.name, q.filmType?.name].filter(Boolean).join(" · ")} · {[q.vehicleYear, q.vehicleMake, q.vehicleModel].filter(Boolean).join(" ")} · {q.reference}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="font-medium tabular-nums">{formatCurrency(q.quotedPrice ?? q.estimatedTotal, { exact: true })}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(q.createdAt, settings.timezone)}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

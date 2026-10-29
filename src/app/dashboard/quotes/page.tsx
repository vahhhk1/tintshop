import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/time";
import { formatCurrency } from "@/lib/utils";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Quotes" };

export default async function MyQuotesPage() {
  const user = await requireUser("/dashboard/quotes");
  const [settings, quotes] = await Promise.all([
    getSettings(),
    prisma.quote.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        service: { select: { name: true, slug: true, bookable: true } },
        serviceOption: { select: { name: true } },
        filmType: { select: { name: true } },
        vehicleType: { select: { name: true } },
        items: true,
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Quotes"
        description="Estimates you’ve requested and our responses."
        actions={
          <Button asChild>
            <Link href="/quote">New quote</Link>
          </Button>
        }
      />
      {quotes.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No quotes yet" description="Get an instant price for your vehicle in under a minute." action={<Button asChild><Link href="/quote">Get a quote</Link></Button>} />
      ) : (
        <ul className="grid gap-4">
          {quotes.map((q) => {
            const book = q.service?.bookable
              ? `/book?service=${q.service.slug}${q.serviceOptionId ? `&option=${q.serviceOptionId}` : ""}${q.filmTypeId ? `&film=${q.filmTypeId}` : ""}`
              : null;
            return (
              <li key={q.id} className="rounded-3xl border border-white/[0.08] bg-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{[q.service?.name, q.serviceOption?.name].filter(Boolean).join(" — ") || "Custom quote"}</p>
                      <StatusBadge kind="quote" status={q.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {q.reference} · {formatDate(q.createdAt, settings.timezone)} · {[q.vehicleYear, q.vehicleMake, q.vehicleModel].filter(Boolean).join(" ")}
                      {q.filmType ? ` · ${q.filmType.name}${q.shade ? ` ${q.shade}%` : ""}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{q.quotedPrice != null ? "Quoted price" : "Online estimate"}</p>
                    <p className="font-display text-2xl font-semibold">{formatCurrency(q.quotedPrice ?? q.estimatedTotal, { exact: true })}</p>
                  </div>
                </div>
                {q.responseMessage && (
                  <div className="mt-4 rounded-2xl border-l-2 border-primary/60 bg-white/[0.03] p-4 text-sm">
                    <p className="text-xs font-semibold text-foreground/70">Response from {settings.businessName}</p>
                    <p className="mt-1 whitespace-pre-line text-foreground/85">{q.responseMessage}</p>
                  </div>
                )}
                {book && !["DECLINED", "CONVERTED"].includes(q.status) && (
                  <Button asChild size="sm" className="mt-4">
                    <Link href={book}>Book this service</Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

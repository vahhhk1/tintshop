import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, Pencil, Plus, Sparkles } from "lucide-react";
import { ActionButton } from "@/components/admin/action-form";
import { PageHeader } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { setServiceActiveAction } from "@/server/admin/catalog";

export const metadata = { title: "Services" };

export default async function AdminServicesPage() {
  await requirePermission("services:manage", "/admin/services");
  const services = await prisma.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { parent: { select: { name: true } }, filmType: { select: { name: true } }, _count: { select: { options: true, faqs: true, appointments: true } } },
  });
  return (
    <>
      <PageHeader
        title="Services"
        description="What appears on the website, in the quote tool and in online booking."
        actions={
          <Button asChild>
            <Link href="/admin/services/new">
              <Plus aria-hidden /> New service
            </Link>
          </Button>
        }
      />
      {services.length === 0 ? (
        <EmptyState icon={Sparkles} title="No services yet" />
      ) : (
        <ul className="grid gap-2">
          {services.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/[0.07] bg-card p-4">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                {s.imageUrl && <Image src={s.imageUrl} alt="" fill sizes="56px" className="object-cover" unoptimized={s.imageUrl.startsWith("http")} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/services/${s.id}`} className="font-semibold hover:text-primary">
                    {s.name}
                  </Link>
                  {!s.active && <Badge variant="neutral">Hidden</Badge>}
                  {s.featured && <Badge>Featured</Badge>}
                  {!s.bookable && <Badge variant="info">Quote only</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  /{s.slug} · from {formatCurrency(s.startingPrice)} · {formatDuration(s.durationMinutes)}
                  {s.parent ? ` · variant of ${s.parent.name}` : ""}
                  {s.filmType ? ` · ${s.filmType.name} film` : ""} · {s._count.options} options · {s._count.faqs} FAQs · {s._count.appointments} bookings
                </p>
              </div>
              <div className="flex gap-1">
                <ActionButton size="sm" variant="ghost" action={setServiceActiveAction} args={[s.id, !s.active]}>
                  {s.active ? <EyeOff aria-hidden /> : <Eye aria-hidden />} {s.active ? "Hide" : "Show"}
                </ActionButton>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/services/${s.id}`}>
                    <Pencil aria-hidden /> Edit
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { ServiceForm, emptyService } from "@/components/admin/service-form";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: "New service" };

export default async function NewServicePage() {
  await requirePermission("services:manage", "/admin/services/new");
  const [films, parents] = await Promise.all([
    prisma.filmType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.service.findMany({ where: { parentId: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <Link href="/admin/services" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Services
      </Link>
      <PageHeader title="New service" description="After creating it you can add coverage options, add-ons and FAQs." />
      <ServiceForm values={emptyService} films={films} parents={parents} />
    </>
  );
}

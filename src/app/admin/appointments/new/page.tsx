import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { NewAppointmentForm, type NewAppointmentDefaults } from "@/components/admin/new-appointment-form";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { todayYmd } from "@/lib/time";
import { getFreshPricingCatalog } from "@/server/catalog";
import { getSettings } from "@/server/settings";

export const metadata = { title: "New appointment" };

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ quote?: string; customer?: string }> }) {
  const [sp] = await Promise.all([searchParams, requirePermission("appointments:manage", "/admin/appointments/new")]);
  const [catalog, settings, technicians, customers] = await Promise.all([
    getFreshPricingCatalog(),
    getSettings(),
    prisma.technician.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "CUSTOMER", isActive: true }, orderBy: { name: "asc" }, take: 500, select: { id: true, name: true, email: true, phone: true } }),
  ]);

  let defaults: NewAppointmentDefaults = {};
  if (sp.quote) {
    const q = await prisma.quote.findUnique({ where: { id: sp.quote } });
    if (q) {
      defaults = {
        quoteId: q.id,
        userId: q.userId,
        customerName: q.name,
        customerEmail: q.email,
        customerPhone: q.phone,
        vehicleYear: q.vehicleYear,
        vehicleMake: q.vehicleMake,
        vehicleModel: q.vehicleModel,
        job: { serviceId: q.serviceId, optionId: q.serviceOptionId, filmTypeId: q.filmTypeId, shade: q.shade, vehicleTypeId: q.vehicleTypeId, vehicleSizeId: q.vehicleSizeId },
        priceOverride: q.quotedPrice,
        notes: q.notes,
      };
    }
  } else if (sp.customer) {
    const c = customers.find((x) => x.id === sp.customer);
    if (c) defaults = { userId: c.id, customerName: c.name ?? "", customerEmail: c.email, customerPhone: c.phone ?? "" };
  }

  return (
    <>
      <Link href="/admin/appointments" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Appointments
      </Link>
      <PageHeader title={defaults.quoteId ? "Convert quote to appointment" : "New appointment"} description="Prices are calculated from your live pricing rules." />
      <NewAppointmentForm
        catalog={catalog}
        technicians={technicians}
        customers={customers}
        defaults={defaults}
        today={todayYmd(settings.timezone)}
        maxAdvanceDays={settings.maxAdvanceDays}
      />
    </>
  );
}

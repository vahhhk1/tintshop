import { PageHero } from "@/components/layout/page-hero";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { BookingWizardClientOnly } from "@/components/booking/booking-wizard-client";
import { EmptyState } from "@/components/ui/misc";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { getPaymentMode } from "@/lib/stripe";
import { todayYmd } from "@/lib/time";
import { getPricingCatalog, getTechniciansPublic } from "@/server/catalog";
import { getSettings } from "@/server/settings";

export const metadata = pageMetadata({
  title: "Book an Appointment",
  description: "Choose your service, see your exact price and pick from live available times. Reserve with a small deposit or pay at the shop.",
  path: "/book",
});

export default async function BookPage({ searchParams }: { searchParams: Promise<{ service?: string; option?: string; film?: string; from?: string }> }) {
  const [params, catalog, settings, technicians, user] = await Promise.all([
    searchParams,
    getPricingCatalog(),
    getSettings(),
    getTechniciansPublic(),
    getSessionUser().catch(() => null),
  ]);
  const service = params.service ? catalog.services.find((s) => s.slug === params.service && s.bookable) : undefined;
  const Wizard = params.from === "quote" ? BookingWizardClientOnly : BookingWizard;
  const savedVehicles = user
    ? await prisma.vehicle.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, year: true, make: true, model: true, color: true, vehicleTypeId: true, vehicleSizeId: true },
      })
    : [];

  return (
    <>
      <PageHero eyebrow="Online booking" title="Book your appointment." description="Live availability, instant pricing and confirmation in minutes." className="pb-10 sm:pb-12" />
      <div className="container-page py-10 pb-24">
        {catalog.services.some((s) => s.bookable) ? (
          <Wizard
            catalog={catalog}
            initial={{ serviceId: service?.id ?? null, optionId: params.option ?? null, filmId: params.film ?? null, fromQuote: params.from === "quote" }}
            settings={{
              taxRateBps: settings.taxRateBps,
              depositPercent: settings.depositPercent,
              depositMinimum: settings.depositMinimum,
              requireDeposit: settings.requireDeposit,
              allowPayInFull: settings.allowPayInFull,
              cancellationPolicy: settings.cancellationPolicy,
              maxAdvanceDays: settings.maxAdvanceDays,
              holdMinutes: settings.holdMinutes,
              today: todayYmd(settings.timezone),
            }}
            paymentMode={getPaymentMode()}
            technicians={technicians.map((t) => ({ id: t.id, name: t.name, title: t.title, serviceIds: t.services.map((s) => s.id) }))}
            user={user ? { name: user.name, email: user.email, phone: user.phone } : null}
            savedVehicles={savedVehicles}
          />
        ) : (
          <EmptyState title="Online booking is temporarily unavailable" description={`Please call us at ${settings.phone} to book.`} />
        )}
      </div>
    </>
  );
}

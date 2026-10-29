import Link from "next/link";
import { Calculator, CreditCard, Info, Percent } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { FinalCta, PackagesSection } from "@/components/home/sections";
import { PriceTable } from "@/components/services/price-table";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/misc";
import { calculatePrice } from "@/lib/pricing/engine";
import { pageMetadata } from "@/lib/seo";
import { formatCurrency } from "@/lib/utils";
import { getPackages, getPricingCatalog, getServices } from "@/server/catalog";
import { getStartingPrices, packageFromPrice, servicePriceTable } from "@/server/pricing-display";
import { getSettings } from "@/server/settings";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Pricing",
  description: "Transparent window tint pricing by vehicle type and film, plus paint protection film, ceramic coating and lighting prices. Get an exact quote online.",
  path: "/pricing",
});

export default async function PricingPage() {
  const [catalog, packages, services, prices, settings] = await Promise.all([getPricingCatalog(), getPackages(), getServices(), getStartingPrices(), getSettings()]);
  const packageViews = packages.map((p) => ({ ...p, fromPrice: packageFromPrice(catalog, p) }));

  // Full tint price by vehicle type × film (from the first package's service/option).
  const tintService = catalog.services.find((s) => s.slug === "window-tint") ?? catalog.services.find((s) => s.usesFilm);
  const fullOption = tintService ? catalog.options.find((o) => o.serviceId === tintService.id && o.kind === "COVERAGE") : undefined;
  const filmMatrix =
    tintService && catalog.films.length
      ? catalog.films.map((film) => ({
          id: film.id,
          name: `${film.name} film`,
          description: film.tagline,
          prices: catalog.vehicleTypes.map((vt) => {
            const r = calculatePrice(catalog, { serviceId: tintService.id, optionId: fullOption?.id, filmTypeId: film.id, vehicleTypeId: vt.id });
            return r.ok ? r.subtotal : null;
          }),
        }))
      : [];
  const tintTable = tintService ? servicePriceTable(catalog, tintService.id) : null;
  const others = services.filter((s) => !s.slug.includes("window-tint"));

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Transparent pricing. No surprises."
        description="Prices depend on your vehicle, the film and how many windows you tint. These are our standard starting prices — the online quote tool gives you an exact number in under a minute."
        crumbs={[{ name: "Pricing", path: "/pricing" }]}
      >
        <Button asChild size="lg">
          <Link href="/quote">
            <Calculator aria-hidden /> Get my exact price
          </Link>
        </Button>
      </PageHero>

      <section className="container-page py-20" aria-label="Packages">
        <PackagesSection packages={packageViews} />
      </section>

      {filmMatrix.length > 0 && (
        <section className="container-page py-12" aria-labelledby="full-tint">
          <SectionHeading eyebrow="Window tint" title={<span id="full-tint">{fullOption?.name ?? "Full tint"} by vehicle</span>} description={fullOption?.description ?? undefined} />
          <div className="mt-10">
            <PriceTable vehicleTypes={catalog.vehicleTypes.map((v) => v.name)} rows={filmMatrix} addOns={[]} />
          </div>
        </section>
      )}

      {tintTable && (
        <section className="container-page py-12" aria-labelledby="coverage">
          <SectionHeading title={<span id="coverage">Other window tint options</span>} description="Partial tints, windshields and full-vehicle packages." />
          <div className="mt-10">
            <PriceTable vehicleTypes={tintTable.vehicleTypes} rows={tintTable.rows} addOns={tintTable.addOns} filmNote />
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="container-page py-12" aria-labelledby="more-services">
          <SectionHeading title={<span id="more-services">Protection, coating &amp; lighting</span>} />
          <ul className="mt-10 grid gap-3 md:grid-cols-2">
            {others.map((s) => (
              <li key={s.id}>
                <Link href={`/services/${s.slug}`} className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-card px-5 py-4 transition-colors hover:border-primary/40">
                  <span>
                    <span className="block font-medium">{s.name}</span>
                    <span className="block text-sm text-muted-foreground">{s.durationLabel}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-xs text-muted-foreground">from</span>
                    <span className="font-display text-xl font-semibold">{formatCurrency(prices.get(s.id) ?? s.startingPrice)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="container-page py-12" aria-label="Payment information">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <CreditCard className="size-5 text-primary" aria-hidden />
            <h3 className="mt-4 font-semibold">Small deposit to book</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Reserve your time with a {settings.depositPercent}% deposit (minimum {formatCurrency(settings.depositMinimum)}), or pay in full online. The balance is due at pickup.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <Percent className="size-5 text-primary" aria-hidden />
            <h3 className="mt-4 font-semibold">Promo codes</h3>
            <p className="mt-2 text-sm text-muted-foreground">Have a code? Apply it at checkout — discounts are validated instantly.</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <Info className="size-5 text-primary" aria-hidden />
            <h3 className="mt-4 font-semibold">Cancellation policy</h3>
            <p className="mt-2 text-sm text-muted-foreground">{settings.cancellationPolicy}</p>
          </div>
        </div>
        {settings.taxRateBps > 0 && <p className="mt-6 text-xs text-muted-foreground">Prices exclude sales tax ({(settings.taxRateBps / 100).toFixed(2)}%), which is added at checkout.</p>}
      </section>

      <FinalCta phone={settings.phone} />
    </>
  );
}

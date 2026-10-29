import { PageHero } from "@/components/layout/page-hero";
import { QuoteWizard } from "@/components/quote/quote-wizard";
import { EmptyState } from "@/components/ui/misc";
import { getSessionUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { getPaymentMode } from "@/lib/stripe";
import { getPricingCatalog } from "@/server/catalog";
import { getSettings } from "@/server/settings";

export const metadata = pageMetadata({
  title: "Free Instant Quote",
  description: "Get an instant window tint price for your exact vehicle, film and tint percentage — then book online or send us your quote request.",
  path: "/quote",
});

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ service?: string; option?: string; film?: string }> }) {
  const [params, catalog, settings, user] = await Promise.all([searchParams, getPricingCatalog(), getSettings(), getSessionUser().catch(() => null)]);
  const defaultService = catalog.services.find((s) => s.slug === (params.service ?? "window-tint")) ?? catalog.services.find((s) => s.slug === "window-tint") ?? catalog.services[0];

  return (
    <>
      <PageHero
        eyebrow="Free quote"
        title="Your exact price in under a minute."
        description="Tell us about your vehicle and what you’d like done. Prices come straight from our live price list — no surprises."
        className="pb-10 sm:pb-12"
      />
      <div className="container-page py-10 pb-24">
        {catalog.services.length && catalog.vehicleTypes.length ? (
          <QuoteWizard
            catalog={catalog}
            initialServiceId={defaultService?.id ?? null}
            initialOptionId={params.option}
            initialFilmId={params.film}
            user={user ? { name: user.name, email: user.email, phone: user.phone } : null}
            depositPercent={settings.depositPercent}
            canPayOnline={getPaymentMode() !== "offline"}
          />
        ) : (
          <EmptyState title="Online quotes are temporarily unavailable" description={`Please call us at ${settings.phone} for a quote.`} />
        )}
      </div>
    </>
  );
}

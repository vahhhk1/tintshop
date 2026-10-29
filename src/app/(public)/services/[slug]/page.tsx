import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarCheck, Check, Clock, ShieldCheck, Sparkles, ThermometerSun } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { PriceTable } from "@/components/services/price-table";
import { ServiceCard } from "@/components/home/service-card";
import { FinalCta } from "@/components/home/sections";
import { FaqAccordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JsonLd, faqSchema, serviceSchema } from "@/components/seo/json-ld";
import { filmsFor } from "@/lib/pricing/engine";
import { pageMetadata } from "@/lib/seo";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { getFilmTypes, getPricingCatalog, getServiceBySlug, getServices } from "@/server/catalog";
import { getStartingPrices, servicePriceTable } from "@/server/pricing-display";
import { getSettings } from "@/server/settings";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const services = await getServices();
    return services.map((s) => ({ slug: s.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) return { title: "Service not found" };
  return pageMetadata({
    title: service.seoTitle ?? service.name,
    description: service.seoDescription ?? service.shortDescription,
    path: `/services/${service.slug}`,
    image: service.imageUrl ?? undefined,
  });
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [service, catalog, filmTypes, settings, prices, services] = await Promise.all([
    getServiceBySlug(slug),
    getPricingCatalog(),
    getFilmTypes(),
    getSettings(),
    getStartingPrices(),
    getServices(),
  ]);
  if (!service) notFound();

  const table = servicePriceTable(catalog, service.id);
  const filmIds = new Set(filmsFor(catalog, service.id).map((f) => f.id));
  const films = filmTypes.filter((f) => filmIds.has(f.id));
  const fromPrice = prices.get(service.id) ?? service.startingPrice;
  const related = services.filter((s) => s.id !== service.id && (s.category === service.category || s.featured)).slice(0, 3);
  const bookHref = `/book?service=${service.slug}`;

  return (
    <>
      <PageHero
        eyebrow={service.tagline ?? "Service"}
        title={service.name}
        description={service.shortDescription}
        image={service.imageUrl ?? undefined}
        crumbs={[
          { name: "Services", path: "/services" },
          { name: service.name, path: `/services/${service.slug}` },
        ]}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          {service.bookable ? (
            <Button asChild size="lg">
              <Link href={bookHref}>
                <CalendarCheck aria-hidden /> Book Now
              </Link>
            </Button>
          ) : null}
          <Button asChild size="lg" variant={service.bookable ? "outline" : "default"}>
            <Link href={`/quote?service=${service.slug}`}>Get a Free Quote</Link>
          </Button>
        </div>
      </PageHero>

      <div className="container-page grid gap-16 py-16 lg:grid-cols-[1.6fr_1fr] lg:py-20">
        <div className="grid gap-16">
          <section aria-labelledby="overview">
            <h2 id="overview" className="text-2xl font-semibold sm:text-3xl">
              Overview
            </h2>
            <div className="mt-5 grid gap-4 text-[17px] leading-relaxed text-foreground/80">
              {service.description.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            {service.imageUrl && (
              <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-3xl border border-white/[0.07]">
                <Image src={service.imageUrl} alt={`${service.name} example`} fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
              </div>
            )}
          </section>

          {service.benefits.length > 0 && (
            <section aria-labelledby="benefits">
              <h2 id="benefits" className="text-2xl font-semibold sm:text-3xl">
                Benefits
              </h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {service.benefits.map((b) => (
                  <li key={b} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-card p-4 text-[15px]">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                      <Check className="size-4" aria-hidden />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {films.length > 0 && (
            <section aria-labelledby="films">
              <h2 id="films" className="text-2xl font-semibold sm:text-3xl">
                {films.length === 1 ? "Film" : "Available film types"}
              </h2>
              <ul className="mt-6 grid gap-4 md:grid-cols-3">
                {films.map((f) => (
                  <li key={f.id} className="flex flex-col rounded-2xl border border-white/[0.07] bg-card p-5">
                    <p className="font-semibold">{f.name}</p>
                    {f.tagline && <p className="mt-1 text-xs text-muted-foreground">{f.tagline}</p>}
                    <dl className="mt-4 grid gap-2 text-sm">
                      {f.heatRejection != null && (
                        <div className="flex items-center justify-between">
                          <dt className="flex items-center gap-1.5 text-muted-foreground">
                            <ThermometerSun className="size-3.5" aria-hidden /> IR heat rejection
                          </dt>
                          <dd className="font-medium">up to {f.heatRejection}%</dd>
                        </div>
                      )}
                      {f.uvRejection != null && (
                        <div className="flex items-center justify-between">
                          <dt className="text-muted-foreground">UV blocked</dt>
                          <dd className="font-medium">{f.uvRejection}%</dd>
                        </div>
                      )}
                      {f.warrantyYears != null && (
                        <div className="flex items-center justify-between">
                          <dt className="text-muted-foreground">Warranty</dt>
                          <dd className="font-medium">{f.warrantyYears >= 50 ? "Lifetime" : `${f.warrantyYears} years`}</dd>
                        </div>
                      )}
                    </dl>
                    {f.shades.length > 0 && <p className="mt-4 text-xs text-muted-foreground">Shades: {f.shades.map((s) => `${s}%`).join(" · ")}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="pricing">
            <h2 id="pricing" className="text-2xl font-semibold sm:text-3xl">
              Pricing
            </h2>
            <div className="mt-6">
              <PriceTable vehicleTypes={table.vehicleTypes} rows={table.rows} addOns={table.addOns} filmNote={table.filmCount > 1} />
            </div>
          </section>

          {service.faqs.length > 0 && (
            <section aria-labelledby="service-faq">
              <h2 id="service-faq" className="text-2xl font-semibold sm:text-3xl">
                {service.name} FAQ
              </h2>
              <FaqAccordion className="mt-6" items={service.faqs} />
              <JsonLd data={faqSchema(service.faqs)} />
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl border border-white/[0.08] bg-card p-6 sm:p-7">
            <p className="text-sm text-muted-foreground">Starting at</p>
            <p className="mt-1 font-display text-4xl font-semibold">{formatCurrency(fromPrice)}</p>
            <dl className="mt-6 grid gap-4 border-t border-white/[0.07] pt-6 text-sm">
              <div className="flex gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <dt className="font-medium">Estimated installation time</dt>
                  <dd className="text-muted-foreground">{service.durationLabel ?? formatDuration(service.durationMinutes)}</dd>
                </div>
              </div>
              {service.warranty && (
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <dt className="font-medium">Warranty</dt>
                    <dd className="text-muted-foreground">{service.warranty}</dd>
                  </div>
                </div>
              )}
              {service.features.length > 0 && (
                <div className="flex gap-3">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <dt className="font-medium">What’s included</dt>
                    <dd>
                      <ul className="mt-1 grid gap-1 text-muted-foreground">
                        {service.features.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                </div>
              )}
            </dl>
            <div className="mt-7 grid gap-2">
              {service.bookable && (
                <Button asChild size="lg">
                  <Link href={bookHref}>
                    <CalendarCheck aria-hidden /> Book Now
                  </Link>
                </Button>
              )}
              <Button asChild size="lg" variant="outline">
                <Link href={`/quote?service=${service.slug}`}>Get exact price</Link>
              </Button>
            </div>
          </div>
          {service.parent && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Part of our{" "}
              <Link href={`/services/${service.parent.slug}`} className="text-foreground underline-offset-4 hover:underline">
                {service.parent.name}
              </Link>{" "}
              service. <Badge variant="neutral">{films[0]?.name} film</Badge>
            </p>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="container-page py-12" aria-labelledby="related">
          <h2 id="related" className="text-2xl font-semibold">
            You might also like
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((s) => (
              <li key={s.id}>
                <ServiceCard service={s} fromPrice={prices.get(s.id) ?? s.startingPrice} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <JsonLd
        data={serviceSchema({
          name: service.name,
          description: service.shortDescription,
          slug: service.slug,
          image: service.imageUrl,
          lowPrice: fromPrice,
          currency: settings.currency,
          businessName: settings.businessName,
        })}
      />
      <FinalCta phone={settings.phone} />
    </>
  );
}

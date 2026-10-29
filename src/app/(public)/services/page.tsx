import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarCheck, Check, Clock, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState } from "@/components/ui/misc";
import { FinalCta } from "@/components/home/sections";
import { pageMetadata } from "@/lib/seo";
import { cn, formatCurrency } from "@/lib/utils";
import { getServices } from "@/server/catalog";
import { getStartingPrices } from "@/server/pricing-display";
import { getSettings } from "@/server/settings";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Services",
  description: "Window tint (ceramic, carbon, dyed), windshield tint, sun strips, paint protection film, ceramic coating and headlight/taillight tint.",
  path: "/services",
});

const CATEGORY_LABEL: Record<string, string> = {
  WINDOW_TINT: "Window film",
  PAINT_PROTECTION: "Paint protection",
  COATING: "Coating",
  LIGHTING: "Lighting",
};

export default async function ServicesPage() {
  const [services, prices, settings] = await Promise.all([getServices(), getStartingPrices(), getSettings()]);
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Every service, done to a higher standard."
        description="Premium films and coatings, computer-cut patterns, dust-controlled installation and a written warranty — whatever you drive."
        image="/images/demo/about-detailing.jpg"
        crumbs={[{ name: "Services", path: "/services" }]}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/book">
              <CalendarCheck aria-hidden /> Book Now
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/quote">Get a Free Quote</Link>
          </Button>
        </div>
      </PageHero>

      <div className="container-page grid gap-6 py-20">
        {services.length === 0 && <EmptyState title="No services are listed right now" description="Please call us for availability." />}
        {services.map((s, i) => (
          <Reveal key={s.id}>
            <article className="group grid overflow-hidden rounded-3xl border border-white/[0.07] bg-card md:grid-cols-2">
              <div className={cn("relative aspect-[16/10] overflow-hidden md:aspect-auto md:min-h-[360px]", i % 2 === 1 && "md:order-2")}>
                {s.imageUrl && (
                  <Image src={s.imageUrl} alt={`${s.name}`} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                )}
              </div>
              <div className="flex flex-col justify-center p-7 sm:p-10">
                <Badge variant="neutral">{CATEGORY_LABEL[s.category] ?? s.category}</Badge>
                <h2 className="mt-4 text-3xl font-semibold">{s.name}</h2>
                {s.tagline && <p className="mt-2 text-primary">{s.tagline}</p>}
                <p className="mt-4 leading-relaxed text-muted-foreground">{s.shortDescription}</p>
                <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Starting at</dt>
                    <dd className="mt-1 font-display text-2xl font-semibold">{formatCurrency(prices.get(s.id) ?? s.startingPrice)}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="size-3.5" aria-hidden /> Typical time
                    </dt>
                    <dd className="mt-1 text-base font-medium">{s.durationLabel ?? `${Math.round(s.durationMinutes / 60)} hrs`}</dd>
                  </div>
                </dl>
                <ul className="mt-6 grid gap-2 text-sm text-foreground/80">
                  <li className="flex gap-2">
                    <ShieldCheck className="size-4 text-primary" aria-hidden /> Written warranty included
                  </li>
                  <li className="flex gap-2">
                    <Check className="size-4 text-primary" aria-hidden /> Computer-cut, dust-free installation
                  </li>
                </ul>
                <div className="mt-8 flex flex-wrap gap-3">
                  {s.bookable ? (
                    <Button asChild>
                      <Link href={`/book?service=${s.slug}`}>Book Now</Link>
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link href={`/quote?service=${s.slug}`}>Request a quote</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline">
                    <Link href={`/services/${s.slug}`}>
                      Details, pricing &amp; FAQ <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
      <FinalCta phone={settings.phone} />
    </>
  );
}

import Link from "next/link";
import { ArrowRight, Award, CalendarCheck, MessageSquareQuote, Phone, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { ServiceCard } from "@/components/home/service-card";
import { BeforeAfterSlider } from "@/components/home/before-after";
import { CountUp } from "@/components/home/count-up";
import { TintComparison } from "@/components/home/tint-comparison";
import { GalleryPreview, PackagesSection, ReviewCard, WhyChooseUs } from "@/components/home/sections";
import { ScrollVideoStage } from "@/components/scroll-video/scroll-video-stage";
import { StoryBand, StoryCaption, StoryChapter, StoryStep } from "@/components/scroll-video/story-chapter";
import { CHAPTERS } from "@/components/scroll-video/story";
import { FaqAccordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState, SectionHeading, Stars } from "@/components/ui/misc";
import { JsonLd, faqSchema } from "@/components/seo/json-ld";
import { telHref } from "@/lib/utils";
import { getApprovedReviews, getGallery, getGeneralFaqs, getPackages, getPricingCatalog, getServices } from "@/server/catalog";
import { getStartingPrices, packageFromPrice } from "@/server/pricing-display";
import { getSettings } from "@/server/settings";

export const revalidate = 3600;

const TRUST = [
  { icon: Wrench, label: "Professional Installation" },
  { icon: Sparkles, label: "Premium Film" },
  { icon: ShieldCheck, label: "Warranty Available" },
  { icon: Award, label: "Experienced Technicians" },
];

const TOTAL_CHAPTERS = 6;

export default async function HomePage() {
  const [settings, services, prices, packages, catalog, gallery, reviews, faqs] = await Promise.all([
    getSettings(),
    getServices(),
    getStartingPrices(),
    getPackages(),
    getPricingCatalog(),
    getGallery(),
    getApprovedReviews(),
    getGeneralFaqs(),
  ]);

  const featuredServices = services.filter((s) => s.featured).slice(0, 9);
  const shownServices = featuredServices.length ? featuredServices : services.slice(0, 9);
  const beforeAfter = gallery.find((g) => g.beforeImageUrl);
  const featuredGallery = [...gallery.filter((g) => g.featured && !g.beforeImageUrl), ...gallery.filter((g) => !g.featured && !g.beforeImageUrl)];
  const packageViews = packages.map((p) => ({ ...p, fromPrice: packageFromPrice(catalog, p) }));
  const topReviews = reviews.reviews.slice(0, 6);
  const headline = settings.heroHeadline ?? "Premium Window Tint. Built for Your Drive.";
  const [lead, ...tail] = headline.split(/(?<=\.)\s+/);

  return (
    <>
      <ScrollVideoStage />

      {/* 01 — Intro & windscreen */}
      <StoryChapter chapter={CHAPTERS.hero} label="Windscreen" index={1} total={TOTAL_CHAPTERS}>
        <StoryStep from={0} to={0.42}>
          <div className="max-w-2xl">
            <p className="eyebrow">Automotive window film studio</p>
            <h1 className="mt-5 text-[2.6rem] leading-[0.98] font-semibold sm:text-6xl lg:text-7xl">
              <span className="text-gradient">{lead}</span>
              {tail.length > 0 && (
                <>
                  <br />
                  <span className="text-primary">{tail.join(" ")}</span>
                </>
              )}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-foreground/80 sm:text-lg">
              {settings.heroSubheadline ?? "Professional automotive window tinting with premium films, expert installation, and a finish that lasts."}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl">
                <Link href="/book">
                  <CalendarCheck aria-hidden /> Book an Appointment
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="bg-black/40 hover:bg-black/55">
                <Link href="/quote">Get a Free Quote</Link>
              </Button>
            </div>
            <ul className="mt-9 hidden max-w-xl grid-cols-2 gap-x-6 gap-y-3 text-sm text-foreground/85 sm:grid">
              {TRUST.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-full border border-white/10 bg-black/50">
                    <Icon className="size-4 text-primary" aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <dl className="mt-9 hidden max-w-xl grid-cols-3 gap-6 border-t border-white/10 pt-6 lg:grid">
              {settings.vehiclesCompleted ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Vehicles tinted</dt>
                  <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">
                    <CountUp to={settings.vehiclesCompleted} suffix="+" />
                  </dd>
                </div>
              ) : null}
              {settings.yearsInBusiness ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Years in business</dt>
                  <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">
                    <CountUp to={settings.yearsInBusiness} />
                  </dd>
                </div>
              ) : null}
              {reviews.average ? (
                <div>
                  <dt className="text-xs text-muted-foreground">{reviews.count} reviews</dt>
                  <dd className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold tabular-nums">
                    {reviews.average.toFixed(1)} <Stars rating={reviews.average} />
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
          <a
            href="#story-glass"
            className="absolute right-0 -bottom-16 hidden flex-col items-center gap-2 text-[11px] tracking-[0.25em] text-foreground/60 uppercase md:flex"
            aria-label="Scroll to explore"
          >
            <span className="relative flex h-9 w-5 justify-center rounded-full border border-white/30 pt-1.5">
              <span className="size-1 rounded-full bg-primary animate-scroll-dot" />
            </span>
            Scroll
          </a>
        </StoryStep>
        <StoryStep from={0.55} to={1}>
          <StoryCaption
            eyebrow="01 — Windscreen"
            title="Heat stops at the glass."
            body="A virtually clear ceramic windscreen film rejects infrared heat and UV without darkening your view of the road."
          >
            <Button asChild variant="outline" className="bg-black/40 hover:bg-black/55">
              <Link href="/services/windshield-tint">
                Windshield tint <ArrowRight aria-hidden />
              </Link>
            </Button>
          </StoryCaption>
        </StoryStep>
      </StoryChapter>

      {/* 02 — Side & rear glass */}
      <StoryChapter chapter={CHAPTERS.glass} label="Window film" index={2} total={TOTAL_CHAPTERS}>
        <StoryStep from={0} to={0.3}>
          <StoryCaption
            eyebrow="02 — Side windows"
            title="Privacy, without the blackout."
            body="Computer-cut patterns, micro-edged to the glass. Choose any legal shade from 5% limo to 70% clear."
          />
        </StoryStep>
        <StoryStep from={0.38} to={0.78}>
          <StoryCaption
            eyebrow="02 — Rear glass"
            title="Edge to edge. Bubble free."
            body="Rear windscreens are heat-shrunk to the curve of the glass in a dust-controlled bay, so the finish looks factory."
          />
        </StoryStep>
        <StoryStep from={0.86} to={1}>
          <StoryCaption
            eyebrow="02 — Heat rejection"
            title="Cooler cabin. Every drive."
            body="Ceramic film rejects the infrared heat you feel through the glass and blocks 99% of UV rays."
          >
            <Button asChild>
              <Link href="/window-tint">Compare films</Link>
            </Button>
            <Button asChild variant="outline" className="bg-black/40 hover:bg-black/55">
              <Link href="/quote">Price my vehicle</Link>
            </Button>
          </StoryCaption>
        </StoryStep>
      </StoryChapter>

      <StoryBand>
        <section id="services" className="container-page scroll-mt-20 py-24 sm:py-32" aria-labelledby="services-heading">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading
              eyebrow="Services"
              title={<span id="services-heading">Film, protection &amp; finish</span>}
              description="From classic dyed tint to nano-ceramic, paint protection film and coatings — installed by specialists."
            />
            <Button asChild variant="outline" className="shrink-0">
              <Link href="/services">
                All services <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          {shownServices.length ? (
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {shownServices.map((s, i) => (
                <Reveal as="li" key={s.id} delay={(i % 3) * 80}>
                  <ServiceCard service={s} fromPrice={prices.get(s.id) ?? s.startingPrice} />
                </Reveal>
              ))}
            </ul>
          ) : (
            <EmptyState className="mt-12" title="Services are being updated" description="Call us for pricing and availability." />
          )}
        </section>
      </StoryBand>

      {/* 03 — Paint, wheels & lights */}
      <StoryChapter chapter={CHAPTERS.protect} label="Protection" index={3} total={TOTAL_CHAPTERS}>
        <StoryStep from={0} to={0.38}>
          <StoryCaption
            eyebrow="03 — Body coating"
            title="Gloss that guards."
            body="A hard, hydrophobic ceramic layer over freshly corrected paint — water sheets off and dirt struggles to stick."
          >
            <Button asChild variant="outline" className="bg-black/40 hover:bg-black/55">
              <Link href="/services/ceramic-coating">
                Ceramic coating <ArrowRight aria-hidden />
              </Link>
            </Button>
          </StoryCaption>
        </StoryStep>
        <StoryStep from={0.46} to={0.67}>
          <StoryCaption eyebrow="03 — Wheels & calipers" title="Brake dust, meet its match." body="Coated rims shrug off brake dust and road grime, so a rinse is all they need." />
        </StoryStep>
        <StoryStep from={0.75} to={1}>
          <StoryCaption
            eyebrow="03 — Headlights"
            title="Sharp lines that stay clear."
            body="Protective film and smoked finishes keep lenses free of chips and yellowing — and looking deliberate."
          >
            <Button asChild variant="outline" className="bg-black/40 hover:bg-black/55">
              <Link href="/services/paint-protection-film">
                Paint protection film <ArrowRight aria-hidden />
              </Link>
            </Button>
          </StoryCaption>
        </StoryStep>
      </StoryChapter>

      <StoryBand>
        <WhyChooseUs />
        <section className="border-y border-white/[0.06] bg-black/30 py-24 sm:py-32" aria-labelledby="ba-heading">
          <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:items-center">
            <Reveal>
              <p className="eyebrow mb-4">Before / after</p>
              <h2 id="ba-heading" className="text-3xl leading-[1.05] font-semibold sm:text-4xl lg:text-5xl">
                See the difference for yourself.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                {beforeAfter?.caption ?? "Drag the slider to compare untreated glass with professionally installed ceramic film — less glare, less heat, more privacy."}
              </p>
              <Button asChild className="mt-8">
                <Link href="/gallery">See more transformations</Link>
              </Button>
            </Reveal>
            <Reveal delay={120}>
              <BeforeAfterSlider
                before={beforeAfter?.beforeImageUrl ?? "/images/demo/ba-interior-before.jpg"}
                after={beforeAfter?.imageUrl ?? "/images/demo/ba-interior-after.jpg"}
                alt={beforeAfter?.alt ?? "Vehicle interior"}
              />
            </Reveal>
          </div>
        </section>
      </StoryBand>

      {/* 04 — Interior */}
      <StoryChapter chapter={CHAPTERS.interior} label="Interior" index={4} total={TOTAL_CHAPTERS}>
        <StoryStep from={0.04} to={0.6}>
          <StoryCaption
            eyebrow="04 — Interior coating"
            title="Protection you can touch."
            body="Leather, trim and dash surfaces sealed against UV fade, spills and everyday wear."
          />
        </StoryStep>
        <StoryStep from={0.69} to={1}>
          <StoryCaption
            eyebrow="04 — Shaded cabin"
            title="Your seats will thank you."
            body="Tint and coating together keep the sun off the leather — less heat, less fading, years of looking new."
          />
        </StoryStep>
      </StoryChapter>

      <StoryBand>
        <section className="container-page py-24 sm:py-32" aria-labelledby="tint-heading">
          <SectionHeading
            eyebrow="Tint comparison"
            title={<span id="tint-heading">Find your shade</span>}
            description="The percentage is visible light transmission (VLT) — the lower the number, the darker the tint. Tap a shade to preview it."
          />
          <div className="mt-12">
            <TintComparison />
          </div>
        </section>
        <section className="relative py-24 sm:py-32" aria-label="Packages">
          <div className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto h-96 max-w-4xl rounded-full bg-primary/[0.07] blur-3xl" aria-hidden />
          <div className="relative container-page">
            <PackagesSection packages={packageViews} />
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Prices shown are starting prices for coupes and sedans.{" "}
              <Link href="/pricing" className="text-foreground underline-offset-4 hover:underline">
                Compare all prices
              </Link>
            </p>
          </div>
        </section>
      </StoryBand>

      {/* 05 — Tint & coating */}
      <StoryChapter chapter={CHAPTERS.finale} label="Tint & coating" index={5} total={TOTAL_CHAPTERS}>
        <StoryStep from={0.08} to={1}>
          <StoryCaption
            eyebrow="05 — All-round protection"
            title="Tint & coating. One visit."
            body="Glass, paint, wheels, lights and interior — protected together, backed by a written warranty."
          >
            <Button asChild>
              <Link href="/book">
                <CalendarCheck aria-hidden /> Book now
              </Link>
            </Button>
            <Button asChild variant="outline" className="bg-black/40 hover:bg-black/55">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </StoryCaption>
        </StoryStep>
      </StoryChapter>

      <StoryBand>
        <GalleryPreview items={featuredGallery} />

        <section className="border-y border-white/[0.06] bg-black/30 py-24 sm:py-32" aria-labelledby="reviews-heading">
          <div className="container-page">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <SectionHeading
                eyebrow="Reviews"
                title={<span id="reviews-heading">Drivers love the result</span>}
                description={
                  reviews.average ? (
                    <span className="flex flex-wrap items-center gap-3">
                      <Stars rating={reviews.average} size="md" />
                      <span>
                        <strong className="text-foreground">{reviews.average.toFixed(1)}</strong> average from {reviews.count} verified reviews
                      </span>
                    </span>
                  ) : undefined
                }
              />
              <div className="flex shrink-0 gap-2">
                <Button asChild variant="outline">
                  <Link href="/reviews#write">Leave a Review</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/reviews">
                    Read all <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
            {topReviews.length ? (
              <ul className="scrollbar-none -mx-4 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
                {topReviews.map((r) => (
                  <li key={r.id} className="w-[85%] shrink-0 snap-start md:w-auto">
                    <ReviewCard review={r} timeZone={settings.timezone} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState className="mt-12" icon={MessageSquareQuote} title="No reviews yet" description="Be the first to share your experience." />
            )}
          </div>
        </section>

        <section className="container-page py-24 sm:py-32" aria-labelledby="faq-heading">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <SectionHeading eyebrow="FAQ" title={<span id="faq-heading">Questions, answered</span>} description="Everything you need to know before your appointment." />
              <Button asChild variant="outline" className="mt-8">
                <Link href="/faq">View all FAQs</Link>
              </Button>
            </div>
            {faqs.length ? <FaqAccordion items={faqs.slice(0, 7)} /> : <EmptyState title="FAQs coming soon" />}
          </div>
          {faqs.length > 0 && <JsonLd data={faqSchema(faqs)} />}
        </section>
      </StoryBand>

      {/* 06 — Final call to action over the closing shot */}
      <StoryChapter chapter={CHAPTERS.outro} label="Your car next" index={6} total={TOTAL_CHAPTERS}>
        <StoryStep from={0.12} to={1}>
          <div className="max-w-2xl">
            <p className="eyebrow">Book in under 2 minutes</p>
            <h2 className="mt-5 text-4xl leading-[1.02] font-semibold sm:text-6xl">Ready to Upgrade Your Ride?</h2>
            <p className="mt-5 max-w-xl text-lg text-foreground/80">See your exact price, pick a time that works and lock it in with a small deposit.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl">
                <Link href="/book">
                  <CalendarCheck aria-hidden /> Book Appointment
                </Link>
              </Button>
              <Button asChild size="xl" variant="secondary">
                <Link href="/quote">Get Free Quote</Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="bg-black/40 hover:bg-black/55">
                <a href={telHref(settings.phone)}>
                  <Phone aria-hidden /> Call Now
                </a>
              </Button>
            </div>
          </div>
        </StoryStep>
      </StoryChapter>
    </>
  );
}

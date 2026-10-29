import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, CalendarCheck, Check, Eye, Gem, Phone, ShieldCheck, Sparkles, Sun, ThermometerSun, Timer, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading, Stars } from "@/components/ui/misc";
import { cn, formatCurrency, telHref } from "@/lib/utils";
import type { GalleryItem, PackageCard, PublicReview } from "@/server/catalog";

const WHY = [
  { icon: Gem, title: "Premium Materials", body: "Only top-tier dyed, carbon and nano-ceramic films from proven manufacturers." },
  { icon: Wrench, title: "Professional Installation", body: "Computer-cut patterns, dust-controlled bays and certified installers." },
  { icon: ThermometerSun, title: "Heat Rejection", body: "Ceramic film rejects up to 88% of infrared heat for a cooler cabin." },
  { icon: Sun, title: "UV Protection", body: "Every film blocks 99% of UV rays — protecting your skin and interior." },
  { icon: Eye, title: "Privacy", body: "Choose your shade from 5% limo to 70% clear for the privacy you want." },
  { icon: Sparkles, title: "Clean Finish", body: "Micro-edged, bubble-free, edge-to-edge coverage that looks factory." },
  { icon: ShieldCheck, title: "Warranty", body: "Written lifetime warranty on carbon and ceramic film installations." },
  { icon: Timer, title: "Fast Service", body: "Most full tints done in 2–3 hours. Wait in our lounge or drop off." },
];

export function WhyChooseUs() {
  return (
    <section className="container-page py-24 sm:py-32" aria-labelledby="why-heading">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow mb-4">Why choose us</p>
            <h2 id="why-heading" className="text-3xl leading-[1.05] font-semibold sm:text-4xl lg:text-5xl">
              Obsessive about the details you’ll notice every day.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              Tint is only as good as its installation. We combine premium film with meticulous prep and precision cutting — then stand behind it in writing.
            </p>
            <Button asChild variant="outline" className="mt-8">
              <Link href="/about">
                About our studio <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </Reveal>
        <ul className="grid gap-4 sm:grid-cols-2">
          {WHY.map(({ icon: Icon, title, body }, i) => (
            <Reveal as="li" key={title} delay={(i % 2) * 80}>
              <div className="group h-full rounded-2xl border border-white/[0.07] bg-card p-6 transition-colors hover:border-primary/30">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export interface PackageView extends PackageCard {
  fromPrice: number;
}

export function PackagesSection({ packages, heading = true }: { packages: PackageView[]; heading?: boolean }) {
  if (!packages.length) return null;
  return (
    <div>
      {heading && (
        <SectionHeading
          eyebrow="Featured packages"
          title="Pick your level of protection"
          description="Every package includes computer-cut patterns, dust-free installation and a written warranty. Final price depends on your vehicle."
          align="center"
        />
      )}
      <div className={cn("grid gap-5 lg:grid-cols-3", heading && "mt-14")}>
        {packages.map((p, i) => {
          const book = p.service ? `/book?service=${p.service.slug}${p.serviceOptionId ? `&option=${p.serviceOptionId}` : ""}${p.filmTypeId ? `&film=${p.filmTypeId}` : ""}` : "/book";
          return (
            <Reveal key={p.id} delay={i * 90}>
              <article
                className={cn(
                  "relative flex h-full flex-col rounded-3xl border p-7 sm:p-8",
                  p.highlighted
                    ? "border-primary/50 bg-gradient-to-b from-primary/[0.12] via-card to-card shadow-[0_40px_80px_-40px_rgb(245_181_68/0.35)]"
                    : "border-white/[0.08] bg-card",
                )}
              >
                {p.highlighted && (
                  <Badge className="absolute -top-3 left-7 border-primary bg-primary text-primary-foreground">
                    <BadgeCheck /> Most popular
                  </Badge>
                )}
                <h3 className="text-2xl font-semibold">{p.name}</h3>
                {p.tagline && <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>}
                <p className="mt-6 flex items-baseline gap-2">
                  <span className="text-sm text-muted-foreground">from</span>
                  <span className="font-display text-5xl font-semibold tabular-nums">{formatCurrency(p.fromPrice)}</span>
                  {p.priceSuffix && <span className="text-sm text-muted-foreground">{p.priceSuffix}</span>}
                </p>
                {p.description && <p className="mt-4 text-sm leading-relaxed text-foreground/75">{p.description}</p>}
                <ul className="mt-6 grid gap-3 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-3">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                {p.recommendedFor.length > 0 && (
                  <div className="mt-6 border-t border-white/[0.07] pt-5">
                    <p className="text-xs font-semibold tracking-[0.16em] text-foreground/50 uppercase">Recommended for</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {p.recommendedFor.map((r) => (
                        <li key={r}>
                          <Badge variant="neutral">{r}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-auto grid gap-2 pt-8">
                  <Button asChild variant={p.highlighted ? "default" : "secondary"} size="lg">
                    <Link href={book}>Book {p.name}</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/quote">Get an exact quote</Link>
                  </Button>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

export function GalleryPreview({ items }: { items: GalleryItem[] }) {
  const shown = items.slice(0, 6);
  if (!shown.length) return null;
  return (
    <section className="container-page py-24 sm:py-32" aria-labelledby="gallery-heading">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <SectionHeading eyebrow="Recent work" title={<span id="gallery-heading">Completed vehicles</span>} description="A few recent installs from our bays — sedans, trucks, SUVs, exotics and everything in between." />
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/gallery">
            View full gallery <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
      <ul className="mt-12 grid auto-rows-[220px] grid-cols-2 gap-3 sm:auto-rows-[260px] md:grid-cols-4">
        {shown.map((item, i) => (
          <li key={item.id} className={cn("group relative overflow-hidden rounded-2xl border border-white/[0.06]", i === 0 && "col-span-2 row-span-2", i === 3 && "md:col-span-2")}>
            <Link href={`/gallery?image=${item.id}`} className="block h-full">
              <Image
                src={item.imageUrl}
                alt={item.alt}
                fill
                sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"}
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-80 transition-opacity group-hover:opacity-100" aria-hidden />
              <p className="absolute right-4 bottom-4 left-4 text-sm font-medium">{item.title}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReviewCard({ review, timeZone }: { review: PublicReview; timeZone: string }) {
  return (
    <figure className="flex h-full flex-col rounded-2xl border border-white/[0.07] bg-card p-6">
      <Stars rating={review.rating} />
      {review.title && <p className="mt-4 font-semibold">{review.title}</p>}
      <blockquote className="mt-2 flex-1 text-[15px] leading-relaxed text-foreground/80">“{review.body}”</blockquote>
      {review.adminReply && (
        <p className="mt-4 rounded-xl border-l-2 border-primary/60 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/80">Owner reply: </span>
          {review.adminReply}
        </p>
      )}
      <figcaption className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4 text-sm">
        <div>
          <p className="font-medium">{review.name}</p>
          {review.vehicle && <p className="text-xs text-muted-foreground">{review.vehicle}</p>}
        </div>
        <time dateTime={review.createdAt} className="text-xs text-muted-foreground">
          {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone }).format(new Date(review.createdAt))}
        </time>
      </figcaption>
    </figure>
  );
}

export function FinalCta({ phone }: { phone: string }) {
  return (
    <section className="container-page py-12" aria-labelledby="cta-heading">
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 px-6 py-20 text-center sm:px-12 sm:py-28">
        <Image src="/images/demo/lux-mercedes-garage.jpg" alt="" fill sizes="100vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/80 via-black/70 to-black/90" aria-hidden />
        <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" aria-hidden />
        <p className="eyebrow">Book in under 2 minutes</p>
        <h2 id="cta-heading" className="mx-auto mt-5 max-w-3xl text-4xl leading-[1.02] font-semibold sm:text-6xl">
          Ready to Upgrade Your Ride?
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-foreground/75">See your exact price, pick a time that works and lock it in with a small deposit.</p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="xl">
            <Link href="/book">
              <CalendarCheck aria-hidden /> Book Appointment
            </Link>
          </Button>
          <Button asChild size="xl" variant="secondary">
            <Link href="/quote">Get Free Quote</Link>
          </Button>
          <Button asChild size="xl" variant="outline" className="backdrop-blur-md">
            <a href={telHref(phone)}>
              <Phone aria-hidden /> Call Now
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

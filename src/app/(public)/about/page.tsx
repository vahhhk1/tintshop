import Image from "next/image";
import Link from "next/link";
import { Award, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { CountUp } from "@/components/home/count-up";
import { FinalCta } from "@/components/home/sections";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/misc";
import { initials } from "@/lib/utils";
import { pageMetadata } from "@/lib/seo";
import { getApprovedReviews, getTechniciansPublic } from "@/server/catalog";
import { getSettings } from "@/server/settings";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "About Us",
  description: "A small team of certified installers obsessed with clean, precise, warrantied window film and paint protection.",
  path: "/about",
});

const VALUES = [
  { icon: Sparkles, title: "Craft over speed", body: "We never rush prep. Clean glass and a dust-controlled bay are the difference between good and flawless." },
  { icon: ShieldCheck, title: "Stand behind it", body: "Every job gets a written warranty and a follow-up. If something isn’t right, we make it right." },
  { icon: HeartHandshake, title: "Honest advice", body: "We’ll tell you when you don’t need something — like matching factory privacy glass instead of re-tinting it." },
  { icon: Award, title: "Premium only", body: "We install proven, top-tier films and coatings we’d put on our own cars." },
];

export default async function AboutPage() {
  const [settings, technicians, reviews] = await Promise.all([getSettings(), getTechniciansPublic(), getApprovedReviews()]);
  return (
    <>
      <PageHero
        eyebrow="About us"
        title={`${settings.businessName}.`}
        description="We started with one bay and a simple idea: treat every car — from a daily commuter to a weekend exotic — like it’s our own."
        image="/images/demo/about-detailing.jpg"
        crumbs={[{ name: "About", path: "/about" }]}
      />

      <section className="container-page grid gap-12 py-20 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/[0.07]">
            <Image src="/images/demo/lux-mercedes-garage.jpg" alt="Inside our installation studio" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
        </Reveal>
        <Reveal delay={100}>
          <SectionHeading eyebrow="Our story" title="Built on precision and trust." />
          <div className="mt-6 grid gap-4 text-[17px] leading-relaxed text-foreground/80">
            <p>
              Too many tint jobs come back with dust specks, light gaps and peeling edges. We built our studio to fix that: a climate-controlled, dust-managed installation bay, computer-cut
              patterns for every vehicle and installers who care about the last millimetre.
            </p>
            <p>Today we tint, protect and coat everything from compact sedans to full-size trucks and exotics — and we still follow up after every job.</p>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {settings.yearsInBusiness ? (
              <div>
                <dt className="text-sm text-muted-foreground">Years</dt>
                <dd className="font-display text-3xl font-semibold">
                  <CountUp to={settings.yearsInBusiness} />
                </dd>
              </div>
            ) : null}
            {settings.vehiclesCompleted ? (
              <div>
                <dt className="text-sm text-muted-foreground">Vehicles</dt>
                <dd className="font-display text-3xl font-semibold">
                  <CountUp to={settings.vehiclesCompleted} suffix="+" />
                </dd>
              </div>
            ) : null}
            {reviews.average ? (
              <div>
                <dt className="text-sm text-muted-foreground">Avg. rating</dt>
                <dd className="font-display text-3xl font-semibold">{reviews.average.toFixed(1)}★</dd>
              </div>
            ) : null}
          </dl>
        </Reveal>
      </section>

      <section className="border-y border-white/[0.06] bg-[#0d0d0f] py-20" aria-labelledby="values">
        <div className="container-page">
          <SectionHeading eyebrow="What we believe" title={<span id="values">How we work</span>} />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, body }, i) => (
              <Reveal as="li" key={title} delay={i * 80}>
                <div className="h-full rounded-2xl border border-white/[0.07] bg-card p-6">
                  <Icon className="size-6 text-primary" aria-hidden />
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {technicians.length > 0 && (
        <section className="container-page py-20" aria-labelledby="team">
          <SectionHeading eyebrow="The team" title={<span id="team">Meet your installers</span>} />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {technicians.map((t) => (
              <li key={t.id} className="rounded-2xl border border-white/[0.07] bg-card p-6">
                <div className="flex items-center gap-4">
                  {t.avatarUrl ? (
                    <Image src={t.avatarUrl} alt="" width={56} height={56} className="size-14 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-14 place-items-center rounded-full bg-primary/15 font-display text-lg font-semibold text-primary">{initials(t.name)}</span>
                  )}
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    {t.title && <p className="text-sm text-muted-foreground">{t.title}</p>}
                  </div>
                </div>
                {t.bio && <p className="mt-4 text-sm leading-relaxed text-foreground/75">{t.bio}</p>}
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <Button asChild variant="outline">
              <Link href="/contact">Visit the studio</Link>
            </Button>
          </div>
        </section>
      )}

      <FinalCta phone={settings.phone} />
    </>
  );
}

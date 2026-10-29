import Link from "next/link";
import { CalendarCheck, Check, Minus } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { TintComparison } from "@/components/home/tint-comparison";
import { FinalCta, PackagesSection } from "@/components/home/sections";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/misc";
import { pageMetadata } from "@/lib/seo";
import { getFilmTypes, getPackages, getPricingCatalog } from "@/server/catalog";
import { packageFromPrice } from "@/server/pricing-display";
import { getSettings } from "@/server/settings";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Window Tint — Ceramic, Carbon & Dyed Film",
  description: "Compare ceramic, carbon and dyed window film, preview tint percentages from 5% to 70%, and learn about heat rejection, UV protection and tint laws.",
  path: "/window-tint",
});

const PROCESS = [
  { title: "Consult & choose", body: "We confirm your goals, check local tint rules and help you pick the right film and shade." },
  { title: "Prep & clean", body: "Glass is deep-cleaned and decontaminated in a dust-controlled bay; door panels and electronics are protected." },
  { title: "Precision cut", body: "Patterns are computer-cut for your exact vehicle, then heat-shrunk to the curve of each window." },
  { title: "Install & inspect", body: "Film is squeegeed edge-to-edge, micro-edged and inspected under lights before handover." },
];

const AFTERCARE = [
  "Keep windows rolled up for 3–5 days while the adhesive cures.",
  "Slight haze or small water pockets are normal and disappear as the film cures.",
  "Wait a week before cleaning the inside of the glass; then use ammonia-free cleaner and a soft microfiber.",
  "Avoid sharp objects, seat-belt snaps and stickers on the tinted surface.",
];

export default async function WindowTintPage() {
  const [films, packages, catalog, settings] = await Promise.all([getFilmTypes(), getPackages(), getPricingCatalog(), getSettings()]);
  const packageViews = packages.map((p) => ({ ...p, fromPrice: packageFromPrice(catalog, p) }));
  const allFeatures = Array.from(new Set(films.flatMap((f) => f.features)));

  return (
    <>
      <PageHero
        eyebrow="Window tint"
        title="The right film makes all the difference."
        description="Dyed, carbon or ceramic — every film we install blocks 99% of UV rays. The difference is how much heat it rejects, how it looks and how long it lasts."
        image="/images/demo/service-ceramic-tint.jpg"
        crumbs={[{ name: "Window Tint", path: "/window-tint" }]}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/book?service=window-tint">
              <CalendarCheck aria-hidden /> Book Window Tint
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/quote">Price my vehicle</Link>
          </Button>
        </div>
      </PageHero>

      <section className="container-page py-20" aria-labelledby="compare-films">
        <SectionHeading eyebrow="Compare films" title={<span id="compare-films">Dyed vs. carbon vs. ceramic</span>} />
        <div className="mt-10 overflow-x-auto rounded-3xl border border-white/[0.07]">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                <th scope="col" className="px-6 py-5 text-left font-medium text-muted-foreground">
                  Feature
                </th>
                {films.map((f) => (
                  <th key={f.id} scope="col" className="px-6 py-5 text-left">
                    <span className="block font-display text-lg font-semibold">{f.name}</span>
                    {f.tagline && <span className="block text-xs font-normal text-muted-foreground">{f.tagline}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Infrared heat rejection", get: (f: (typeof films)[number]) => (f.heatRejection != null ? `up to ${f.heatRejection}%` : "—") },
                { label: "UV protection", get: (f: (typeof films)[number]) => (f.uvRejection != null ? `${f.uvRejection}%` : "—") },
                { label: "Glare reduction", get: (f: (typeof films)[number]) => (f.glareReduction != null ? `up to ${f.glareReduction}%` : "—") },
                { label: "Warranty", get: (f: (typeof films)[number]) => (f.warrantyYears == null ? "—" : f.warrantyYears >= 50 ? "Lifetime" : `${f.warrantyYears} years`) },
                { label: "Available shades", get: (f: (typeof films)[number]) => f.shades.map((s) => `${s}%`).join(", ") },
              ].map((row) => (
                <tr key={row.label} className="border-b border-white/[0.05]">
                  <th scope="row" className="px-6 py-4 text-left font-medium">
                    {row.label}
                  </th>
                  {films.map((f) => (
                    <td key={f.id} className="px-6 py-4 tabular-nums text-foreground/85">
                      {row.get(f)}
                    </td>
                  ))}
                </tr>
              ))}
              {allFeatures.slice(0, 6).map((feature) => (
                <tr key={feature} className="border-b border-white/[0.05] last:border-0">
                  <th scope="row" className="px-6 py-4 text-left font-normal text-foreground/80">
                    {feature}
                  </th>
                  {films.map((f) => (
                    <td key={f.id} className="px-6 py-4">
                      {f.features.includes(feature) ? (
                        <Check className="size-4 text-primary" aria-label="Included" />
                      ) : (
                        <Minus className="size-4 text-white/20" aria-label="Not included" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {films.map((f) => (
            <p key={f.id} className="rounded-2xl border border-white/[0.07] bg-card p-5 text-sm leading-relaxed text-muted-foreground">
              <strong className="block text-base text-foreground">{f.name}</strong>
              {f.description}
            </p>
          ))}
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-[#0d0d0f] py-20" aria-labelledby="shades">
        <div className="container-page">
          <SectionHeading
            eyebrow="Tint percentages"
            title={<span id="shades">5% to 70% — what each shade looks like</span>}
            description="VLT (visible light transmission) is the percentage of light that passes through. Lower numbers are darker."
          />
          <div className="mt-12">
            <TintComparison />
          </div>
        </div>
      </section>

      <section className="container-page py-20" aria-labelledby="process">
        <SectionHeading eyebrow="Our process" title={<span id="process">How we install</span>} />
        <ol className="mt-12 grid gap-4 md:grid-cols-4">
          {PROCESS.map((step, i) => (
            <Reveal as="li" key={step.title} delay={i * 80}>
              <div className="h-full rounded-2xl border border-white/[0.07] bg-card p-6">
                <span className="font-display text-sm font-semibold text-primary">0{i + 1}</span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
        <div className="mt-12 grid gap-8 rounded-3xl border border-white/[0.07] bg-card p-7 md:grid-cols-[1fr_1.4fr] sm:p-10">
          <div>
            <h3 className="text-2xl font-semibold">Aftercare</h3>
            <p className="mt-2 text-muted-foreground">A few simple steps keep your film looking perfect for years.</p>
          </div>
          <ul className="grid gap-3 text-[15px]">
            {AFTERCARE.map((a) => (
              <li key={a} className="flex gap-3">
                <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                {a}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-12" aria-label="Packages">
        <PackagesSection packages={packageViews} />
      </section>

      <FinalCta phone={settings.phone} />
    </>
  );
}

import { Clock, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { ContactForm } from "@/components/forms/contact-form";
import { SocialLinks } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { formatHm } from "@/lib/time";
import { pageMetadata } from "@/lib/seo";
import { telHref } from "@/lib/utils";
import { getServices } from "@/server/catalog";
import { formatAddress, getBusinessHours, getSettings, mapsEmbed, mapsLink } from "@/server/settings";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Contact",
  description: "Call, email or message us about window tint, PPF or ceramic coating. Find our address, business hours and directions.",
  path: "/contact",
});

export default async function ContactPage() {
  const [settings, hours, services] = await Promise.all([getSettings(), getBusinessHours(), getServices()]);
  const address = formatAddress(settings);
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Let’s talk about your car."
        description="Questions about film, pricing or scheduling? Send a message and we’ll reply within one business day — or call for the fastest answer."
        crumbs={[{ name: "Contact", path: "/contact" }]}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <a href={telHref(settings.phone)}>
              <Phone aria-hidden /> Call {settings.phone}
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={`mailto:${settings.email}`}>
              <Mail aria-hidden /> Email us
            </a>
          </Button>
        </div>
      </PageHero>

      <div className="container-page grid gap-10 py-16 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-3xl border border-white/[0.08] bg-card p-6 sm:p-10" aria-labelledby="form-heading">
          <h2 id="form-heading" className="text-2xl font-semibold">
            Send a message
          </h2>
          <p className="mt-2 mb-8 text-muted-foreground">Prefer an instant price? Try the online quote tool.</p>
          <ContactForm services={services.map((s) => s.name)} />
        </section>

        <aside className="grid content-start gap-4">
          <div className="rounded-3xl border border-white/[0.08] bg-card p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <MapPin className="size-4 text-primary" aria-hidden /> Visit the studio
            </h2>
            <address className="mt-3 text-sm leading-relaxed text-foreground/80 not-italic">{address}</address>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <a href={mapsLink(settings)} target="_blank" rel="noopener noreferrer">
                <Navigation aria-hidden /> Get directions
              </a>
            </Button>
          </div>
          <div className="overflow-hidden rounded-3xl border border-white/[0.08]">
            <iframe
              title={`Map showing ${settings.businessName}`}
              src={mapsEmbed(settings)}
              className="h-64 w-full grayscale invert-[0.92] hue-rotate-180"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="rounded-3xl border border-white/[0.08] bg-card p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Clock className="size-4 text-primary" aria-hidden /> Business hours
            </h2>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {hours.map((h) => (
                <div key={h.dayOfWeek} className="contents">
                  <dt className="text-foreground/70">{h.day}</dt>
                  <dd className={h.isOpen ? "text-right tabular-nums" : "text-right text-muted-foreground"}>
                    {h.isOpen ? `${formatHm(h.openTime)} – ${formatHm(h.closeTime)}` : "Closed"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-3xl border border-white/[0.08] bg-card p-6">
            <h2 className="font-semibold">Follow along</h2>
            <SocialLinks
              className="mt-4"
              links={{ instagram: settings.instagramUrl, facebook: settings.facebookUrl, tiktok: settings.tiktokUrl, youtube: settings.youtubeUrl }}
            />
          </div>
        </aside>
      </div>
    </>
  );
}

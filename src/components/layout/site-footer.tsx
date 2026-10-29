import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo, SocialLinks } from "@/components/layout/brand";
import { formatHm } from "@/lib/time";
import { telHref } from "@/lib/utils";
import { formatAddress, mapsLink, type HoursRow, type Settings } from "@/server/settings";
import type { ServiceCard } from "@/server/catalog";
import { LEGAL_SLUGS } from "@/server/catalog";

export function SiteFooter({ settings, hours, services }: { settings: Settings; hours: HoursRow[]; services: ServiceCard[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-24 border-t border-white/[0.06] bg-[#080809] pb-28 sm:pb-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" aria-hidden />
      <div className="container-page grid gap-12 py-16 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo name={settings.businessName} logoUrl={settings.logoUrl} />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {settings.tagline ?? "Premium automotive window tint"} — precision-cut films, dust-free installation and a written warranty on every job.
          </p>
          <SocialLinks
            className="mt-6"
            links={{ instagram: settings.instagramUrl, facebook: settings.facebookUrl, tiktok: settings.tiktokUrl, youtube: settings.youtubeUrl }}
          />
        </div>

        <nav aria-label="Services" className="lg:col-span-2">
          <h2 className="text-xs font-semibold tracking-[0.18em] text-foreground/50 uppercase">Services</h2>
          <ul className="mt-4 grid gap-2.5 text-sm">
            {services.slice(0, 8).map((s) => (
              <li key={s.id}>
                <Link href={`/services/${s.slug}`} className="text-foreground/75 transition-colors hover:text-primary">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company" className="lg:col-span-2">
          <h2 className="text-xs font-semibold tracking-[0.18em] text-foreground/50 uppercase">Company</h2>
          <ul className="mt-4 grid gap-2.5 text-sm">
            {[
              ["/about", "About us"],
              ["/gallery", "Gallery"],
              ["/reviews", "Reviews"],
              ["/pricing", "Pricing"],
              ["/faq", "FAQ"],
              ["/contact", "Contact"],
              ["/quote", "Get a quote"],
              ["/book", "Book online"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-foreground/75 transition-colors hover:text-primary">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-8 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
          <div>
            <h2 className="text-xs font-semibold tracking-[0.18em] text-foreground/50 uppercase">Visit</h2>
            <ul className="mt-4 grid gap-3 text-sm text-foreground/75">
              <li>
                <a href={mapsLink(settings)} target="_blank" rel="noopener noreferrer" className="flex gap-3 hover:text-primary">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {formatAddress(settings)}
                </a>
              </li>
              <li>
                <a href={telHref(settings.phone)} className="flex gap-3 hover:text-primary">
                  <Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {settings.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${settings.email}`} className="flex gap-3 break-all hover:text-primary">
                  <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {settings.email}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-foreground/50 uppercase">
              <Clock className="size-3.5" aria-hidden /> Hours
            </h2>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
              {hours.map((h) => (
                <div key={h.dayOfWeek} className="contents">
                  <dt className="text-foreground/60">{h.day.slice(0, 3)}</dt>
                  <dd className={h.isOpen ? "text-foreground/85 tabular-nums" : "text-foreground/40"}>
                    {h.isOpen ? `${formatHm(h.openTime)} – ${formatHm(h.closeTime)}` : "Closed"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="container-page flex flex-col gap-4 py-6 text-xs text-foreground/50 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {settings.businessName}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_SLUGS.map((l) => (
              <li key={l.slug}>
                <Link href={`/legal/${l.slug}`} className="hover:text-foreground">
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

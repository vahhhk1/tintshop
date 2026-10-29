import { absoluteUrl } from "@/lib/utils";
import type { HoursRow, Settings } from "@/server/settings";

/** Renders structured data safely (escapes "<" so content can't close the script tag). */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function localBusinessSchema(settings: Settings, hours: HoursRow[], rating?: { average: number | null; count: number }) {
  const sameAs = [settings.instagramUrl, settings.facebookUrl, settings.tiktokUrl, settings.youtubeUrl].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "AutoBodyShop",
    "@id": absoluteUrl("/#business"),
    name: settings.businessName,
    description: settings.tagline ?? undefined,
    url: absoluteUrl("/"),
    telephone: settings.phone,
    email: settings.email,
    image: absoluteUrl("/images/demo/cta-silhouette.jpg"),
    logo: settings.logoUrl ? absoluteUrl(settings.logoUrl) : absoluteUrl("/icons/icon-512.png"),
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: [settings.addressLine1, settings.addressLine2].filter(Boolean).join(", "),
      addressLocality: settings.city,
      addressRegion: settings.state,
      postalCode: settings.postalCode,
      addressCountry: settings.country,
    },
    ...(settings.latitude != null && settings.longitude != null
      ? { geo: { "@type": "GeoCoordinates", latitude: settings.latitude, longitude: settings.longitude } }
      : {}),
    hasMap: settings.googleMapsUrl ?? undefined,
    openingHoursSpecification: hours
      .filter((h) => h.isOpen)
      .map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAY[h.dayOfWeek], opens: h.openTime, closes: h.closeTime })),
    ...(rating?.average && rating.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average, reviewCount: rating.count, bestRating: 5 } }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
    areaServed: `${settings.city}, ${settings.state}`,
  };
}

export function serviceSchema(input: { name: string; description: string; slug: string; image?: string | null; lowPrice?: number | null; currency: string; businessName: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    url: absoluteUrl(`/services/${input.slug}`),
    image: input.image ? absoluteUrl(input.image) : undefined,
    serviceType: input.name,
    provider: { "@id": absoluteUrl("/#business"), name: input.businessName },
    ...(input.lowPrice
      ? { offers: { "@type": "Offer", priceCurrency: input.currency.toUpperCase(), price: (input.lowPrice / 100).toFixed(2), availability: "https://schema.org/InStock" } }
      : {}),
  };
}

export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: absoluteUrl(item.path) })),
  };
}

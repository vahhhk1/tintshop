import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";
import { LEGAL_SLUGS, getServices } from "@/server/catalog";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/book", priority: 0.9, changeFrequency: "weekly" },
    { path: "/quote", priority: 0.9, changeFrequency: "weekly" },
    { path: "/services", priority: 0.9, changeFrequency: "weekly" },
    { path: "/window-tint", priority: 0.9, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.8, changeFrequency: "weekly" },
    { path: "/gallery", priority: 0.7, changeFrequency: "weekly" },
    { path: "/reviews", priority: 0.7, changeFrequency: "weekly" },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.7, changeFrequency: "monthly" },
  ];
  let services: { slug: string }[] = [];
  try {
    services = await getServices();
  } catch {
    // Database unavailable at build time — static pages are still listed.
  }
  return [
    ...staticPages.map((p) => ({ url: absoluteUrl(p.path), lastModified: now, changeFrequency: p.changeFrequency, priority: p.priority })),
    ...services.map((s) => ({ url: absoluteUrl(`/services/${s.slug}`), lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...LEGAL_SLUGS.map((l) => ({ url: absoluteUrl(`/legal/${l.slug}`), lastModified: now, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}

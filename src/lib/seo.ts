import type { Metadata } from "next";

/** Per-page metadata with canonical URL and Open Graph defaults. */
export function pageMetadata({ title, description, path, image }: { title: string; description: string; path: string; image?: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { title, description, ...(image ? { images: [image] } : {}) },
  };
}

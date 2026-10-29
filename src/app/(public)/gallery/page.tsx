import { Suspense } from "react";
import Link from "next/link";
import { PageHero } from "@/components/layout/page-hero";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { FinalCta } from "@/components/home/sections";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { pageMetadata } from "@/lib/seo";
import { getGallery } from "@/server/catalog";
import { getSettings } from "@/server/settings";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Gallery",
  description: "Completed window tint, ceramic tint, windshield and full-vehicle projects on sedans, trucks, SUVs, luxury and sports cars.",
  path: "/gallery",
});

function GallerySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="aspect-[4/3]" />
      ))}
    </div>
  );
}

export default async function GalleryPage() {
  const [items, settings] = await Promise.all([getGallery(), getSettings()]);
  return (
    <>
      <PageHero
        eyebrow="Gallery"
        title="Recent work from our bays."
        description="Filter by vehicle or service and tap any photo for a full-screen view. Before/after photos include a drag-to-compare slider."
        crumbs={[{ name: "Gallery", path: "/gallery" }]}
      >
        <Button asChild>
          <Link href="/book">Book your appointment</Link>
        </Button>
      </PageHero>
      <section className="container-page py-14" aria-label="Photos">
        <Suspense fallback={<GallerySkeleton />}>
          <GalleryGrid items={items} />
        </Suspense>
      </section>
      <FinalCta phone={settings.phone} />
    </>
  );
}

import Image from "next/image";
import { ArrowDown, ArrowUp, Eye, EyeOff, Images, Star, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/admin/action-form";
import { GalleryForm } from "@/components/admin/gallery-form";
import { PageHeader } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { deleteGalleryImageAction, moveGalleryImageAction, toggleGalleryFlagAction } from "@/server/admin/gallery";

export const metadata = { title: "Gallery" };

export default async function AdminGalleryPage() {
  await requirePermission("gallery:manage", "/admin/gallery");
  const [images, services] = await Promise.all([
    prisma.galleryImage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
    prisma.service.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Gallery" description="Upload completed work, add before/after photos, assign categories and choose what’s featured." />
      <section className="mb-8 rounded-2xl border border-white/[0.07] bg-card p-6" aria-labelledby="add-h">
        <h2 id="add-h" className="mb-4 text-lg font-semibold">
          Add a photo
        </h2>
        <GalleryForm
          values={{ title: "", caption: null, alt: "", imageUrl: "", beforeImageUrl: null, categories: [], vehicle: null, serviceId: null, featured: false, published: true, width: null, height: null }}
          services={services}
        />
      </section>
      {images.length === 0 ? (
        <EmptyState icon={Images} title="No photos yet" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-card">
              <div className="relative aspect-[16/10]">
                <Image src={img.imageUrl} alt={img.alt} fill sizes="(min-width: 1536px) 33vw, (min-width: 768px) 50vw, 100vw" className="object-cover" unoptimized={img.imageUrl.startsWith("http")} />
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  {img.featured && (
                    <Badge className="border-primary bg-primary text-primary-foreground">
                      <Star /> Featured
                    </Badge>
                  )}
                  {!img.published && <Badge variant="neutral">Hidden</Badge>}
                  {img.beforeImageUrl && <Badge variant="info">Before/after</Badge>}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2">
                <p className="truncate text-sm font-medium">{img.title}</p>
                <div className="flex shrink-0 gap-0.5">
                  <ActionButton size="icon-sm" variant="ghost" disabled={i === 0} action={moveGalleryImageAction} args={[img.id, "up"]} aria-label="Move earlier">
                    <ArrowUp className="size-4" />
                  </ActionButton>
                  <ActionButton size="icon-sm" variant="ghost" disabled={i === images.length - 1} action={moveGalleryImageAction} args={[img.id, "down"]} aria-label="Move later">
                    <ArrowDown className="size-4" />
                  </ActionButton>
                  <ActionButton size="icon-sm" variant="ghost" action={toggleGalleryFlagAction} args={[img.id, "featured", !img.featured]} aria-label={img.featured ? "Unfeature" : "Feature"}>
                    <Star className={img.featured ? "size-4 fill-primary text-primary" : "size-4"} />
                  </ActionButton>
                  <ActionButton size="icon-sm" variant="ghost" action={toggleGalleryFlagAction} args={[img.id, "published", !img.published]} aria-label={img.published ? "Hide" : "Publish"}>
                    {img.published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </ActionButton>
                  <ActionButton size="icon-sm" variant="ghost" action={deleteGalleryImageAction} args={[img.id]} confirm="Delete this photo?" aria-label="Delete photo">
                    <Trash2 className="size-4 text-red-300" />
                  </ActionButton>
                </div>
              </div>
              <details className="p-4">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Edit details</summary>
                <div className="mt-4">
                  <GalleryForm values={img} services={services} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

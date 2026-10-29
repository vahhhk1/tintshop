"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { BeforeAfterSlider } from "@/components/home/before-after";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export interface GalleryImageView {
  id: string;
  title: string;
  caption: string | null;
  alt: string;
  imageUrl: string;
  beforeImageUrl: string | null;
  width: number | null;
  height: number | null;
  categories: string[];
  vehicle: string | null;
}

export const GALLERY_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "SEDAN", label: "Sedans" },
  { value: "TRUCK", label: "Trucks" },
  { value: "SUV", label: "SUVs" },
  { value: "LUXURY", label: "Luxury" },
  { value: "SPORTS", label: "Sports Cars" },
  { value: "CERAMIC", label: "Ceramic Tint" },
  { value: "WINDSHIELD", label: "Windshield" },
  { value: "FULL_VEHICLE", label: "Full Vehicle" },
] as const;

export function GalleryGrid({ items }: { items: GalleryImageView[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const filter = params.get("category")?.toUpperCase() ?? "ALL";
  const openId = params.get("image");

  const visible = React.useMemo(() => (filter === "ALL" ? items : items.filter((i) => i.categories.includes(filter))), [items, filter]);
  const openIndex = openId ? visible.findIndex((i) => i.id === openId) : -1;
  const current = openIndex >= 0 ? visible[openIndex] : openId ? items.find((i) => i.id === openId) : undefined;

  const setParams = React.useCallback(
    (next: { category?: string | null; image?: string | null }) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === "ALL") sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      router.replace(qs ? `/gallery?${qs}` : "/gallery", { scroll: false });
    },
    [params, router],
  );

  const step = React.useCallback(
    (delta: number) => {
      if (!visible.length) return;
      const idx = openIndex < 0 ? 0 : (openIndex + delta + visible.length) % visible.length;
      setParams({ image: visible[idx]!.id });
    },
    [openIndex, visible, setParams],
  );

  const touchStart = React.useRef<number | null>(null);

  return (
    <>
      <div role="tablist" aria-label="Filter gallery" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {GALLERY_FILTERS.map((f) => {
          const count = f.value === "ALL" ? items.length : items.filter((i) => i.categories.includes(f.value)).length;
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              role="tab"
              aria-selected={active}
              onClick={() => setParams({ category: f.value, image: null })}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "border-white/10 text-foreground/75 hover:border-white/25 hover:text-foreground",
              )}
            >
              {f.label}
              <span className={cn("ml-1.5 text-xs", active ? "text-primary-foreground/70" : "text-muted-foreground")}>{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState className="mt-10" icon={Images} title="No photos in this category yet" description="Check back soon or browse all photos." />
      ) : (
        <ul className="mt-10 columns-1 gap-4 sm:columns-2 lg:columns-3">
          {visible.map((item, i) => (
            <li key={item.id} className="mb-4 break-inside-avoid">
              <button
                type="button"
                onClick={() => setParams({ image: item.id })}
                className="group relative block w-full overflow-hidden rounded-2xl border border-white/[0.06] text-left"
                aria-label={`Open ${item.title}`}
              >
                <Image
                  src={item.imageUrl}
                  alt={item.alt}
                  width={item.width ?? 1600}
                  height={item.height ?? 1067}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="h-auto w-full transition-transform duration-700 group-hover:scale-[1.04]"
                  preload={i < 3}
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-90 transition-opacity group-hover:opacity-100" aria-hidden />
                <span className="absolute right-4 bottom-4 left-4">
                  <span className="block text-sm font-semibold">{item.title}</span>
                  {item.beforeImageUrl && <span className="mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary-foreground uppercase">Before / After</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <D.Root open={Boolean(current)} onOpenChange={(o) => !o && setParams({ image: null })}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <D.Content
            className="fixed inset-0 z-50 flex flex-col outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") step(1);
              if (e.key === "ArrowLeft") step(-1);
            }}
            onTouchStart={(e) => (touchStart.current = e.touches[0]?.clientX ?? null)}
            onTouchEnd={(e) => {
              const start = touchStart.current;
              const end = e.changedTouches[0]?.clientX;
              if (start != null && end != null && Math.abs(end - start) > 50) step(end < start ? 1 : -1);
              touchStart.current = null;
            }}
          >
            {current && (
              <>
                <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
                  <div className="min-w-0">
                    <D.Title className="truncate font-semibold">{current.title}</D.Title>
                    <D.Description className="truncate text-xs text-muted-foreground">
                      {current.caption ?? current.vehicle ?? ""} {openIndex >= 0 && `· ${openIndex + 1} / ${visible.length}`}
                    </D.Description>
                  </div>
                  <D.Close className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20" aria-label="Close viewer">
                    <X className="size-5" />
                  </D.Close>
                </div>
                <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6 sm:px-20">
                  {current.beforeImageUrl ? (
                    <BeforeAfterSlider before={current.beforeImageUrl} after={current.imageUrl} alt={current.alt} className="max-h-full max-w-5xl" />
                  ) : (
                    <div className="relative h-full w-full max-w-6xl">
                      <Image key={current.id} src={current.imageUrl} alt={current.alt} fill sizes="100vw" className="object-contain animate-in fade-in-0 duration-300" />
                    </div>
                  )}
                  {visible.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => step(-1)}
                        className="absolute top-1/2 left-2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20 sm:left-5"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="size-6" />
                      </button>
                      <button
                        type="button"
                        onClick={() => step(1)}
                        className="absolute top-1/2 right-2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20 sm:right-5"
                        aria-label="Next photo"
                      >
                        <ChevronRight className="size-6" />
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </D.Content>
        </D.Portal>
      </D.Root>
    </>
  );
}

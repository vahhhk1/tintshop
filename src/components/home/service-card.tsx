import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { ServiceCard as ServiceCardData } from "@/server/catalog";

export function ServiceCard({ service, fromPrice, priority }: { service: ServiceCardData; fromPrice: number; priority?: boolean }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-card transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)]">
      <div className="relative aspect-[4/3] overflow-hidden">
        {service.imageUrl ? (
          <Image
            src={service.imageUrl}
            alt={`${service.name} installation`}
            fill
            sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            preload={priority}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-white/10 to-transparent" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" aria-hidden />
        <span className="absolute top-4 left-4 rounded-full border border-white/15 bg-black/65 px-3 py-1 text-xs font-medium">
          From <span className="text-primary">{formatCurrency(fromPrice)}</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6 pt-2">
        <h3 className="text-xl font-semibold">{service.name}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{service.shortDescription}</p>
        <div className="mt-5 flex items-center justify-between">
          <Link
            href={`/services/${service.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground after:absolute after:inset-0 after:content-['']"
          >
            Learn More
            <span className="sr-only"> about {service.name}</span>
          </Link>
          <span className="grid size-9 place-items-center rounded-full border border-white/10 transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground" aria-hidden>
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );
}

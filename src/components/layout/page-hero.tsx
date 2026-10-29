import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { JsonLd, breadcrumbSchema } from "@/components/seo/json-ld";
import { cn } from "@/lib/utils";

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  crumbs,
  children,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  image?: string;
  crumbs?: { name: string; path: string }[];
  children?: React.ReactNode;
  className?: string;
}) {
  const trail = crumbs ? [{ name: "Home", path: "/" }, ...crumbs] : null;
  return (
    <section className={cn("relative isolate overflow-hidden border-b border-white/[0.06] pt-32 pb-16 sm:pt-40 sm:pb-20", className)}>
      {image ? (
        <>
          <Image src={image} alt="" fill preload sizes="100vw" className="-z-20 object-cover opacity-40" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/70 via-background/80 to-background" aria-hidden />
        </>
      ) : (
        <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_80%_at_20%_0%,rgb(245_181_68/0.10),transparent_70%)]" aria-hidden />
      )}
      <div className="container-page">
        {trail && (
          <>
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {trail.map((c, i) => (
                  <li key={c.path} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="size-3" aria-hidden />}
                    {i === trail.length - 1 ? (
                      <span aria-current="page" className="text-foreground/80">
                        {c.name}
                      </span>
                    ) : (
                      <Link href={c.path} className="hover:text-foreground">
                        {c.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
            <JsonLd data={breadcrumbSchema(trail)} />
          </>
        )}
        <div className="max-w-3xl">
          {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
          <h1 className="text-4xl leading-[1.02] font-semibold sm:text-5xl lg:text-6xl">{title}</h1>
          {description && <div className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground/70">{description}</div>}
          {children && <div className="mt-8">{children}</div>}
        </div>
      </div>
    </section>
  );
}

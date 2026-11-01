import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand artwork in public/brand, cut from the original logo: the full stacked logo, its
 * lettering and the round emblem. White versions for the dark site (black ones are there
 * for light backgrounds). Small, exact-size PNGs, so they skip image optimisation.
 */
const BRAND = {
  logo: { src: "/brand/logo-white.png", width: 600, height: 314 },
  wordmark: { src: "/brand/wordmark-white.png", width: 594, height: 41 },
  emblem: { src: "/brand/emblem-white.png", width: 174, height: 174 },
};

export function LogoMark({ className }: { className?: string }) {
  return <Image {...BRAND.emblem} alt="" aria-hidden unoptimized className={cn("size-8", className)} />;
}

/**
 * The logo. In bars (header, dashboards) the emblem sits beside the lettering, which stays
 * legible at that height; `stacked` shows the full logo (footer, sign-in pages). A logo
 * uploaded in Admin → Settings replaces the artwork, next to the business name.
 */
export function Logo({
  name,
  logoUrl,
  className,
  href = "/",
  compact,
  stacked,
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
  href?: string;
  compact?: boolean;
  stacked?: boolean;
}) {
  if (logoUrl) {
    const [first, ...rest] = name.split(" ");
    return (
      <Link href={href} className={cn("group inline-flex items-center gap-2.5 rounded-lg", className)} aria-label={`${name} — home`}>
        <Image src={logoUrl} alt="" width={32} height={32} className="size-8 rounded-lg object-contain" />
        <span className={cn("font-display leading-none font-semibold whitespace-nowrap uppercase", compact ? "text-[12.5px] tracking-[0.1em]" : "text-[15px] tracking-[0.14em]")} style={{ fontStretch: "120%" }}>
          {first}
          {rest.length > 0 && <span className="ml-1.5 font-normal text-muted-foreground">{rest.join(" ")}</span>}
        </span>
      </Link>
    );
  }
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5 rounded-lg", className)} aria-label={`${name} — home`}>
      {stacked ? (
        <Image {...BRAND.logo} alt="" unoptimized className="h-auto w-56" />
      ) : (
        <>
          <LogoMark className={cn("transition-transform duration-300 group-hover:-rotate-6", compact ? "size-8" : "size-10")} />
          <Image {...BRAND.wordmark} alt="" unoptimized className={cn("w-auto", compact ? "h-[11px]" : "h-[13px] sm:h-[15px]")} />
        </>
      )}
    </Link>
  );
}

const SOCIAL_PATHS = {
  instagram: "",
  facebook:
    "M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z",
  tiktok:
    "M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.2v12.6a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.8a5.8 5.8 0 1 0 5 5.8V9.2a7.4 7.4 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6Z",
  youtube:
    "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z",
} as const;

export type SocialKey = keyof typeof SOCIAL_PATHS;

export function SocialLinks({ links, className }: { links: Partial<Record<SocialKey, string | null>>; className?: string }) {
  const entries = (Object.keys(SOCIAL_PATHS) as SocialKey[]).filter((k) => links[k]);
  if (!entries.length) return null;
  return (
    <ul className={cn("flex items-center gap-2", className)}>
      {entries.map((k) => (
        <li key={k}>
          <a
            href={links[k]!}
            target="_blank"
            rel="noopener noreferrer"
            className="grid size-10 place-items-center rounded-full border border-white/10 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            aria-label={k.charAt(0).toUpperCase() + k.slice(1)}
          >
            {k === "instagram" ? (
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden>
                <path d={SOCIAL_PATHS[k]} />
              </svg>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

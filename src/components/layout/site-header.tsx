"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Menu, Phone, UserRound } from "lucide-react";
import { Dialog, DialogTitle, DialogTrigger, SheetContent, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/brand";
import { cn, telHref } from "@/lib/utils";
import { track } from "@/lib/analytics";

export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/window-tint", label: "Window Tint" },
  { href: "/pricing", label: "Pricing" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
  { href: "/reviews", label: "Reviews" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ businessName, logoUrl, phone }: { businessName: string; logoUrl: string | null; phone: string }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled ? "glass border-b border-white/[0.06]" : "border-b border-transparent bg-gradient-to-b from-black/60 to-transparent",
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-[72px]">
        <Logo name={businessName} logoUrl={logoUrl} />

        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative rounded-full px-2.5 py-2 text-[13.5px] font-medium whitespace-nowrap transition-colors hover:text-foreground 2xl:px-3",
                      active ? "text-foreground" : "text-foreground/65",
                    )}
                  >
                    {item.label}
                    {active && <span className="absolute inset-x-3 -bottom-0.5 h-px bg-primary" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
            <Link href="/dashboard" aria-label="My account">
              <UserRound className="size-[18px]" />
            </Link>
          </Button>
          <Button asChild size="sm" className="hidden h-10 px-5 sm:inline-flex">
            <Link href="/book">
              <CalendarCheck aria-hidden />
              Book Now
            </Link>
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="xl:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </DialogTrigger>
            <SheetContent side="right" className="p-0" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
              <DialogTitle className="sr-only">Menu</DialogTitle>
              <DialogDescription className="sr-only">Site navigation</DialogDescription>
              <div className="flex h-16 items-center border-b border-white/[0.06] px-5">
                <Logo name={businessName} logoUrl={logoUrl} />
              </div>
              <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 py-4">
                <ul className="grid gap-0.5">
                  {NAV_ITEMS.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center justify-between rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
                            active ? "bg-white/[0.06] text-foreground" : "text-foreground/75 hover:bg-white/[0.04]",
                          )}
                        >
                          {item.label}
                          {active && <span className="size-1.5 rounded-full bg-primary" aria-hidden />}
                        </Link>
                      </li>
                    );
                  })}
                  <li>
                    <Link href="/dashboard" className="flex items-center gap-2 rounded-xl px-4 py-3.5 text-base font-medium text-foreground/75 hover:bg-white/[0.04]">
                      <UserRound className="size-4" aria-hidden /> My account
                    </Link>
                  </li>
                </ul>
              </nav>
              <div className="grid gap-2 border-t border-white/[0.06] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button asChild size="lg">
                  <Link href="/book">Book an Appointment</Link>
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline">
                    <Link href="/quote">Free Quote</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <a href={telHref(phone)} onClick={() => track("call_clicked", { location: "mobile_menu" })}>
                      <Phone aria-hidden /> Call
                    </a>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}

/** Sticky bottom CTA bar on phones. Hidden inside booking/checkout flows. */
export function MobileBookBar() {
  const pathname = usePathname();
  const hidden = BOOK_FLOW_PATHS.some((p) => pathname.startsWith(p));
  if (hidden) return null;
  return (
    <div className="glass fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
      <div className="flex gap-2">
        <Button asChild variant="outline" className="h-12 flex-1">
          <Link href="/quote">Free Quote</Link>
        </Button>
        <Button asChild className="h-12 flex-[1.4]">
          <Link href="/book">
            <CalendarCheck aria-hidden /> Book Now
          </Link>
        </Button>
      </div>
    </div>
  );
}

const BOOK_FLOW_PATHS = ["/book", "/quote", "/checkout", "/manage"];

/**
 * Floating call button pinned to the bottom-right corner. Tapping dials the shop;
 * the handset "rings" every few seconds with a pulse ring (off for reduced motion).
 * On phones it sits above the sticky booking bar.
 */
export function FloatingCallButton({ phone }: { phone: string }) {
  const pathname = usePathname();
  const barVisible = !BOOK_FLOW_PATHS.some((p) => pathname.startsWith(p));
  return (
    <a
      href={telHref(phone)}
      onClick={() => track("call_clicked", { location: "floating" })}
      aria-label={`Call us at ${phone}`}
      title={`Call ${phone}`}
      className={cn(
        "group fixed right-4 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_40px_-8px_rgb(245_181_68/0.65)] transition-transform duration-200 animate-in fade-in zoom-in-75 hover:scale-110 active:scale-95 sm:right-6 sm:bottom-6",
        barVisible ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]" : "bottom-[max(1.25rem,env(safe-area-inset-bottom))]",
      )}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-primary/60 animate-call-pulse" aria-hidden />
      <span className="pointer-events-none absolute inset-0 rounded-full bg-primary/40 animate-call-pulse [animation-delay:0.35s]" aria-hidden />
      <Phone className="relative size-6 animate-phone-ring group-hover:animate-none" strokeWidth={2.25} aria-hidden />
    </a>
  );
}

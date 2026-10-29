"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Car,
  ChartNoAxesCombined,
  ClipboardList,
  CreditCard,
  FileText,
  Images,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Tags,
  UserRound,
  Users,
  Wrench,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Dialog, DialogDescription, DialogTitle, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { Logo } from "@/components/layout/brand";
import { cn, initials } from "@/lib/utils";
import { signOutAction } from "@/server/auth/actions";

const ICONS = {
  overview: LayoutDashboard,
  appointments: CalendarDays,
  quotes: ClipboardList,
  payments: CreditCard,
  vehicles: Car,
  profile: UserRound,
  notifications: Bell,
  customers: Users,
  services: Sparkles,
  pricing: Tags,
  gallery: Images,
  reviews: Star,
  messages: Mail,
  coupons: Tag,
  technicians: Wrench,
  schedule: Clock,
  settings: Settings,
  users: ShieldCheck,
  reports: ChartNoAxesCombined,
  legal: FileText,
} as const;

export type NavIcon = keyof typeof ICONS;
export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  badge?: number;
  exact?: boolean;
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="grid gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-white/[0.08] text-foreground" : "text-foreground/65 hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              <Icon className={cn("size-[18px]", active ? "text-primary" : "")} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.badge ? <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground tabular-nums">{item.badge}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppShell({
  items,
  businessName,
  logoUrl,
  user,
  area,
  extraLink,
  children,
}: {
  items: NavItem[];
  businessName: string;
  logoUrl: string | null;
  user: { name: string | null; email: string; roleLabel: string };
  area: string;
  extraLink?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  const footer = (
    <div className="grid gap-1 border-t border-white/[0.06] p-3">
      {extraLink && (
        <Link href={extraLink.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground/65 hover:bg-white/[0.04] hover:text-foreground">
          <ExternalLink className="size-[18px]" aria-hidden /> {extraLink.label}
        </Link>
      )}
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{initials(user.name ?? user.email)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.name ?? user.email}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.roleLabel}</span>
        </span>
        <form action={signOutAction}>
          <button type="submit" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-white/[0.06] hover:text-foreground" aria-label="Sign out" title="Sign out">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col print:hidden border-r border-white/[0.06] bg-[#0c0c0e] lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo name={businessName} logoUrl={logoUrl} compact />
        </div>
        <p className="px-6 pt-2 pb-2 text-[11px] font-semibold tracking-[0.18em] text-foreground/40 uppercase">{area}</p>
        <nav aria-label={area} className="flex-1 overflow-y-auto px-3 pb-4">
          <NavList items={items} />
        </nav>
        {footer}
      </aside>

      <div className="min-w-0">
        <header className="glass sticky top-0 z-30 flex h-14 print:hidden items-center justify-between border-b border-white/[0.06] px-4 lg:hidden">
          <Logo name={businessName} logoUrl={logoUrl} compact />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="grid size-10 place-items-center rounded-full hover:bg-white/[0.06]" aria-label="Open navigation">
                <Menu className="size-5" />
              </button>
            </DialogTrigger>
            <SheetContent side="left" className="p-0" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
              <DialogTitle className="sr-only">{area} navigation</DialogTitle>
              <DialogDescription className="sr-only">Navigate between sections</DialogDescription>
              <div className="flex h-14 items-center px-5">
                <Logo name={businessName} logoUrl={logoUrl} compact />
              </div>
              <nav aria-label={area} className="flex-1 overflow-y-auto px-3 py-2">
                <NavList items={items} onNavigate={() => setOpen(false)} />
              </nav>
              {footer}
            </SheetContent>
          </Dialog>
        </header>
        <main id="main" className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <div className="mt-1.5 text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

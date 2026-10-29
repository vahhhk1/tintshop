import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/dashboard/shell";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS, can, isStaffRole, type Permission } from "@/lib/auth/roles";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin" }, robots: { index: false, follow: false } };

const NAV: (NavItem & { permission: Permission })[] = [
  { href: "/admin", label: "Dashboard", icon: "overview", exact: true, permission: "admin:access" },
  { href: "/admin/appointments", label: "Appointments", icon: "appointments", permission: "appointments:manage" },
  { href: "/admin/quotes", label: "Quotes", icon: "quotes", permission: "quotes:manage" },
  { href: "/admin/customers", label: "Customers", icon: "customers", permission: "customers:view" },
  { href: "/admin/messages", label: "Messages", icon: "messages", permission: "messages:manage" },
  { href: "/admin/payments", label: "Payments", icon: "payments", permission: "payments:view" },
  { href: "/admin/services", label: "Services", icon: "services", permission: "services:manage" },
  { href: "/admin/pricing", label: "Pricing", icon: "pricing", permission: "pricing:manage" },
  { href: "/admin/gallery", label: "Gallery", icon: "gallery", permission: "gallery:manage" },
  { href: "/admin/reviews", label: "Reviews", icon: "reviews", permission: "reviews:manage" },
  { href: "/admin/coupons", label: "Coupons", icon: "coupons", permission: "coupons:manage" },
  { href: "/admin/technicians", label: "Technicians", icon: "technicians", permission: "technicians:manage" },
  { href: "/admin/schedule", label: "Hours & booking", icon: "schedule", permission: "schedule:manage" },
  { href: "/admin/notifications", label: "Notifications", icon: "notifications", permission: "admin:access" },
  { href: "/admin/settings", label: "Settings", icon: "settings", permission: "settings:business" },
  { href: "/admin/users", label: "Staff accounts", icon: "users", permission: "users:manage" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/admin");
  if (!isStaffRole(user.role)) redirect("/dashboard");
  const [settings, newQuotes, newMessages, pendingReviews, unread] = await Promise.all([
    getSettings(),
    prisma.quote.count({ where: { status: "NEW" } }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.notification.count({ where: { audience: "ADMIN", readAt: null } }),
  ]);
  const badges: Record<string, number> = { "/admin/quotes": newQuotes, "/admin/messages": newMessages, "/admin/reviews": pendingReviews, "/admin/notifications": unread };
  const items = NAV.filter((n) => can(user.role, n.permission)).map(({ permission: _p, ...n }) => ({ ...n, badge: badges[n.href] }));

  return (
    <AppShell
      items={items}
      area="Admin"
      businessName={settings.businessName}
      logoUrl={settings.logoUrl}
      user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }}
      extraLink={{ href: "/", label: "View website" }}
    >
      {children}
    </AppShell>
  );
}

import type { Metadata } from "next";
import { AppShell, type NavItem } from "@/components/dashboard/shell";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS, isStaffRole } from "@/lib/auth/roles";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: { default: "My account", template: "%s | My account" }, robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  const [settings, unread] = await Promise.all([getSettings(), prisma.notification.count({ where: { userId: user.id, readAt: null } })]);
  const items: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: "overview", exact: true },
    { href: "/dashboard/appointments", label: "Appointments", icon: "appointments" },
    { href: "/dashboard/quotes", label: "Quotes", icon: "quotes" },
    { href: "/dashboard/payments", label: "Payments & receipts", icon: "payments" },
    { href: "/dashboard/vehicles", label: "Vehicles", icon: "vehicles" },
    { href: "/dashboard/profile", label: "Profile", icon: "profile" },
    { href: "/dashboard/notifications", label: "Notifications", icon: "notifications", badge: unread },
  ];
  return (
    <AppShell
      items={items}
      area="My account"
      businessName={settings.businessName}
      logoUrl={settings.logoUrl}
      user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }}
      extraLink={isStaffRole(user.role) ? { href: "/admin", label: "Admin dashboard" } : { href: "/book", label: "Book a service" }}
    >
      {children}
    </AppShell>
  );
}

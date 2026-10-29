import Link from "next/link";
import { Bell } from "lucide-react";
import { ActionButton } from "@/components/admin/action-form";
import { PageHeader } from "@/components/dashboard/shell";
import { EmptyState } from "@/components/ui/misc";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { markAdminNotificationsReadAction } from "@/server/admin/content";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Notifications" };

export default async function AdminNotificationsPage() {
  await requirePermission("admin:access", "/admin/notifications");
  const [settings, items, logs] = await Promise.all([
    getSettings(),
    prisma.notification.findMany({ where: { audience: "ADMIN" }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.messageLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <>
      <PageHeader
        title="Notifications"
        description="New bookings, quotes, messages, payments and reviews."
        actions={unread ? <ActionButton variant="outline" size="sm" action={markAdminNotificationsReadAction}>Mark all read</ActionButton> : undefined}
      />
      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <section>
          {items.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications yet" />
          ) : (
            <ul className="grid gap-2">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? "/admin"}
                    className={cn("flex gap-3 rounded-2xl border p-4 transition-colors hover:border-white/20", n.readAt ? "border-white/[0.06] bg-card/60" : "border-white/[0.1] bg-card")}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-medium">{n.title}</span>
                      <span className="block truncate text-sm text-muted-foreground">{n.body}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{formatDateTime(n.createdAt, settings.timezone)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="log-h">
          <h2 id="log-h" className="mb-1 text-lg font-semibold">
            Email &amp; SMS log
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">“Skipped” means the provider isn’t configured yet — see the README.</p>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {logs.map((l) => (
                <li key={l.id} className="rounded-xl border border-white/[0.06] bg-card px-4 py-2.5">
                  <p className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{l.subject ?? l.template}</span>
                    <span className={cn("shrink-0 text-xs", l.status === "SENT" ? "text-emerald-400" : l.status === "FAILED" ? "text-red-400" : "text-muted-foreground")}>
                      {l.channel} · {l.status.toLowerCase()}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.to} · {formatDateTime(l.createdAt, settings.timezone)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

import Link from "next/link";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { MarkReadButton } from "@/components/dashboard/mark-read-button";
import { EmptyState } from "@/components/ui/misc";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { markNotificationsReadAction } from "@/server/customers/actions";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/dashboard/notifications");
  const [settings, notifications] = await Promise.all([
    getSettings(),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const unread = notifications.filter((n) => !n.readAt).length;

  async function markAll() {
    "use server";
    await markNotificationsReadAction();
  }

  return (
    <>
      <PageHeader title="Notifications" description={unread ? `${unread} unread` : "You’re all caught up."} actions={unread ? <MarkReadButton action={markAll} /> : undefined} />
      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="Booking confirmations, reminders and quote responses will show up here." />
      ) : (
        <ul className="grid gap-2">
          {notifications.map((n) => {
            const inner = (
              <>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{n.title}</span>
                  <span className="block text-sm text-muted-foreground">{n.body}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{formatDateTime(n.createdAt, settings.timezone)}</span>
                </span>
                {!n.readAt && <span className="sr-only">Unread</span>}
              </>
            );
            const cls = cn("flex gap-3 rounded-2xl border p-4 transition-colors", n.readAt ? "border-white/[0.06] bg-card/60" : "border-white/[0.1] bg-card");
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className={cn(cls, "hover:border-white/20")}>
                    {inner}
                  </Link>
                ) : (
                  <div className={cls}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

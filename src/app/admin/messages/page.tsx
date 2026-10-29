import Link from "next/link";
import { Archive, Check, Mail, MailOpen, Phone, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { PageHeader } from "@/components/dashboard/shell";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge, statusOptions } from "@/components/ui/status";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { cn, telHref } from "@/lib/utils";
import { deleteMessageAction, setMessageStatusAction, updateMessageNotesAction } from "@/server/admin/content";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Messages" };

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ status?: string; open?: string }> }) {
  const [sp] = await Promise.all([searchParams, requirePermission("messages:manage", "/admin/messages")]);
  const settings = await getSettings();
  const status = sp.status && statusOptions("contact").some((o) => o.value === sp.status) ? sp.status : undefined;
  const messages = await prisma.contactMessage.findMany({
    where: status ? { status: status as "NEW" } : { status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <>
      <PageHeader title="Messages" description="Contact form submissions from the website." />
      <div className="scrollbar-none mb-6 flex gap-2 overflow-x-auto">
        <Link href="/admin/messages" className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm", !status ? "border-primary bg-primary text-primary-foreground" : "border-white/10 text-foreground/70")}>
          Inbox
        </Link>
        {statusOptions("contact").map((o) => (
          <Link
            key={o.value}
            href={`/admin/messages?status=${o.value}`}
            className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm", status === o.value ? "border-primary bg-primary text-primary-foreground" : "border-white/10 text-foreground/70")}
          >
            {o.label}
          </Link>
        ))}
      </div>
      {messages.length === 0 ? (
        <EmptyState icon={Mail} title="No messages here" />
      ) : (
        <ul className="grid gap-3">
          {messages.map((m) => (
            <li key={m.id} id={m.id} className={cn("scroll-mt-24 rounded-2xl border bg-card p-5", sp.open === m.id ? "border-primary/50" : "border-white/[0.07]")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{m.name}</p>
                    <StatusBadge kind="contact" status={m.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: your message to ${settings.businessName}`)}`} className="hover:text-primary">
                      {m.email}
                    </a>
                    {m.phone && (
                      <>
                        {" · "}
                        <a href={telHref(m.phone)} className="inline-flex items-center gap-1 hover:text-primary">
                          <Phone className="size-3" aria-hidden /> {m.phone}
                        </a>
                      </>
                    )}
                    {" · "}
                    {formatDateTime(m.createdAt, settings.timezone)}
                  </p>
                  {(m.vehicle || m.serviceInterest) && (
                    <p className="mt-1 text-xs text-muted-foreground">{[m.vehicle, m.serviceInterest].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {m.status === "NEW" && (
                    <ActionButton size="sm" variant="ghost" action={setMessageStatusAction} args={[m.id, "READ"]}>
                      <MailOpen aria-hidden /> Mark read
                    </ActionButton>
                  )}
                  {m.status !== "REPLIED" && (
                    <ActionButton size="sm" variant="ghost" action={setMessageStatusAction} args={[m.id, "REPLIED"]}>
                      <Check aria-hidden /> Replied
                    </ActionButton>
                  )}
                  {m.status !== "ARCHIVED" && (
                    <ActionButton size="sm" variant="ghost" action={setMessageStatusAction} args={[m.id, "ARCHIVED"]}>
                      <Archive aria-hidden /> Archive
                    </ActionButton>
                  )}
                  <ActionButton size="sm" variant="ghost" className="text-red-300" action={deleteMessageAction} args={[m.id]} confirm="Delete this message?">
                    <Trash2 aria-hidden /> Delete
                  </ActionButton>
                </div>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-line text-foreground/85">{m.message}</p>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Internal notes{m.adminNotes ? " ✓" : ""}</summary>
                <ActionForm action={updateMessageNotesAction} className="mt-3">
                  <input type="hidden" name="id" value={m.id} />
                  <AdminField name="adminNotes" label="Notes">
                    <Textarea name="adminNotes" rows={3} defaultValue={m.adminNotes ?? ""} />
                  </AdminField>
                  <SubmitButton size="sm" variant="outline" className="justify-self-start">
                    Save
                  </SubmitButton>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

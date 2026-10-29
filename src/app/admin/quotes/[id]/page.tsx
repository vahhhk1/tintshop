import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, Mail, Phone } from "lucide-react";
import { ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { StatusBadge, statusOptions } from "@/components/ui/status";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { centsToDollarsInput, formatCurrency, telHref } from "@/lib/utils";
import { respondToQuoteAction, updateQuoteNotesAction, updateQuoteStatusAction } from "@/server/admin/quotes";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Quote" };

export default async function AdminQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("quotes:manage", `/admin/quotes/${id}`);
  const [q, settings] = await Promise.all([
    prisma.quote.findUnique({
      where: { id },
      include: {
        service: { select: { name: true } },
        serviceOption: { select: { name: true } },
        filmType: { select: { name: true } },
        vehicleType: { select: { name: true } },
        vehicleSize: { select: { name: true } },
        items: true,
        appointment: { select: { id: true, reference: true } },
      },
    }),
    getSettings(),
  ]);
  if (!q) notFound();
  const tz = settings.timezone;

  return (
    <>
      <Link href="/admin/quotes" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Quotes
      </Link>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">{q.name}</h1>
        <StatusBadge kind="quote" status={q.status} />
        <span className="text-sm text-muted-foreground">
          {q.reference} · {formatDateTime(q.createdAt, tz)}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-6">
          <section className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <h2 className="mb-4 font-semibold">Request</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Service", [q.service?.name, q.serviceOption?.name].filter(Boolean).join(" — ") || "—"],
                ["Film", q.filmType ? `${q.filmType.name}${q.shade ? ` · ${q.shade}%` : ""}` : "—"],
                ["Vehicle", [q.vehicleYear, q.vehicleMake, q.vehicleModel].filter(Boolean).join(" ") || "—"],
                ["Type / size", [q.vehicleType?.name, q.vehicleSize?.name].filter(Boolean).join(" · ") || "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {q.notes && <p className="mt-4 rounded-xl bg-white/[0.03] p-4 text-sm whitespace-pre-line text-foreground/80">“{q.notes}”</p>}
            <ul className="mt-5 grid gap-1.5 border-t border-white/[0.06] pt-4 text-sm">
              {q.items.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span className="text-foreground/80">{i.label}</span>
                  <span className="tabular-nums">{formatCurrency(i.total, { exact: true })}</span>
                </li>
              ))}
              <li className="mt-2 flex justify-between font-semibold">
                <span>Online estimate (pre-tax)</span>
                <span className="tabular-nums">{formatCurrency(q.estimatedTotal, { exact: true })}</span>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <h2 className="mb-1 font-semibold">Send a response</h2>
            <p className="mb-4 text-sm text-muted-foreground">Emails the customer and marks the quote “Estimate sent”.</p>
            {q.responseMessage && (
              <div className="mb-5 rounded-xl border-l-2 border-primary/60 bg-white/[0.03] p-4 text-sm">
                <p className="text-xs text-muted-foreground">Last sent {q.respondedAt ? formatDateTime(q.respondedAt, tz) : ""}</p>
                <p className="mt-1 whitespace-pre-line">{q.responseMessage}</p>
              </div>
            )}
            <ActionForm action={respondToQuoteAction}>
              <input type="hidden" name="quoteId" value={q.id} />
              <AdminField name="quotedPrice" label="Quoted price ($, before tax)" hint="Leave blank to keep the online estimate">
                <Input name="quotedPrice" inputMode="decimal" defaultValue={centsToDollarsInput(q.quotedPrice ?? q.estimatedTotal)} />
              </AdminField>
              <AdminField name="message" label="Message" required>
                <Textarea
                  name="message"
                  rows={6}
                  defaultValue={`Hi ${q.name.split(" ")[0]},\n\nThanks for your quote request! Based on your ${[q.vehicleYear, q.vehicleMake, q.vehicleModel].filter(Boolean).join(" ")}, here’s our price including installation and warranty.\n\nYou can book online any time or reply to this email with questions.`}
                />
              </AdminField>
              <SubmitButton className="justify-self-start">Send response</SubmitButton>
            </ActionForm>
          </section>
        </div>

        <div className="grid content-start gap-6">
          <section className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <h2 className="mb-4 font-semibold">Contact</h2>
            <div className="grid gap-2 text-sm">
              <a href={telHref(q.phone)} className="flex items-center gap-2 hover:text-primary">
                <Phone className="size-4" aria-hidden /> {q.phone}
              </a>
              <a href={`mailto:${q.email}`} className="flex items-center gap-2 hover:text-primary">
                <Mail className="size-4" aria-hidden /> {q.email}
              </a>
            </div>
            {q.appointment ? (
              <Button asChild variant="outline" className="mt-5 w-full">
                <Link href={`/admin/appointments/${q.appointment.id}`}>View appointment {q.appointment.reference}</Link>
              </Button>
            ) : (
              <Button asChild className="mt-5 w-full">
                <Link href={`/admin/appointments/new?quote=${q.id}`}>
                  <CalendarPlus aria-hidden /> Convert to appointment
                </Link>
              </Button>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <ActionForm action={updateQuoteStatusAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="quoteId" value={q.id} />
              <AdminField name="status" label="Status" className="min-w-48 flex-1">
                <NativeSelect name="status" defaultValue={q.status}>
                  {statusOptions("quote").map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </AdminField>
              <SubmitButton variant="outline" className="h-11">
                Update
              </SubmitButton>
            </ActionForm>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <ActionForm action={updateQuoteNotesAction}>
              <input type="hidden" name="quoteId" value={q.id} />
              <AdminField name="adminNotes" label="Internal notes">
                <Textarea name="adminNotes" rows={4} defaultValue={q.adminNotes ?? ""} />
              </AdminField>
              <SubmitButton variant="outline" className="justify-self-start">
                Save notes
              </SubmitButton>
            </ActionForm>
          </section>
        </div>
      </div>
    </>
  );
}

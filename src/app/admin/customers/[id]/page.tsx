import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, Mail, MapPin, Phone } from "lucide-react";
import { ActionButton, ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { AppointmentRow } from "@/components/dashboard/appointment-row";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { StatTile } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { formatDate, formatDateTime } from "@/lib/time";
import { formatCurrency, telHref } from "@/lib/utils";
import { setCustomerActiveAction, updateCustomerNotesAction } from "@/server/admin/customers";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Customer" };

export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requirePermission("customers:view", `/admin/customers/${id}`);
  const [c, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        vehicles: { include: { vehicleType: { select: { name: true } } } },
        appointments: { orderBy: { startsAt: "desc" }, include: { service: { select: { name: true } }, serviceOption: { select: { name: true } } } },
        quotes: { orderBy: { createdAt: "desc" }, include: { service: { select: { name: true } } } },
        payments: { orderBy: { createdAt: "desc" }, include: { appointment: { select: { reference: true } } } },
        reviews: { orderBy: { createdAt: "desc" } },
      },
    }),
    getSettings(),
  ]);
  if (!c) notFound();
  const tz = settings.timezone;
  const spent = c.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amount, 0);
  const canManage = can(viewer.role, "customers:manage");
  const p = c.profile;

  return (
    <>
      <Link href="/admin/customers" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Customers
      </Link>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{c.name ?? c.email}</h1>
          <p className="text-sm text-muted-foreground">
            Customer since {formatDate(c.createdAt, tz)} {c.lastLoginAt ? `· last sign-in ${formatDateTime(c.lastLoginAt, tz)}` : ""} {!c.isActive && "· disabled"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/admin/appointments/new?customer=${c.id}`}>
              <CalendarPlus aria-hidden /> Book for customer
            </Link>
          </Button>
          {canManage && c.role === "CUSTOMER" && (
            <ActionButton variant="outline" action={setCustomerActiveAction} args={[c.id, !c.isActive]}>
              {c.isActive ? "Disable account" : "Enable account"}
            </ActionButton>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Appointments" value={c.appointments.length} />
        <StatTile label="Total spent" value={formatCurrency(spent)} />
        <StatTile label="Vehicles" value={c.vehicles.length} />
        <StatTile label="Quotes" value={c.quotes.length} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="grid content-start gap-6">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Appointment history</h2>
            {c.appointments.length ? (
              <ul className="grid gap-2">
                {c.appointments.map((a) => (
                  <AppointmentRow key={a.id} a={a} href={`/admin/appointments/${a.id}`} timeZone={tz} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No appointments yet.</p>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold">Quotes</h2>
            {c.quotes.length ? (
              <ul className="grid gap-2 text-sm">
                {c.quotes.map((q) => (
                  <li key={q.id}>
                    <Link href={`/admin/quotes/${q.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-card px-4 py-3 hover:border-white/15">
                      <span>
                        {q.service?.name ?? "Quote"} · {q.reference}
                      </span>
                      <span className="flex items-center gap-3">
                        <StatusBadge kind="quote" status={q.status} />
                        <span className="tabular-nums">{formatCurrency(q.quotedPrice ?? q.estimatedTotal)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No quotes.</p>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold">Payments</h2>
            {c.payments.length ? (
              <ul className="grid gap-2 text-sm">
                {c.payments.map((pay) => (
                  <li key={pay.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-card px-4 py-3">
                    <span>
                      {pay.paidAt ? formatDate(pay.paidAt, tz) : formatDate(pay.createdAt, tz)} · {pay.appointment.reference} · <span className="capitalize">{pay.type.toLowerCase()}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <StatusBadge kind="payment" status={pay.status} />
                      <span className="tabular-nums">{formatCurrency(pay.amount, { exact: true })}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No payments.</p>
            )}
          </section>
        </div>

        <div className="grid content-start gap-6">
          <section className="rounded-2xl border border-white/[0.07] bg-card p-6 text-sm">
            <h2 className="mb-4 font-semibold">Contact</h2>
            <div className="grid gap-2">
              <a href={`mailto:${c.email}`} className="flex items-center gap-2 hover:text-primary">
                <Mail className="size-4" aria-hidden /> {c.email}
              </a>
              {c.phone && (
                <a href={telHref(c.phone)} className="flex items-center gap-2 hover:text-primary">
                  <Phone className="size-4" aria-hidden /> {c.phone}
                </a>
              )}
              {p?.addressLine1 && (
                <p className="flex items-start gap-2 text-foreground/80">
                  <MapPin className="mt-0.5 size-4" aria-hidden /> {[p.addressLine1, p.addressLine2, p.city, p.state, p.postalCode].filter(Boolean).join(", ")}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Prefers {p?.preferredContact ?? "any"} · Email {p?.emailNotifications === false ? "off" : "on"} · SMS {p?.smsOptIn ? "on" : "off"} · Marketing {p?.marketingOptIn ? "on" : "off"}
              </p>
            </div>
          </section>
          <section className="rounded-2xl border border-white/[0.07] bg-card p-6">
            <h2 className="mb-4 font-semibold">Vehicles</h2>
            {c.vehicles.length ? (
              <ul className="grid gap-3 text-sm">
                {c.vehicles.map((v) => (
                  <li key={v.id}>
                    <p className="font-medium">
                      {v.year} {v.make} {v.model}
                    </p>
                    <p className="text-xs text-muted-foreground">{[v.color, v.vehicleType?.name, v.vin].filter(Boolean).join(" · ")}</p>
                    {v.notes && <p className="text-xs text-muted-foreground">{v.notes}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No saved vehicles.</p>
            )}
          </section>
          <section className="rounded-2xl border border-white/[0.07] bg-card p-6">
            {canManage ? (
              <ActionForm action={updateCustomerNotesAction}>
                <input type="hidden" name="userId" value={c.id} />
                <AdminField name="adminNotes" label="Internal notes" hint="Only visible to staff">
                  <Textarea name="adminNotes" rows={5} defaultValue={p?.adminNotes ?? ""} />
                </AdminField>
                <SubmitButton variant="outline" className="justify-self-start">
                  Save notes
                </SubmitButton>
              </ActionForm>
            ) : (
              <>
                <h2 className="mb-2 font-semibold">Internal notes</h2>
                <p className="text-sm whitespace-pre-line text-muted-foreground">{p?.adminNotes ?? "—"}</p>
              </>
            )}
          </section>
          {c.reviews.length > 0 && (
            <section className="rounded-2xl border border-white/[0.07] bg-card p-6 text-sm">
              <h2 className="mb-3 font-semibold">Reviews</h2>
              {c.reviews.map((r) => (
                <p key={r.id} className="mb-2">
                  {r.rating}★ — {r.title ?? r.body.slice(0, 60)} <StatusBadge kind="review" status={r.status} />
                </p>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  );
}

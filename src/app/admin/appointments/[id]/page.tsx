import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Phone, UserRound } from "lucide-react";
import { ActionButton, ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { OrderSummary } from "@/components/checkout/order-summary";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { StatusBadge, statusOptions } from "@/components/ui/status";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { formatDateTime, formatLongDate, formatTime, toHm, toYmd } from "@/lib/time";
import { centsToDollarsInput, formatCurrency, telHref } from "@/lib/utils";
import { findAppointmentDetail } from "@/server/appointments/access";
import {
  adminRescheduleAction,
  assignTechnicianAction,
  recordManualPaymentAction,
  refundAppointmentAction,
  updateAppointmentDetailsAction,
  updateAppointmentStatusAction,
} from "@/server/admin/appointments";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Appointment" };

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/[0.07] bg-card p-5 sm:p-6 ${className ?? ""}`}>
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function AdminAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("appointments:manage", `/admin/appointments/${id}`);
  const [a, settings, technicians] = await Promise.all([
    findAppointmentDetail(id),
    getSettings(),
    prisma.technician.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!a) notFound();
  const tz = settings.timezone;
  const customer = a.userId
    ? await prisma.user.findUnique({ where: { id: a.userId }, select: { id: true, name: true, _count: { select: { appointments: true } } } })
    : null;
  const canPay = can(user.role, "payments:manage");
  const balance = Math.max(0, a.total - a.amountPaid);
  const onlinePaid = a.payments.some((p) => p.status === "SUCCEEDED" && p.provider !== "MANUAL");

  return (
    <>
      <Link href="/admin/appointments" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Appointments
      </Link>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {formatLongDate(a.startsAt, tz)} · {formatTime(a.startsAt, tz)}–{formatTime(a.endsAt, tz)}
        </h1>
        <StatusBadge kind="appointment" status={a.status} />
        <span className="text-sm text-muted-foreground">
          {a.reference} · {a.source.toLowerCase()} · created {formatDateTime(a.createdAt, tz)}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-6">
          <OrderSummary a={a} timeZone={tz} currency={settings.currency} />

          <Panel title="Payments">
            {a.payments.length ? (
              <ul className="divide-y divide-white/[0.06] text-sm">
                {a.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">
                        {formatCurrency(p.amount, { exact: true })} · <span className="capitalize">{p.type.toLowerCase()}</span> · {p.provider.toLowerCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.receiptNumber} · {p.paidAt ? formatDateTime(p.paidAt, tz) : formatDateTime(p.createdAt, tz)} {p.method ? `· ${p.method}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge kind="payment" status={p.status} />
                      {(p.status === "SUCCEEDED" || p.status === "REFUNDED") && (
                        <Link href={`/dashboard/receipts/${p.id}`} className="text-xs text-primary hover:underline">
                          Receipt
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            )}
            {canPay && (
              <div className="mt-5 grid gap-4 border-t border-white/[0.06] pt-5">
                <ActionForm action={recordManualPaymentAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" resetOnSuccess>
                  <input type="hidden" name="appointmentId" value={a.id} />
                  <AdminField name="amount" label="Record payment ($)" required>
                    <Input name="amount" inputMode="decimal" defaultValue={centsToDollarsInput(balance)} />
                  </AdminField>
                  <AdminField name="type" label="Type">
                    <NativeSelect name="type" defaultValue={a.amountPaid > 0 ? "BALANCE" : "FULL"}>
                      <option value="DEPOSIT">Deposit</option>
                      <option value="FULL">Full</option>
                      <option value="BALANCE">Balance</option>
                    </NativeSelect>
                  </AdminField>
                  <AdminField name="method" label="Method" required>
                    <Input name="method" defaultValue="Card terminal" />
                  </AdminField>
                  <SubmitButton variant="outline" className="h-11">
                    Record
                  </SubmitButton>
                </ActionForm>
                {onlinePaid && (
                  <ActionButton variant="ghost" size="sm" className="justify-self-start text-red-300" action={refundAppointmentAction} args={[a.id]}>
                    Refund online payments
                  </ActionButton>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Customer & vehicle details">
            <ActionForm action={updateAppointmentDetailsAction}>
              <input type="hidden" name="appointmentId" value={a.id} />
              <div className="grid gap-4 sm:grid-cols-3">
                <AdminField name="customerName" label="Name" required>
                  <Input name="customerName" defaultValue={a.customerName} />
                </AdminField>
                <AdminField name="customerEmail" label="Email" required>
                  <Input name="customerEmail" type="email" defaultValue={a.customerEmail} />
                </AdminField>
                <AdminField name="customerPhone" label="Phone" required>
                  <Input name="customerPhone" defaultValue={a.customerPhone} />
                </AdminField>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <AdminField name="vehicleYear" label="Year" required>
                  <Input name="vehicleYear" defaultValue={a.vehicleYear ?? ""} />
                </AdminField>
                <AdminField name="vehicleMake" label="Make" required>
                  <Input name="vehicleMake" defaultValue={a.vehicleMake ?? ""} />
                </AdminField>
                <AdminField name="vehicleModel" label="Model" required>
                  <Input name="vehicleModel" defaultValue={a.vehicleModel ?? ""} />
                </AdminField>
                <AdminField name="vehicleColor" label="Color">
                  <Input name="vehicleColor" defaultValue={a.vehicleColor ?? ""} />
                </AdminField>
              </div>
              <AdminField name="customerNotes" label="Customer notes">
                <Textarea name="customerNotes" rows={2} defaultValue={a.customerNotes ?? ""} />
              </AdminField>
              <AdminField name="internalNotes" label="Internal notes" hint="Only visible to staff">
                <Textarea name="internalNotes" rows={4} defaultValue={a.internalNotes ?? ""} />
              </AdminField>
              <SubmitButton className="justify-self-start">Save details</SubmitButton>
            </ActionForm>
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Customer">
            <div className="grid gap-2 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <UserRound className="size-4 text-primary" aria-hidden /> {a.customerName}
                {customer ? (
                  <Link href={`/admin/customers/${customer.id}`} className="text-xs text-primary hover:underline">
                    View profile ({customer._count.appointments} bookings)
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">Guest</span>
                )}
              </p>
              <a href={telHref(a.customerPhone)} className="flex items-center gap-2 text-foreground/80 hover:text-primary">
                <Phone className="size-4" aria-hidden /> {a.customerPhone}
              </a>
              <a href={`mailto:${a.customerEmail}`} className="flex items-center gap-2 text-foreground/80 hover:text-primary">
                <Mail className="size-4" aria-hidden /> {a.customerEmail}
              </a>
              <Link href={`/manage/${encodeURIComponent(a.manageToken)}`} target="_blank" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                <ExternalLink className="size-3.5" aria-hidden /> Customer’s manage page
              </Link>
            </div>
          </Panel>

          <Panel title="Status">
            <ActionForm action={updateAppointmentStatusAction}>
              <input type="hidden" name="appointmentId" value={a.id} />
              <AdminField name="status" label="Set status">
                <NativeSelect name="status" defaultValue={a.status}>
                  {statusOptions("appointment").map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </AdminField>
              <AdminField name="reason" label="Reason / note" hint="Used for cancellations">
                <Input name="reason" />
              </AdminField>
              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox name="notifyCustomer" defaultChecked /> Notify customer (confirmed, completed or cancelled)
              </label>
              {canPay && onlinePaid && (
                <label className="flex items-center gap-2.5 text-sm">
                  <Checkbox name="refund" /> Refund online payments when cancelling
                </label>
              )}
              <SubmitButton className="justify-self-start">Update status</SubmitButton>
            </ActionForm>
          </Panel>

          <Panel title="Reschedule">
            <ActionForm action={adminRescheduleAction}>
              <input type="hidden" name="appointmentId" value={a.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminField name="date" label="Date" required>
                  <Input type="date" name="date" defaultValue={toYmd(a.startsAt, tz)} />
                </AdminField>
                <AdminField name="time" label="Start time" required>
                  <Input type="time" name="time" step={900} defaultValue={toHm(a.startsAt, tz)} />
                </AdminField>
              </div>
              <AdminField name="technicianId" label="Technician">
                <NativeSelect name="technicianId" defaultValue={a.technicianId ?? ""}>
                  <option value="">Keep / auto-assign</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              </AdminField>
              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox name="allowOverlap" /> Allow overlap (ignore availability)
              </label>
              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox name="notifyCustomer" defaultChecked /> Notify customer
              </label>
              <SubmitButton variant="outline" className="justify-self-start">
                Reschedule
              </SubmitButton>
            </ActionForm>
          </Panel>

          <Panel title="Technician">
            <ActionForm action={assignTechnicianAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="appointmentId" value={a.id} />
              <AdminField name="technicianId" label="Assigned to" className="min-w-48 flex-1">
                <NativeSelect name="technicianId" defaultValue={a.technicianId ?? ""}>
                  <option value="">Unassigned</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              </AdminField>
              <SubmitButton variant="outline" className="h-11">
                Assign
              </SubmitButton>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}

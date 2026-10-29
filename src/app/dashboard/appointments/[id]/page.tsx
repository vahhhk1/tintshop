import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { AppointmentManager } from "@/components/booking/appointment-manager";
import { OrderSummary } from "@/components/checkout/order-summary";
import { StatusBadge } from "@/components/ui/status";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, formatLongDate, formatTime } from "@/lib/time";
import { formatCurrency } from "@/lib/utils";
import { findAppointmentDetail } from "@/server/appointments/access";
import { buildManageProps } from "@/server/appointments/manage";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Appointment" };

export default async function MyAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/appointments/${id}`);
  const [a, settings] = await Promise.all([findAppointmentDetail(id), getSettings()]);
  if (!a || a.userId !== user.id) notFound();
  const props = buildManageProps(a, settings, user);
  const payments = a.payments.filter((p) => p.status !== "CANCELLED");

  return (
    <>
      <Link href="/dashboard/appointments" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All appointments
      </Link>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {formatLongDate(a.startsAt, settings.timezone)} · {formatTime(a.startsAt, settings.timezone)}
        </h1>
        <StatusBadge kind="appointment" status={a.status} />
      </div>
      <div className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <div className="grid content-start gap-8">
          <OrderSummary a={a} timeZone={settings.timezone} currency={settings.currency} />
          {payments.length > 0 && (
            <section aria-labelledby="pay-h" className="rounded-3xl border border-white/[0.08] bg-card p-6">
              <h2 id="pay-h" className="font-semibold">
                Payments
              </h2>
              <ul className="mt-4 divide-y divide-white/[0.06] text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">
                        {formatCurrency(p.amount, { exact: true })} · {p.type.toLowerCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.paidAt ? formatDateTime(p.paidAt, settings.timezone) : "—"} · {p.method ?? p.provider}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge kind="payment" status={p.status} />
                      {p.status === "SUCCEEDED" || p.status === "REFUNDED" ? (
                        <Link href={`/dashboard/receipts/${p.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <Receipt className="size-4" aria-hidden /> Receipt
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="xl:self-start">
          <div className="rounded-3xl border border-white/[0.08] bg-card p-6">
            <h2 className="mb-4 font-semibold">Manage</h2>
            <AppointmentManager {...props} />
          </div>
          {a.customerNotes && (
            <div className="mt-4 rounded-3xl border border-white/[0.08] bg-card p-6 text-sm">
              <h2 className="font-semibold">Your notes</h2>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{a.customerNotes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, CheckCircle2, Clock, Settings2 } from "lucide-react";
import { OrderSummary } from "@/components/checkout/order-summary";
import { TrackOnMount } from "@/components/analytics/analytics";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { formatLongDate, formatTime } from "@/lib/time";
import { findAppointmentDetail, tokenMatches, type AppointmentDetail } from "@/server/appointments/access";
import { fulfillCheckoutSession } from "@/server/payments/fulfill";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Booking confirmed", robots: { index: false } };

type Resolved = { appointment: AppointmentDetail; paid: boolean; pending: boolean; amount?: number };

async function resolve(sp: { session_id?: string; payment?: string; appointment?: string; t?: string }): Promise<Resolved | null> {
  if (sp.session_id) {
    // Verified directly with Stripe — never trusts query parameters for payment status.
    const result = await fulfillCheckoutSession(sp.session_id).catch((e) => {
      console.error("[success] verify failed", e);
      return null;
    });
    if (!result || result.status === "unconfigured" || result.status === "unknown") return null;
    const appointment = await findAppointmentDetail(result.appointmentId);
    if (!appointment) return null;
    const payment = await prisma.payment.findUnique({ where: { id: result.paymentId }, select: { amount: true } });
    return { appointment, paid: result.status === "paid", pending: result.status === "pending", amount: payment?.amount };
  }
  if (sp.payment && sp.t) {
    const payment = await prisma.payment.findUnique({ where: { id: sp.payment } });
    if (!payment) return null;
    const appointment = await findAppointmentDetail(payment.appointmentId);
    if (!appointment || !tokenMatches(appointment.manageToken, sp.t)) return null;
    return { appointment, paid: payment.status === "SUCCEEDED", pending: payment.status === "PENDING", amount: payment.amount };
  }
  if (sp.appointment && sp.t) {
    const appointment = await findAppointmentDetail(sp.appointment);
    if (!appointment || !tokenMatches(appointment.manageToken, sp.t)) return null;
    return { appointment, paid: false, pending: false };
  }
  return null;
}

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string; payment?: string; appointment?: string; t?: string }> }) {
  const sp = await searchParams;
  const [resolved, settings, user] = await Promise.all([resolve(sp), getSettings(), getSessionUser().catch(() => null)]);
  if (!resolved) notFound();
  const { appointment: a, paid, pending } = resolved;
  const token = encodeURIComponent(a.manageToken);
  const manageHref = user && a.userId === user.id ? `/dashboard/appointments/${a.id}` : `/manage/${token}`;

  return (
    <div className="container-page pt-28 pb-24 sm:pt-36">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          {pending ? <Clock className="mx-auto size-16 text-amber-400" aria-hidden /> : <CheckCircle2 className="mx-auto size-16 text-emerald-400" aria-hidden />}
          <h1 className="mt-6 text-3xl font-semibold sm:text-5xl">{pending ? "Payment processing…" : paid ? "You’re booked!" : "Booking received"}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            {pending
              ? "We’re waiting for confirmation from the payment provider. This page will update once it’s confirmed — you’ll also get an email."
              : `${formatLongDate(a.startsAt, settings.timezone)} at ${formatTime(a.startsAt, settings.timezone)}. A confirmation has been sent to ${a.customerEmail}.`}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Booking reference <strong className="text-foreground">{a.reference}</strong>
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href={`/api/appointments/${a.id}/ics?t=${token}`}>
                <CalendarPlus aria-hidden /> Add to calendar
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={manageHref}>
                <Settings2 aria-hidden /> Manage booking
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-[1.2fr_1fr]">
          <OrderSummary a={a} timeZone={settings.timezone} currency={settings.currency} />
          <div className="grid content-start gap-4">
            <div className="rounded-3xl border border-white/[0.08] bg-card p-6">
              <h2 className="font-semibold">Before your appointment</h2>
              <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
                <li>• Please arrive 5–10 minutes early.</li>
                <li>• Remove personal items from door pockets and the rear deck.</li>
                <li>• Plan to keep windows up for 3–5 days after tinting.</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-white/[0.08] bg-card p-6 text-sm text-muted-foreground">
              <h2 className="font-semibold text-foreground">Need to make a change?</h2>
              <p className="mt-2">{settings.cancellationPolicy}</p>
            </div>
            {!user && (
              <div className="rounded-3xl border border-primary/30 bg-primary/[0.06] p-6 text-sm">
                <h2 className="font-semibold">Create an account</h2>
                <p className="mt-2 text-muted-foreground">Track appointments, receipts and vehicles in one place.</p>
                <Button asChild size="sm" className="mt-4">
                  <Link href="/register">Create account</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      {paid ? <TrackOnMount event="payment_completed" params={{ reference: a.reference, value: (resolved.amount ?? 0) / 100 }} /> : null}
    </div>
  );
}

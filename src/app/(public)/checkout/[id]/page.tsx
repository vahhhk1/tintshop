import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Clock, Lock } from "lucide-react";
import { CheckoutPanel } from "@/components/checkout/checkout-panel";
import { OrderSummary } from "@/components/checkout/order-summary";
import { Button } from "@/components/ui/button";
import { getPaymentMode } from "@/lib/stripe";
import { formatTime } from "@/lib/time";
import { getAppointmentForViewer, isHoldExpired } from "@/server/appointments/access";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

const CLOSED = ["CANCELLED", "COMPLETED", "NO_SHOW"];

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; type?: string; cancelled?: string }>;
}) {
  const [{ id }, sp, settings] = await Promise.all([params, searchParams, getSettings()]);
  const access = await getAppointmentForViewer(id, sp.t);
  if (!access) notFound();
  const a = access.appointment;
  const expired = isHoldExpired(a);
  const closed = CLOSED.includes(a.status);
  const paidInFull = a.amountPaid >= a.total;
  const manageHref = a.userId ? `/dashboard/appointments/${a.id}` : `/manage/${encodeURIComponent(a.manageToken)}`;

  return (
    <div className="container-page pt-28 pb-24 sm:pt-36">
      <div className="mx-auto max-w-5xl">
        <p className="eyebrow">Secure checkout</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Complete your booking</h1>
        {sp.cancelled && !paidInFull && (
          <p className="mt-6 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> Payment was cancelled — no charge was made. You can try again below.
          </p>
        )}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <OrderSummary a={a} timeZone={settings.timezone} currency={settings.currency} />
          <div className="rounded-3xl border border-white/[0.08] bg-card p-6 sm:p-8 lg:self-start">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Lock className="size-5 text-primary" aria-hidden /> Payment
            </h2>
            <div className="mt-6">
              {closed ? (
                <p className="text-muted-foreground">This appointment is {a.status.toLowerCase().replace("_", " ")} and can’t be paid online.</p>
              ) : expired ? (
                <div className="grid gap-4">
                  <p className="text-muted-foreground">Your reservation expired before payment was completed, so the time was released.</p>
                  <Button asChild>
                    <Link href="/book">Choose a new time</Link>
                  </Button>
                </div>
              ) : paidInFull ? (
                <div className="grid gap-4">
                  <p className="text-muted-foreground">This booking is fully paid. Thank you!</p>
                  <Button asChild variant="outline">
                    <Link href={manageHref}>View booking</Link>
                  </Button>
                </div>
              ) : (
                <>
                  {a.holdExpiresAt && a.amountPaid === 0 && (
                    <p className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="size-4 text-primary" aria-hidden /> We’re holding your time until {formatTime(a.holdExpiresAt, settings.timezone)}.
                    </p>
                  )}
                  <CheckoutPanel
                    appointmentId={a.id}
                    token={sp.t ?? null}
                    initialType={sp.type === "FULL" ? "FULL" : "DEPOSIT"}
                    deposit={a.depositAmount}
                    total={a.total}
                    amountPaid={a.amountPaid}
                    allowPayInFull={settings.allowPayInFull}
                    couponCode={a.coupon?.code ?? null}
                    currency={settings.currency}
                    mode={getPaymentMode()}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

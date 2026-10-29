import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { DemoPayButton } from "@/components/checkout/demo-pay-button";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { formatCurrency } from "@/lib/utils";
import { tokenMatches } from "@/server/appointments/access";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Demo checkout", robots: { index: false } };

/**
 * Simulated payment gateway for local development (Stripe not configured and
 * ALLOW_DEMO_PAYMENTS=true). Disabled in production.
 */
export default async function DemoCheckoutPage({ searchParams }: { searchParams: Promise<{ payment?: string; t?: string }> }) {
  if (!env.demoPaymentsEnabled) notFound();
  const sp = await searchParams;
  if (!sp.payment || !sp.t) notFound();
  const payment = await prisma.payment.findUnique({ where: { id: sp.payment }, include: { appointment: { select: { manageToken: true, reference: true, id: true } } } });
  if (!payment || payment.provider !== "DEMO" || !tokenMatches(payment.appointment.manageToken, sp.t)) notFound();
  const settings = await getSettings();
  const amount = formatCurrency(payment.amount, { currency: settings.currency, exact: true });

  return (
    <div className="container-page grid min-h-[80vh] place-items-center pt-28 pb-20">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-8">
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <FlaskConical className="size-5 shrink-0" aria-hidden />
          Demo payment — Stripe is not configured. No card is charged.
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          {settings.businessName} · Booking {payment.appointment.reference}
        </p>
        <p className="mt-1 font-display text-4xl font-semibold">{amount}</p>
        <p className="text-sm text-muted-foreground">{payment.type === "DEPOSIT" ? "Deposit" : payment.type === "BALANCE" ? "Remaining balance" : "Payment in full"}</p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <p className="text-muted-foreground">Test card</p>
          <p className="mt-1 font-mono tracking-widest">•••• •••• •••• 4242</p>
        </div>
        <div className="mt-8">
          <DemoPayButton paymentId={payment.id} token={sp.t} label={`Pay ${amount}`} />
        </div>
        <Link href={`/checkout/${payment.appointment.id}?t=${encodeURIComponent(sp.t)}&cancelled=1`} className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">
          Cancel and go back
        </Link>
      </div>
    </div>
  );
}

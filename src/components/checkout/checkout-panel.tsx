"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Lock, ShieldCheck, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChoiceCard } from "@/components/booking/configurator";
import { track } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import { applyCouponAction, removeCouponAction, startCheckoutAction } from "@/server/payments/actions";

type PayType = "DEPOSIT" | "FULL" | "BALANCE";

export function CheckoutPanel({
  appointmentId,
  token,
  initialType,
  deposit,
  total,
  amountPaid,
  allowPayInFull,
  couponCode,
  currency,
  mode,
}: {
  appointmentId: string;
  token: string | null;
  initialType: PayType;
  deposit: number;
  total: number;
  amountPaid: number;
  allowPayInFull: boolean;
  couponCode: string | null;
  currency: string;
  mode: "stripe" | "demo" | "offline";
}) {
  const router = useRouter();
  const isBalance = amountPaid > 0;
  const [type, setType] = React.useState<PayType>(isBalance ? "BALANCE" : initialType === "FULL" && allowPayInFull ? "FULL" : "DEPOSIT");
  const [code, setCode] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [couponPending, startCoupon] = React.useTransition();
  const due = type === "BALANCE" ? total - amountPaid : type === "FULL" ? total : Math.min(deposit, total);

  function pay() {
    startTransition(async () => {
      const res = await startCheckoutAction({ appointmentId, token, paymentType: type });
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "Could not start checkout." : res.error);
        return;
      }
      track("checkout_started", { type, value: due / 100 });
      window.location.assign(res.data.url);
    });
  }

  function applyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    startCoupon(async () => {
      const res = await applyCouponAction({ appointmentId, token, code });
      if (res.ok) {
        toast.success(res.message ?? "Code applied");
        setCode("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function removeCode() {
    startCoupon(async () => {
      const res = await removeCouponAction({ appointmentId, token });
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  if (mode === "offline") {
    return <p className="rounded-2xl border border-white/10 p-5 text-sm text-muted-foreground">Online payments are currently unavailable. Your appointment is reserved — please pay at the shop.</p>;
  }

  return (
    <div className="grid gap-6">
      {!isBalance && (
        <div role="radiogroup" aria-label="Amount to pay" className="grid gap-3">
          <ChoiceCard
            selected={type === "DEPOSIT"}
            onSelect={() => setType("DEPOSIT")}
            icon={<CreditCard className="size-5" />}
            title={`Deposit — ${formatCurrency(Math.min(deposit, total), { currency, exact: true })}`}
            description={`Remaining ${formatCurrency(Math.max(0, total - deposit), { currency, exact: true })} due at pickup.`}
          />
          {allowPayInFull && (
            <ChoiceCard
              selected={type === "FULL"}
              onSelect={() => setType("FULL")}
              icon={<ShieldCheck className="size-5" />}
              title={`Pay in full — ${formatCurrency(total, { currency, exact: true })}`}
              description="Nothing to pay at pickup."
            />
          )}
        </div>
      )}

      {!isBalance && (
        <div>
          {couponCode ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-emerald-300">
                <Tag className="size-4" aria-hidden /> Code <strong>{couponCode}</strong> applied
              </span>
              <button type="button" onClick={removeCode} disabled={couponPending} className="rounded-full p-1 hover:bg-white/10" aria-label="Remove code">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={applyCode} className="flex gap-2">
              <label htmlFor="coupon" className="sr-only">
                Promo code
              </label>
              <Input id="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Promo code" autoComplete="off" className="uppercase" />
              <Button type="submit" variant="outline" loading={couponPending} className="h-11 shrink-0">
                Apply
              </Button>
            </form>
          )}
        </div>
      )}

      <Button size="xl" onClick={pay} loading={pending} className="w-full">
        {!pending && <Lock aria-hidden />} Pay {formatCurrency(due, { currency, exact: true })}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {mode === "stripe"
          ? "You’ll enter your card and billing details on Stripe’s secure checkout. We never see your full card number."
          : "Demo mode — Stripe isn’t configured, so payment is simulated. No card is charged."}
      </p>
    </div>
  );
}

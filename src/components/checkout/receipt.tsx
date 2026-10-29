import { formatDateTime } from "@/lib/time";
import { formatCurrency, vehicleLabel } from "@/lib/utils";
import { formatAddress, type Settings } from "@/server/settings";

export interface ReceiptData {
  receiptNumber: string;
  amount: number;
  type: string;
  status: string;
  method: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  billingName: string | null;
  billingEmail: string | null;
  appointment: {
    reference: string;
    customerName: string;
    customerEmail: string;
    startsAt: Date;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    amountPaid: number;
    vehicleYear: number | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
    service: { name: string };
    items: { id: string; label: string; total: number }[];
  };
}

/** Printable receipt (print styles hide navigation). */
export function ReceiptView({ p, settings }: { p: ReceiptData; settings: Settings }) {
  const a = p.appointment;
  const money = (v: number) => formatCurrency(v, { currency: settings.currency, exact: true });
  return (
    <article className="mx-auto max-w-2xl rounded-3xl border border-white/[0.08] bg-card p-8 print:border-0 print:bg-white print:p-0 print:text-black sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-white/10 pb-6 print:border-black/20">
        <div>
          <p className="font-display text-xl font-semibold">{settings.businessName}</p>
          <p className="mt-1 text-sm text-muted-foreground print:text-black/70">{formatAddress(settings)}</p>
          <p className="text-sm text-muted-foreground print:text-black/70">
            {settings.phone} · {settings.email}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase print:text-black/60">Receipt</p>
          <p className="font-mono text-sm">{p.receiptNumber}</p>
          <p className="mt-1 text-sm text-muted-foreground print:text-black/70">{p.paidAt ? formatDateTime(p.paidAt, settings.timezone) : "—"}</p>
          {p.status === "REFUNDED" && <p className="mt-1 text-sm font-semibold text-red-400">REFUNDED {p.refundedAt ? formatDateTime(p.refundedAt, settings.timezone) : ""}</p>}
        </div>
      </header>
      <dl className="grid gap-4 border-b border-white/10 py-6 text-sm sm:grid-cols-2 print:border-black/20">
        <div>
          <dt className="text-muted-foreground print:text-black/60">Billed to</dt>
          <dd className="font-medium">{p.billingName ?? a.customerName}</dd>
          <dd className="text-muted-foreground print:text-black/70">{p.billingEmail ?? a.customerEmail}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground print:text-black/60">Booking</dt>
          <dd className="font-medium">{a.reference}</dd>
          <dd className="text-muted-foreground print:text-black/70">
            {formatDateTime(a.startsAt, settings.timezone)} · {vehicleLabel(a)}
          </dd>
        </div>
      </dl>
      <table className="w-full py-6 text-sm">
        <tbody>
          {a.items.map((item) => (
            <tr key={item.id}>
              <td className="py-1.5">{item.label}</td>
              <td className="py-1.5 text-right tabular-nums">{money(item.total)}</td>
            </tr>
          ))}
          <tr className="border-t border-white/10 print:border-black/20">
            <td className="pt-3 text-muted-foreground print:text-black/60">Subtotal</td>
            <td className="pt-3 text-right tabular-nums">{money(a.subtotal)}</td>
          </tr>
          {a.discount > 0 && (
            <tr>
              <td className="text-muted-foreground print:text-black/60">Discount</td>
              <td className="text-right tabular-nums">−{money(a.discount)}</td>
            </tr>
          )}
          <tr>
            <td className="text-muted-foreground print:text-black/60">Tax</td>
            <td className="text-right tabular-nums">{money(a.tax)}</td>
          </tr>
          <tr className="font-semibold">
            <td className="pt-1">Order total</td>
            <td className="pt-1 text-right tabular-nums">{money(a.total)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-6 flex items-center justify-between rounded-2xl bg-white/[0.04] p-5 print:bg-black/5">
        <div>
          <p className="text-sm text-muted-foreground print:text-black/60">
            Amount paid ({p.type.toLowerCase()}) · {p.method ?? "card"}
          </p>
          <p className="text-xs text-muted-foreground print:text-black/60">Balance remaining: {money(Math.max(0, a.total - a.amountPaid))}</p>
        </div>
        <p className="font-display text-3xl font-semibold">{money(p.amount)}</p>
      </div>
      <p className="mt-8 text-center text-xs text-muted-foreground print:text-black/60">Thank you for choosing {settings.businessName}.</p>
    </article>
  );
}

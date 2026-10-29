import Image from "next/image";
import { CalendarCheck, Car, UserRound, Wrench } from "lucide-react";
import { formatDateTime } from "@/lib/time";
import { formatCurrency, vehicleLabel } from "@/lib/utils";
import type { AppointmentDetail } from "@/server/appointments/access";

/** Appointment + price summary shared by checkout, confirmation and manage pages. */
export function OrderSummary({ a, timeZone, currency, showPaid = true }: { a: AppointmentDetail; timeZone: string; currency: string; showPaid?: boolean }) {
  const balance = Math.max(0, a.total - a.amountPaid);
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-card">
      <div className="flex items-center gap-4 border-b border-white/[0.07] p-6">
        {a.service.imageUrl && (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-xl">
            <Image src={a.service.imageUrl} alt="" fill sizes="56px" className="object-cover" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Booking {a.reference}</p>
          <p className="truncate font-semibold">{[a.service.name, a.serviceOption?.name].filter(Boolean).join(" — ")}</p>
          {a.filmType && (
            <p className="text-xs text-muted-foreground">
              {a.filmType.name} film{a.shade ? ` · ${a.shade}%` : ""}
            </p>
          )}
        </div>
      </div>
      <dl className="grid gap-3 p-6 text-sm">
        <Row icon={<CalendarCheck className="size-4" />} label="Appointment" value={formatDateTime(a.startsAt, timeZone)} />
        <Row icon={<Car className="size-4" />} label="Vehicle" value={[vehicleLabel(a), a.vehicleColor].filter(Boolean).join(" · ")} />
        <Row icon={<UserRound className="size-4" />} label="Customer" value={`${a.customerName} · ${a.customerEmail}`} />
        {a.technician && <Row icon={<Wrench className="size-4" />} label="Technician" value={a.technician.name} />}
      </dl>
      <div className="border-t border-white/[0.07] p-6">
        <ul className="grid gap-2 text-sm">
          {a.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4">
              <span className="text-foreground/80">
                {item.label}
                {item.description && <span className="block text-xs text-muted-foreground">{item.description}</span>}
              </span>
              <span className="tabular-nums">{formatCurrency(item.total, { currency, exact: true })}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid gap-1.5 border-t border-white/[0.07] pt-4 text-sm">
          <Money label="Subtotal" value={a.subtotal} currency={currency} />
          {a.discount > 0 && <Money label={`Discount${a.coupon ? ` (${a.coupon.code})` : ""}`} value={-a.discount} currency={currency} className="text-emerald-400" />}
          <Money label="Tax" value={a.tax} currency={currency} />
          <Money label="Total" value={a.total} currency={currency} strong />
          <Money label="Deposit" value={a.depositAmount} currency={currency} muted />
          {showPaid && a.amountPaid > 0 && <Money label="Paid" value={-a.amountPaid} currency={currency} className="text-emerald-400" />}
          {showPaid && <Money label="Balance due" value={balance} currency={currency} strong />}
        </dl>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words">{value}</dd>
      </div>
    </div>
  );
}

function Money({ label, value, currency, strong, muted, className }: { label: string; value: number; currency: string; strong?: boolean; muted?: boolean; className?: string }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""} ${className ?? ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">
        {value < 0 ? "−" : ""}
        {formatCurrency(Math.abs(value), { currency, exact: true })}
      </dd>
    </div>
  );
}

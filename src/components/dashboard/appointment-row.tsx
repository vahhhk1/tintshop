import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status";
import { formatInTz } from "@/lib/time";
import { formatCurrency, vehicleLabel } from "@/lib/utils";

export interface AppointmentRowData {
  id: string;
  reference: string;
  status: string;
  startsAt: Date;
  total: number;
  amountPaid: number;
  customerName?: string;
  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  service: { name: string };
  serviceOption?: { name: string } | null;
}

export function AppointmentRow({ a, href, timeZone, showCustomer }: { a: AppointmentRowData; href: string; timeZone: string; showCustomer?: boolean }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-card p-4 transition-colors hover:border-white/15 sm:p-5">
        <div className="grid w-14 shrink-0 place-items-center rounded-xl border border-white/10 py-2 text-center">
          <span className="text-[10px] font-semibold text-primary uppercase">{formatInTz(a.startsAt, timeZone, { month: "short" })}</span>
          <span className="font-display text-xl leading-none font-semibold">{formatInTz(a.startsAt, timeZone, { day: "numeric" })}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{[a.service.name, a.serviceOption?.name].filter(Boolean).join(" — ")}</p>
            <StatusBadge kind="appointment" status={a.status} />
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {formatInTz(a.startsAt, timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" })} · {showCustomer && a.customerName ? `${a.customerName} · ` : ""}
            {vehicleLabel(a)} · {a.reference}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="font-medium tabular-nums">{formatCurrency(a.total, { exact: true })}</p>
          <p className="text-xs text-muted-foreground">{a.amountPaid >= a.total ? "Paid" : a.amountPaid > 0 ? `${formatCurrency(a.total - a.amountPaid, { exact: true })} due` : "Unpaid"}</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}

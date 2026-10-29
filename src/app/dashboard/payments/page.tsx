import Link from "next/link";
import { CreditCard, ExternalLink, Receipt } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/time";
import { formatCurrency } from "@/lib/utils";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Payments & receipts" };

export default async function MyPaymentsPage() {
  const user = await requireUser("/dashboard/payments");
  const [settings, payments] = await Promise.all([
    getSettings(),
    prisma.payment.findMany({
      where: { status: { in: ["SUCCEEDED", "REFUNDED"] }, OR: [{ userId: user.id }, { appointment: { userId: user.id } }] },
      orderBy: { paidAt: "desc" },
      include: { appointment: { select: { id: true, reference: true, service: { select: { name: true } } } } },
    }),
  ]);
  const total = payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <PageHeader title="Payments & receipts" description={payments.length ? `${formatCurrency(total, { exact: true })} paid across ${payments.length} payments.` : undefined} />
      {payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments yet" description="Deposits and payments you make online will appear here with downloadable receipts." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-white/[0.02] text-left text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Service</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">
                  <span className="sr-only">Receipt</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-4 whitespace-nowrap">{p.paidAt ? formatDate(p.paidAt, settings.timezone) : "—"}</td>
                  <td className="px-5 py-4">
                    <Link href={`/dashboard/appointments/${p.appointment.id}`} className="hover:text-primary">
                      {p.appointment.service.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{p.appointment.reference}</span>
                  </td>
                  <td className="px-5 py-4 capitalize">{p.type.toLowerCase()}</td>
                  <td className="px-5 py-4 text-muted-foreground">{p.method ?? p.provider}</td>
                  <td className="px-5 py-4 text-right font-medium tabular-nums">{formatCurrency(p.amount, { exact: true })}</td>
                  <td className="px-5 py-4">
                    <StatusBadge kind="payment" status={p.status} />
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <Link href={`/dashboard/receipts/${p.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Receipt className="size-4" aria-hidden /> Receipt
                    </Link>
                    {p.receiptUrl && (
                      <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="ml-3 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        Stripe <ExternalLink className="size-3" aria-hidden />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

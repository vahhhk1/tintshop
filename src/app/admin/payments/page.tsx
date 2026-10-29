import Link from "next/link";
import { CreditCard } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { EmptyState, StatTile } from "@/components/ui/misc";
import { StatusBadge, statusOptions } from "@/components/ui/status";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { daysAgo, formatDateTime } from "@/lib/time";
import { formatCurrency } from "@/lib/utils";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Payments" };

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; provider?: string }> }) {
  const [sp] = await Promise.all([searchParams, requirePermission("payments:view", "/admin/payments")]);
  const settings = await getSettings();
  const where: Prisma.PaymentWhereInput = {};
  if (sp.status) where.status = sp.status as Prisma.PaymentWhereInput["status"];
  else where.status = { not: "CANCELLED" };
  if (sp.provider) where.provider = sp.provider as Prisma.PaymentWhereInput["provider"];
  const since = daysAgo(30);
  const [payments, sum30, refunded30, count30] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { appointment: { select: { id: true, reference: true, customerName: true, service: { select: { name: true } } } } },
    }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED", paidAt: { gte: since } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "REFUNDED", refundedAt: { gte: since } }, _sum: { amount: true } }),
    prisma.payment.count({ where: { status: "SUCCEEDED", paidAt: { gte: since } } }),
  ]);

  return (
    <>
      <PageHeader title="Payments" description="Online (Stripe), demo and in-shop payments." />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatTile label="Collected (30 days)" value={formatCurrency(sum30._sum.amount ?? 0)} />
        <StatTile label="Payments (30 days)" value={count30} />
        <StatTile label="Refunded (30 days)" value={formatCurrency(refunded30._sum.amount ?? 0)} />
      </div>
      <form action="/admin/payments" className="mb-6 flex flex-wrap gap-2">
        <NativeSelect name="status" defaultValue={sp.status ?? ""} className="h-10 w-44" aria-label="Status">
          <option value="">All (except cancelled)</option>
          {statusOptions("payment").map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="provider" defaultValue={sp.provider ?? ""} className="h-10 w-40" aria-label="Provider">
          <option value="">All providers</option>
          <option value="STRIPE">Stripe</option>
          <option value="MANUAL">In shop</option>
          <option value="DEMO">Demo</option>
        </NativeSelect>
        <Button type="submit" variant="subtle" className="h-10">
          Filter
        </Button>
      </form>
      {payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments found" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-white/[0.02] text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Receipt</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(p.paidAt ?? p.createdAt, settings.timezone)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/appointments/${p.appointment.id}`} className="font-medium hover:text-primary">
                      {p.appointment.customerName}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {p.appointment.service.name} · {p.appointment.reference}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {p.status === "SUCCEEDED" || p.status === "REFUNDED" ? (
                      <Link href={`/dashboard/receipts/${p.id}`} className="hover:text-primary">
                        {p.receiptNumber}
                      </Link>
                    ) : (
                      p.receiptNumber
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{p.type.toLowerCase()}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.method ?? "—"} <span className="text-xs">({p.provider.toLowerCase()})</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge kind="payment" status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(p.amount, { exact: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

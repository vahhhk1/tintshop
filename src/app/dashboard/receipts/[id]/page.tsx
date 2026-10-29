import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ReceiptView } from "@/components/checkout/receipt";
import { PrintButton } from "@/components/dashboard/print-button";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/receipts/${id}`);
  const [p, settings] = await Promise.all([
    prisma.payment.findUnique({
      where: { id },
      include: { appointment: { include: { service: { select: { name: true } }, items: { orderBy: { id: "asc" } } } } },
    }),
    getSettings(),
  ]);
  const allowed = p && (p.userId === user.id || p.appointment.userId === user.id || can(user.role, "payments:view"));
  if (!p || !allowed || (p.status !== "SUCCEEDED" && p.status !== "REFUNDED")) notFound();

  return (
    <>
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href="/dashboard/payments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Payments
        </Link>
        <PrintButton />
      </div>
      <ReceiptView p={p} settings={settings} />
    </>
  );
}

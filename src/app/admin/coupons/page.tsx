import { Tag, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { PageHeader } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/time";
import { centsToDollarsInput, formatCurrency } from "@/lib/utils";
import { deleteCouponAction, saveCouponAction, setCouponActiveAction } from "@/server/admin/business";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Coupons" };

type CouponRow = Awaited<ReturnType<typeof loadCoupons>>[number];
const loadCoupons = () => prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { services: { select: { id: true, name: true } } } });

const toLocalInput = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

function CouponForm({ c, services }: { c: CouponRow | null; services: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveCouponAction} resetOnSuccess={!c} className="grid gap-3 md:grid-cols-4">
      {c && <input type="hidden" name="id" value={c.id} />}
      <AdminField name="code" label="Code" required>
        <Input name="code" defaultValue={c?.code ?? ""} className="uppercase" />
      </AdminField>
      <AdminField name="type" label="Type">
        <NativeSelect name="type" defaultValue={c?.type ?? "PERCENT"}>
          <option value="PERCENT">Percent off</option>
          <option value="FIXED">Fixed amount off ($)</option>
        </NativeSelect>
      </AdminField>
      <AdminField name="value" label="Value" required hint="10 = 10% or $10">
        <Input name="value" inputMode="decimal" defaultValue={c ? (c.type === "PERCENT" ? c.value : centsToDollarsInput(c.value)) : ""} />
      </AdminField>
      <AdminField name="description" label="Description">
        <Input name="description" defaultValue={c?.description ?? ""} />
      </AdminField>
      <AdminField name="minPurchase" label="Minimum purchase ($)">
        <Input name="minPurchase" inputMode="decimal" defaultValue={centsToDollarsInput(c?.minPurchase)} />
      </AdminField>
      <AdminField name="maxDiscount" label="Max discount ($)">
        <Input name="maxDiscount" inputMode="decimal" defaultValue={centsToDollarsInput(c?.maxDiscount)} />
      </AdminField>
      <AdminField name="usageLimit" label="Total uses">
        <Input name="usageLimit" inputMode="numeric" defaultValue={c?.usageLimit ?? ""} />
      </AdminField>
      <AdminField name="perCustomerLimit" label="Uses per customer">
        <Input name="perCustomerLimit" inputMode="numeric" defaultValue={c?.perCustomerLimit ?? ""} />
      </AdminField>
      <AdminField name="startsAt" label="Starts">
        <Input type="datetime-local" name="startsAt" defaultValue={toLocalInput(c?.startsAt ?? null)} />
      </AdminField>
      <AdminField name="expiresAt" label="Expires">
        <Input type="datetime-local" name="expiresAt" defaultValue={toLocalInput(c?.expiresAt ?? null)} />
      </AdminField>
      <fieldset className="md:col-span-2">
        <legend className="mb-2 text-sm font-medium">Restrict to services (none = all)</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-1.5 text-xs">
              <Checkbox name="serviceIds" value={s.id} defaultChecked={c?.services.some((x) => x.id === s.id)} /> {s.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-4 md:col-span-4">
        <label className="flex items-center gap-1.5 text-sm">
          <Checkbox name="active" defaultChecked={c?.active ?? true} /> Active
        </label>
        <SubmitButton size="sm" variant={c ? "outline" : "default"}>
          {c ? "Save coupon" : "Create coupon"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function AdminCouponsPage() {
  await requirePermission("coupons:manage", "/admin/coupons");
  const [coupons, services, settings] = await Promise.all([loadCoupons(), prisma.service.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }), getSettings()]);
  const now = new Date();
  return (
    <>
      <PageHeader title="Coupons" description="Promo codes customers can enter at checkout. Validated on the server before any discount applies." />
      <section className="mb-8 rounded-2xl border border-white/[0.07] bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">New coupon</h2>
        <CouponForm c={null} services={services} />
      </section>
      {coupons.length === 0 ? (
        <EmptyState icon={Tag} title="No coupons yet" />
      ) : (
        <ul className="grid gap-3">
          {coupons.map((c) => {
            const expired = c.expiresAt && c.expiresAt < now;
            const exhausted = c.usageLimit != null && c.usageCount >= c.usageLimit;
            return (
              <li key={c.id} className="rounded-2xl border border-white/[0.07] bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded-lg bg-white/[0.06] px-2.5 py-1 font-mono text-sm font-semibold">{c.code}</code>
                    <span className="text-sm">{c.type === "PERCENT" ? `${c.value}% off` : `${formatCurrency(c.value)} off`}</span>
                    {!c.active ? <Badge variant="neutral">Disabled</Badge> : expired ? <Badge variant="danger">Expired</Badge> : exhausted ? <Badge variant="warning">Used up</Badge> : <Badge variant="success">Active</Badge>}
                    <span className="text-xs text-muted-foreground">
                      Used {c.usageCount}
                      {c.usageLimit ? ` / ${c.usageLimit}` : ""} {c.expiresAt ? `· expires ${formatDate(c.expiresAt, settings.timezone)}` : ""}
                      {c.services.length ? ` · ${c.services.map((s) => s.name).join(", ")}` : ""}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <ActionButton size="sm" variant="ghost" action={setCouponActiveAction} args={[c.id, !c.active]}>
                      {c.active ? "Disable" : "Enable"}
                    </ActionButton>
                    <ActionButton size="sm" variant="ghost" className="text-red-300" action={deleteCouponAction} args={[c.id]} confirm={`Delete ${c.code}?`}>
                      <Trash2 aria-hidden />
                    </ActionButton>
                  </div>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Edit</summary>
                  <div className="mt-4">
                    <CouponForm c={c} services={services} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

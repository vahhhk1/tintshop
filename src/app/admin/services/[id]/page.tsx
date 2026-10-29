import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { PageHeader } from "@/components/dashboard/shell";
import { ServiceForm } from "@/components/admin/service-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { centsToDollarsInput } from "@/lib/utils";
import { deleteFaqAction, deleteServiceAction, deleteServiceOptionAction, saveFaqAction, saveServiceOptionAction } from "@/server/admin/catalog";

export const metadata = { title: "Edit service" };

type OptionRow = { id?: string; name: string; description: string | null; kind: string; windowCount: number; durationMinutes: number | null; price: number | null; active: boolean; sortOrder: number };

function OptionForm({ serviceId, o }: { serviceId: string; o: OptionRow }) {
  return (
    <ActionForm action={saveServiceOptionAction} className="grid gap-3 sm:grid-cols-[1.4fr_1.6fr_110px_90px_90px_100px_auto] sm:items-end" resetOnSuccess={!o.id}>
      {o.id && <input type="hidden" name="id" value={o.id} />}
      <input type="hidden" name="serviceId" value={serviceId} />
      <AdminField name="name" label="Name" required>
        <Input name="name" defaultValue={o.name} />
      </AdminField>
      <AdminField name="description" label="Description">
        <Input name="description" defaultValue={o.description ?? ""} />
      </AdminField>
      <AdminField name="kind" label="Type">
        <NativeSelect name="kind" defaultValue={o.kind}>
          <option value="COVERAGE">Coverage</option>
          <option value="ADDON">Add-on</option>
        </NativeSelect>
      </AdminField>
      <AdminField name="durationMinutes" label="Minutes">
        <Input name="durationMinutes" inputMode="numeric" defaultValue={o.durationMinutes ?? ""} />
      </AdminField>
      <AdminField name="windowCount" label="Windows">
        <Input name="windowCount" inputMode="numeric" defaultValue={o.windowCount} />
      </AdminField>
      <AdminField name="price" label="Price ($)" hint="Fallback">
        <Input name="price" inputMode="decimal" defaultValue={centsToDollarsInput(o.price)} />
      </AdminField>
      <div className="flex items-center gap-2 pb-1">
        <input type="hidden" name="sortOrder" value={o.sortOrder} />
        <label className="flex items-center gap-1.5 text-xs" title="Active">
          <Checkbox name="active" defaultChecked={o.active} /> On
        </label>
        <SubmitButton size="sm" variant="outline">
          {o.id ? "Save" : "Add"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("services:manage", `/admin/services/${id}`);
  const [service, films, parents] = await Promise.all([
    prisma.service.findUnique({ where: { id }, include: { options: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] }, faqs: { orderBy: { sortOrder: "asc" } }, parent: { select: { id: true, name: true } } } }),
    prisma.filmType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.service.findMany({ where: { parentId: null, id: { not: id } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!service) notFound();

  return (
    <>
      <Link href="/admin/services" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Services
      </Link>
      <PageHeader
        title={service.name}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/services/${service.slug}`} target="_blank">
                <ExternalLink aria-hidden /> View on site
              </Link>
            </Button>
            <ActionButton size="sm" variant="ghost" className="text-red-300" action={deleteServiceAction} args={[service.id]} confirm={`Delete ${service.name}?`}>
              <Trash2 aria-hidden /> Delete
            </ActionButton>
          </>
        }
      />
      <ServiceForm values={service} films={films} parents={parents} />

      <section className="mt-10 rounded-2xl border border-white/[0.07] bg-card p-6" aria-labelledby="opt-h">
        <h2 id="opt-h" className="text-lg font-semibold">
          Coverage options &amp; add-ons
        </h2>
        {service.parent ? (
          <p className="mt-2 text-sm text-muted-foreground">
            This service is a variant and uses the options of{" "}
            <Link href={`/admin/services/${service.parent.id}`} className="text-primary hover:underline">
              {service.parent.name}
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">
              Coverage options are what customers pick (e.g. Full Tint, Front Windows). Prices come from{" "}
              <Link href="/admin/pricing" className="text-primary hover:underline">
                pricing rules
              </Link>
              ; the price here is used only when no rule matches (typical for add-ons).
            </p>
            <div className="grid gap-4 divide-y divide-white/[0.05]">
              {service.options.map((o) => (
                <div key={o.id} className="flex items-end gap-2 pt-4 first:pt-0">
                  <div className="flex-1">
                    <OptionForm serviceId={service.id} o={o} />
                  </div>
                  <ActionButton size="icon-sm" variant="ghost" action={deleteServiceOptionAction} args={[o.id]} confirm={`Delete option “${o.name}”?`} aria-label={`Delete ${o.name}`}>
                    <Trash2 className="size-4 text-red-300" />
                  </ActionButton>
                </div>
              ))}
              <div className="pt-4">
                <p className="mb-2 text-sm font-medium">Add option</p>
                <OptionForm serviceId={service.id} o={{ name: "", description: null, kind: "COVERAGE", windowCount: 0, durationMinutes: null, price: null, active: true, sortOrder: service.options.length }} />
              </div>
            </div>
          </>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-white/[0.07] bg-card p-6" aria-labelledby="faq-h">
        <h2 id="faq-h" className="mb-5 text-lg font-semibold">
          FAQs for this service
        </h2>
        <div className="grid gap-4 divide-y divide-white/[0.05]">
          {[...service.faqs, null].map((f, i) => (
            <div key={f?.id ?? "new"} className="flex items-end gap-2 pt-4 first:pt-0">
              <ActionForm action={saveFaqAction} className="flex-1 gap-3" resetOnSuccess={!f}>
                {f && <input type="hidden" name="id" value={f.id} />}
                <input type="hidden" name="serviceId" value={service.id} />
                <input type="hidden" name="sortOrder" value={f?.sortOrder ?? i} />
                <AdminField name="question" label={f ? "Question" : "New question"} required>
                  <Input name="question" defaultValue={f?.question ?? ""} />
                </AdminField>
                <AdminField name="answer" label="Answer" required>
                  <Textarea name="answer" rows={2} defaultValue={f?.answer ?? ""} />
                </AdminField>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox name="active" defaultChecked={f?.active ?? true} /> Visible
                  </label>
                  <SubmitButton size="sm" variant="outline">
                    {f ? "Save" : "Add FAQ"}
                  </SubmitButton>
                </div>
              </ActionForm>
              {f && (
                <ActionButton size="icon-sm" variant="ghost" action={deleteFaqAction} args={[f.id]} confirm="Delete this FAQ?" aria-label="Delete FAQ">
                  <Trash2 className="size-4 text-red-300" />
                </ActionButton>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

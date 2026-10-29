import { Trash2 } from "lucide-react";
import { ActionButton, ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { PriceMatrix } from "@/components/admin/price-matrix";
import { PageHeader } from "@/components/dashboard/shell";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { centsToDollarsInput, formatCurrency } from "@/lib/utils";
import {
  deleteCatalogDimensionAction,
  deletePackageAction,
  deletePricingRuleAction,
  saveFilmTypeAction,
  savePackageAction,
  savePricingRuleAction,
  saveVehicleSizeAction,
  saveVehicleTypeAction,
} from "@/server/admin/catalog";

export const metadata = { title: "Pricing" };

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-white/[0.07] bg-card p-6" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="text-lg font-semibold">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function AdminPricingPage() {
  await requirePermission("pricing:manage", "/admin/pricing");
  const [services, options, films, vehicleTypes, sizes, rules, packages] = await Promise.all([
    prisma.service.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, usesFilm: true, parentId: true, slug: true } }),
    prisma.serviceOption.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }], select: { id: true, serviceId: true, name: true, kind: true } }),
    prisma.filmType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.vehicleType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.vehicleSize.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.pricingRule.findMany({ orderBy: [{ serviceId: "asc" }, { serviceOptionId: "asc" }] }),
    prisma.package.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const name = (list: { id: string; name: string }[], id: string | null) => (id ? (list.find((x) => x.id === id)?.name ?? "?") : "Any");
  const baseServices = services.filter((s) => !s.parentId);
  const activeFilms = films.filter((f) => f.active);

  return (
    <>
      <PageHeader
        title="Pricing"
        description="Every price on the website, in the quote tool and at checkout is calculated from these settings — nothing is hard-coded."
      />
      <nav className="scrollbar-none mb-6 flex gap-2 overflow-x-auto text-sm" aria-label="Pricing sections">
        {[
          ["grid", "Price grid"],
          ["films", "Films"],
          ["types", "Vehicle types"],
          ["sizes", "Vehicle sizes"],
          ["packages", "Packages"],
          ["rules", "All rules"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-white/10 px-4 py-1.5 text-foreground/75 hover:text-foreground">
            {label}
          </a>
        ))}
      </nav>

      <div className="grid gap-6">
        <Section id="grid" title="Price grid" description="Set the price for a coverage option by vehicle type and film. Variants (e.g. Ceramic Window Tint) use their parent service’s grid.">
          <PriceMatrix
            services={baseServices}
            options={options}
            films={activeFilms.map((f) => ({ id: f.id, name: f.name }))}
            vehicleTypes={vehicleTypes.filter((v) => v.active).map((v) => ({ id: v.id, name: v.name }))}
            sizes={sizes.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
            rules={rules.filter((r) => r.active)}
          />
        </Section>

        <Section id="films" title="Window films" description="Specs shown on the website and the shades customers can choose.">
          <div className="grid gap-4 divide-y divide-white/[0.05]">
            {[...films, null].map((f) => (
              <ActionForm key={f?.id ?? "new"} action={saveFilmTypeAction} className="grid gap-3 pt-4 first:pt-0 md:grid-cols-6" resetOnSuccess={!f}>
                {f && <input type="hidden" name="id" value={f.id} />}
                <AdminField name="name" label={f ? "Name" : "New film"} required>
                  <Input name="name" defaultValue={f?.name ?? ""} />
                </AdminField>
                <AdminField name="tagline" label="Tagline" className="md:col-span-2">
                  <Input name="tagline" defaultValue={f?.tagline ?? ""} />
                </AdminField>
                <AdminField name="shades" label="Shades (%)" hint="Comma separated" className="md:col-span-2">
                  <Input name="shades" defaultValue={f?.shades.join(", ") ?? "5, 15, 20, 35, 50"} />
                </AdminField>
                <AdminField name="sortOrder" label="Order">
                  <Input name="sortOrder" inputMode="numeric" defaultValue={f?.sortOrder ?? films.length} />
                </AdminField>
                <AdminField name="heatRejection" label="IR heat %">
                  <Input name="heatRejection" inputMode="numeric" defaultValue={f?.heatRejection ?? ""} />
                </AdminField>
                <AdminField name="uvRejection" label="UV %">
                  <Input name="uvRejection" inputMode="numeric" defaultValue={f?.uvRejection ?? ""} />
                </AdminField>
                <AdminField name="glareReduction" label="Glare %">
                  <Input name="glareReduction" inputMode="numeric" defaultValue={f?.glareReduction ?? ""} />
                </AdminField>
                <AdminField name="warrantyYears" label="Warranty yrs" hint="50+ = lifetime">
                  <Input name="warrantyYears" inputMode="numeric" defaultValue={f?.warrantyYears ?? ""} />
                </AdminField>
                <AdminField name="description" label="Description" className="md:col-span-2">
                  <Textarea name="description" rows={2} defaultValue={f?.description ?? ""} />
                </AdminField>
                <AdminField name="features" label="Features (one per line)" className="md:col-span-4">
                  <Textarea name="features" rows={2} defaultValue={f?.features.join("\n") ?? ""} />
                </AdminField>
                <div className="flex items-end gap-3 md:col-span-2">
                  <label className="flex items-center gap-1.5 pb-3 text-sm">
                    <Checkbox name="active" defaultChecked={f?.active ?? true} /> Active
                  </label>
                  <SubmitButton size="sm" variant="outline" className="mb-1.5">
                    {f ? "Save film" : "Add film"}
                  </SubmitButton>
                  {f && (
                    <ActionButton size="sm" variant="ghost" className="mb-1.5 text-red-300" action={deleteCatalogDimensionAction} args={["film", f.id]} confirm={`Delete ${f.name} film?`}>
                      <Trash2 aria-hidden />
                    </ActionButton>
                  )}
                </div>
              </ActionForm>
            ))}
          </div>
        </Section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section id="types" title="Vehicle types">
            <div className="grid gap-3">
              {[...vehicleTypes, null].map((v) => (
                <ActionForm key={v?.id ?? "new"} action={saveVehicleTypeAction} className="grid grid-cols-[1fr_1.4fr_70px_auto] items-end gap-2" resetOnSuccess={!v}>
                  {v && <input type="hidden" name="id" value={v.id} />}
                  <AdminField name="name" label={v ? "Name" : "New type"} required>
                    <Input name="name" defaultValue={v?.name ?? ""} />
                  </AdminField>
                  <AdminField name="description" label="Description">
                    <Input name="description" defaultValue={v?.description ?? ""} />
                  </AdminField>
                  <AdminField name="sortOrder" label="Order">
                    <Input name="sortOrder" inputMode="numeric" defaultValue={v?.sortOrder ?? vehicleTypes.length} />
                  </AdminField>
                  <div className="flex items-center gap-2 pb-1">
                    <label className="flex items-center gap-1 text-xs">
                      <Checkbox name="active" defaultChecked={v?.active ?? true} /> On
                    </label>
                    <SubmitButton size="sm" variant="outline">
                      {v ? "Save" : "Add"}
                    </SubmitButton>
                    {v && (
                      <ActionButton size="icon-sm" variant="ghost" action={deleteCatalogDimensionAction} args={["type", v.id]} confirm={`Delete ${v.name}?`} aria-label={`Delete ${v.name}`}>
                        <Trash2 className="size-4 text-red-300" />
                      </ActionButton>
                    )}
                  </div>
                </ActionForm>
              ))}
            </div>
          </Section>

          <Section id="sizes" title="Vehicle sizes" description="Percent adjustments apply when a rule isn’t size-specific.">
            <div className="grid gap-3">
              {[...sizes, null].map((s) => (
                <ActionForm key={s?.id ?? "new"} action={saveVehicleSizeAction} className="grid grid-cols-[1fr_80px_80px_60px_auto] items-end gap-2" resetOnSuccess={!s}>
                  {s && <input type="hidden" name="id" value={s.id} />}
                  <input type="hidden" name="description" value={s?.description ?? ""} />
                  <AdminField name="name" label={s ? "Name" : "New size"} required>
                    <Input name="name" defaultValue={s?.name ?? ""} />
                  </AdminField>
                  <AdminField name="priceAdjustPercent" label="Price %">
                    <Input name="priceAdjustPercent" inputMode="numeric" defaultValue={s?.priceAdjustPercent ?? 0} />
                  </AdminField>
                  <AdminField name="durationAdjustPercent" label="Time %">
                    <Input name="durationAdjustPercent" inputMode="numeric" defaultValue={s?.durationAdjustPercent ?? 0} />
                  </AdminField>
                  <AdminField name="sortOrder" label="Order">
                    <Input name="sortOrder" inputMode="numeric" defaultValue={s?.sortOrder ?? sizes.length} />
                  </AdminField>
                  <div className="flex items-center gap-2 pb-1">
                    <label className="flex items-center gap-1 text-xs">
                      <Checkbox name="active" defaultChecked={s?.active ?? true} /> On
                    </label>
                    <SubmitButton size="sm" variant="outline">
                      {s ? "Save" : "Add"}
                    </SubmitButton>
                    {s && (
                      <ActionButton size="icon-sm" variant="ghost" action={deleteCatalogDimensionAction} args={["size", s.id]} confirm={`Delete ${s.name}?`} aria-label={`Delete ${s.name}`}>
                        <Trash2 className="size-4 text-red-300" />
                      </ActionButton>
                    )}
                  </div>
                </ActionForm>
              ))}
            </div>
          </Section>
        </div>

        <Section id="packages" title="Packages" description="Marketing packages on the homepage and pricing page. The “from” price is calculated from the linked service, coverage and film; the price here is a fallback.">
          <div className="grid gap-6 divide-y divide-white/[0.05]">
            {[...packages, null].map((p) => (
              <ActionForm key={p?.id ?? "new"} action={savePackageAction} className="grid gap-3 pt-6 first:pt-0 md:grid-cols-4" resetOnSuccess={!p}>
                {p && <input type="hidden" name="id" value={p.id} />}
                <AdminField name="name" label={p ? "Name" : "New package"} required>
                  <Input name="name" defaultValue={p?.name ?? ""} />
                </AdminField>
                <AdminField name="tagline" label="Tagline">
                  <Input name="tagline" defaultValue={p?.tagline ?? ""} />
                </AdminField>
                <AdminField name="price" label="Fallback price ($)" required>
                  <Input name="price" inputMode="decimal" defaultValue={centsToDollarsInput(p?.price ?? 0)} />
                </AdminField>
                <AdminField name="sortOrder" label="Order">
                  <Input name="sortOrder" inputMode="numeric" defaultValue={p?.sortOrder ?? packages.length} />
                </AdminField>
                <AdminField name="serviceId" label="Service">
                  <NativeSelect name="serviceId" defaultValue={p?.serviceId ?? ""}>
                    <option value="">—</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                </AdminField>
                <AdminField name="serviceOptionId" label="Coverage">
                  <NativeSelect name="serviceOptionId" defaultValue={p?.serviceOptionId ?? ""}>
                    <option value="">—</option>
                    {options
                      .filter((o) => o.kind === "COVERAGE")
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {services.find((s) => s.id === o.serviceId)?.name} — {o.name}
                        </option>
                      ))}
                  </NativeSelect>
                </AdminField>
                <AdminField name="filmTypeId" label="Film">
                  <NativeSelect name="filmTypeId" defaultValue={p?.filmTypeId ?? ""}>
                    <option value="">—</option>
                    {films.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </NativeSelect>
                </AdminField>
                <AdminField name="priceSuffix" label="Price suffix">
                  <Input name="priceSuffix" defaultValue={p?.priceSuffix ?? ""} />
                </AdminField>
                <AdminField name="description" label="Description" className="md:col-span-2">
                  <Textarea name="description" rows={3} defaultValue={p?.description ?? ""} />
                </AdminField>
                <AdminField name="features" label="Features (one per line)">
                  <Textarea name="features" rows={3} defaultValue={p?.features.join("\n") ?? ""} />
                </AdminField>
                <AdminField name="recommendedFor" label="Recommended for (one per line)">
                  <Textarea name="recommendedFor" rows={3} defaultValue={p?.recommendedFor.join("\n") ?? ""} />
                </AdminField>
                <div className="flex flex-wrap items-center gap-4 md:col-span-4">
                  <label className="flex items-center gap-1.5 text-sm">
                    <Checkbox name="highlighted" defaultChecked={p?.highlighted ?? false} /> Highlight as “Most popular”
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <Checkbox name="active" defaultChecked={p?.active ?? true} /> Active
                  </label>
                  <SubmitButton size="sm" variant="outline">
                    {p ? "Save package" : "Add package"}
                  </SubmitButton>
                  {p && (
                    <ActionButton size="sm" variant="ghost" className="text-red-300" action={deletePackageAction} args={[p.id]} confirm={`Delete the ${p.name} package?`}>
                      <Trash2 aria-hidden /> Delete
                    </ActionButton>
                  )}
                </div>
              </ActionForm>
            ))}
          </div>
        </Section>

        <Section
          id="rules"
          title="All pricing rules"
          description="Advanced view. A rule matches when all its non-empty fields match the customer’s selection; the most specific matching rule wins. “Per window” adds that amount × the option’s window count."
        >
          <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-white/[0.02] text-left text-muted-foreground">
                <tr>
                  {["Service", "Option", "Film", "Vehicle", "Size", "Price", "Per window", "Minutes", "Priority", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {rules.map((r) => (
                  <tr key={r.id} className={r.active ? "" : "opacity-50"}>
                    <td className="px-3 py-2">{name(services, r.serviceId)}</td>
                    <td className="px-3 py-2">{name(options, r.serviceOptionId)}</td>
                    <td className="px-3 py-2">{name(films, r.filmTypeId)}</td>
                    <td className="px-3 py-2">{name(vehicleTypes, r.vehicleTypeId)}</td>
                    <td className="px-3 py-2">{name(sizes, r.vehicleSizeId)}</td>
                    <td className="px-3 py-2 font-medium tabular-nums">{formatCurrency(r.price, { exact: true })}</td>
                    <td className="px-3 py-2 tabular-nums">{r.pricePerWindow ? formatCurrency(r.pricePerWindow, { exact: true }) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{r.durationMinutes ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{r.priority}</td>
                    <td className="px-3 py-2 text-right">
                      <ActionButton size="icon-sm" variant="ghost" action={deletePricingRuleAction} args={[r.id]} confirm="Delete this pricing rule?" aria-label="Delete rule">
                        <Trash2 className="size-4 text-red-300" />
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 mb-3 font-semibold">Add a rule</h3>
          <ActionForm action={savePricingRuleAction} className="grid gap-3 md:grid-cols-5" resetOnSuccess>
            <AdminField name="serviceId" label="Service">
              <NativeSelect name="serviceId" defaultValue="">
                <option value="">Any</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </AdminField>
            <AdminField name="serviceOptionId" label="Option">
              <NativeSelect name="serviceOptionId" defaultValue="">
                <option value="">Any</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {services.find((s) => s.id === o.serviceId)?.name} — {o.name}
                  </option>
                ))}
              </NativeSelect>
            </AdminField>
            <AdminField name="filmTypeId" label="Film">
              <NativeSelect name="filmTypeId" defaultValue="">
                <option value="">Any</option>
                {films.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </NativeSelect>
            </AdminField>
            <AdminField name="vehicleTypeId" label="Vehicle type">
              <NativeSelect name="vehicleTypeId" defaultValue="">
                <option value="">Any</option>
                {vehicleTypes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </NativeSelect>
            </AdminField>
            <AdminField name="vehicleSizeId" label="Size">
              <NativeSelect name="vehicleSizeId" defaultValue="">
                <option value="">Any</option>
                {sizes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </NativeSelect>
            </AdminField>
            <AdminField name="price" label="Price ($)" required>
              <Input name="price" inputMode="decimal" />
            </AdminField>
            <AdminField name="pricePerWindow" label="Per window ($)">
              <Input name="pricePerWindow" inputMode="decimal" />
            </AdminField>
            <AdminField name="durationMinutes" label="Minutes">
              <Input name="durationMinutes" inputMode="numeric" />
            </AdminField>
            <AdminField name="priority" label="Priority" hint="Breaks ties">
              <Input name="priority" inputMode="numeric" defaultValue={0} />
            </AdminField>
            <div className="flex items-end gap-3">
              <input type="hidden" name="active" value="on" />
              <SubmitButton variant="outline" className="h-11">
                Add rule
              </SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}

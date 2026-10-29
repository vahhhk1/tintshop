"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { centsToDollarsInput, dollarsToCents } from "@/lib/utils";
import { savePriceMatrixAction } from "@/server/admin/catalog";

interface Rule {
  id: string;
  serviceId: string | null;
  serviceOptionId: string | null;
  filmTypeId: string | null;
  vehicleTypeId: string | null;
  vehicleSizeId: string | null;
  price: number;
}

export function PriceMatrix({
  services,
  options,
  films,
  vehicleTypes,
  sizes,
  rules,
}: {
  services: { id: string; name: string; usesFilm: boolean }[];
  options: { id: string; serviceId: string; name: string; kind: string }[];
  films: { id: string; name: string }[];
  vehicleTypes: { id: string; name: string }[];
  sizes: { id: string; name: string }[];
  rules: Rule[];
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = React.useState(services[0]?.id ?? "");
  const serviceOptions = options.filter((o) => o.serviceId === serviceId);
  const [optionId, setOptionId] = React.useState<string>(serviceOptions[0]?.id ?? "");
  const [sizeId, setSizeId] = React.useState<string>("");
  const service = services.find((s) => s.id === serviceId);
  const filmCols = service?.usesFilm ? films : [null];
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();

  const selection = `${serviceId}|${optionId}|${sizeId}`;
  const key = (vt: string, film: string | null) => `${selection}|${vt}:${film ?? "-"}`;

  /** Current saved price for a cell (exact-dimension rule), as a dollars string. */
  function savedValue(vt: string, film: string | null) {
    const rule = rules.find(
      (r) =>
        r.serviceId === serviceId &&
        (r.serviceOptionId ?? "") === optionId &&
        (r.vehicleSizeId ?? "") === sizeId &&
        r.vehicleTypeId === vt &&
        (r.filmTypeId ?? null) === film,
    );
    return rule ? centsToDollarsInput(rule.price) : "";
  }
  const valueFor = (vt: string, film: string | null) => edits[key(vt, film)] ?? savedValue(vt, film);

  function changeService(id: string) {
    setServiceId(id);
    setOptionId(options.find((o) => o.serviceId === id)?.id ?? "");
  }

  function save() {
    const cells = vehicleTypes.flatMap((vt) =>
      filmCols.map((film) => {
        const raw = valueFor(vt.id, film?.id ?? null).trim();
        return { vehicleTypeId: vt.id, filmTypeId: film?.id ?? null, price: raw === "" ? null : dollarsToCents(raw) };
      }),
    );
    start(async () => {
      const res = await savePriceMatrixAction({ serviceId, serviceOptionId: optionId || null, vehicleSizeId: sizeId || null, cells });
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(`${selection}|`))));
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (!services.length) return <p className="text-sm text-muted-foreground">Create a service first.</p>;

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Service</span>
          <NativeSelect value={serviceId} onChange={(e) => changeService(e.target.value)}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Coverage / add-on</span>
          <NativeSelect value={optionId} onChange={(e) => setOptionId(e.target.value)}>
            <option value="">Service base price</option>
            {serviceOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.kind === "ADDON" ? " (add-on)" : ""}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Vehicle size</span>
          <NativeSelect value={sizeId} onChange={(e) => setSizeId(e.target.value)}>
            <option value="">All sizes (size % adjustment applies)</option>
            {sizes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} only
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-white/[0.02] text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Vehicle type</th>
              {filmCols.map((f) => (
                <th key={f?.id ?? "none"} className="px-4 py-3 font-medium">
                  {f ? `${f.name} ($)` : "Price ($)"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {vehicleTypes.map((vt) => (
              <tr key={vt.id}>
                <th scope="row" className="px-4 py-2 text-left font-medium">
                  {vt.name}
                </th>
                {filmCols.map((f) => {
                  const k = key(vt.id, f?.id ?? null);
                  return (
                    <td key={k} className="px-4 py-2">
                      <Input
                        inputMode="decimal"
                        value={valueFor(vt.id, f?.id ?? null)}
                        onChange={(e) => setEdits((v) => ({ ...v, [k]: e.target.value }))}
                        placeholder="—"
                        className="h-9 w-28 tabular-nums"
                        aria-label={`${vt.name}${f ? ` ${f.name}` : ""} price`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Empty cells fall back to broader rules (e.g. one price for all vehicle types) or the option’s fallback price.</p>
        <Button onClick={save} loading={pending}>
          Save prices
        </Button>
      </div>
    </div>
  );
}

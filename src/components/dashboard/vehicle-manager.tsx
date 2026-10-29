"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Car, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { useFormAction } from "@/hooks/use-form-action";
import { vehicleSchema } from "@/lib/validation/public";
import { deleteVehicleAction, saveVehicleAction } from "@/server/customers/actions";

export interface VehicleView {
  id: string;
  year: number;
  make: string;
  model: string;
  color: string | null;
  vin: string | null;
  notes: string | null;
  vehicleTypeId: string | null;
  vehicleSizeId: string | null;
  typeName: string | null;
  sizeName: string | null;
}

type Values = z.input<typeof vehicleSchema>;

export function VehicleManager({ vehicles, types, sizes }: { vehicles: VehicleView[]; types: { id: string; name: string }[]; sizes: { id: string; name: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<VehicleView | "new" | null>(null);
  const form = useForm<Values, unknown, z.output<typeof vehicleSchema>>({ resolver: zodResolver(vehicleSchema) });
  const action = useFormAction(form, saveVehicleAction, {
    onSuccess: () => {
      setEditing(null);
      router.refresh();
    },
  });

  function open(v: VehicleView | "new") {
    form.reset(
      v === "new"
        ? { year: "" as unknown as number, make: "", model: "", color: "", vin: "", notes: "", vehicleTypeId: "", vehicleSizeId: "" }
        : { year: v.year, make: v.make, model: v.model, color: v.color ?? "", vin: v.vin ?? "", notes: v.notes ?? "", vehicleTypeId: v.vehicleTypeId ?? "", vehicleSizeId: v.vehicleSizeId ?? "" },
    );
    setEditing(v);
  }

  async function remove(v: VehicleView) {
    const res = await deleteVehicleAction({ id: v.id });
    if (res.ok) {
      toast.success(res.message ?? "Removed");
      router.refresh();
    } else toast.error(res.error);
  }

  const errors = form.formState.errors;
  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button onClick={() => open("new")}>
          <Plus aria-hidden /> Add vehicle
        </Button>
      </div>
      {vehicles.length === 0 ? (
        <EmptyState icon={Car} title="No saved vehicles" description="Save your vehicles to book faster next time." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {vehicles.map((v) => (
            <li key={v.id} className="rounded-3xl border border-white/[0.08] bg-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">
                    {v.year} {v.make} {v.model}
                  </p>
                  <p className="text-sm text-muted-foreground">{[v.color, v.typeName, v.sizeName].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => open(v)} aria-label={`Edit ${v.make} ${v.model}`}>
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmButton
                    variant="ghost"
                    size="icon-sm"
                    title={`Remove ${v.year} ${v.make} ${v.model}?`}
                    description="This only removes it from your saved vehicles. Past appointments are unaffected."
                    confirmLabel="Remove"
                    onConfirm={() => remove(v)}
                    aria-label={`Remove ${v.make} ${v.model}`}
                  >
                    <Trash2 className="size-4 text-red-300" />
                  </ConfirmButton>
                </div>
              </div>
              {(v.vin || v.notes) && (
                <dl className="mt-4 grid gap-1 text-sm">
                  {v.vin && (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">VIN</dt>
                      <dd className="font-mono text-xs leading-5">{v.vin}</dd>
                    </div>
                  )}
                  {v.notes && <dd className="text-muted-foreground">{v.notes}</dd>}
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add a vehicle" : "Edit vehicle"}</DialogTitle>
            <DialogDescription>Used to prefill bookings and quotes.</DialogDescription>
          </DialogHeader>
          <form
            id="vehicle-form"
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit((v) => action.run({ ...v, id: editing && editing !== "new" ? editing.id : undefined }))}
          >
            <div className="grid gap-4 sm:grid-cols-[110px_1fr_1fr]">
              <Field id="v-year" label="Year" required error={errors.year?.message}>
                <Input inputMode="numeric" maxLength={4} {...form.register("year")} />
              </Field>
              <Field id="v-make" label="Make" required error={errors.make?.message}>
                <Input {...form.register("make")} />
              </Field>
              <Field id="v-model" label="Model" required error={errors.model?.message}>
                <Input {...form.register("model")} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="v-color" label="Color" error={errors.color?.message}>
                <Input {...form.register("color")} />
              </Field>
              <Field id="v-type" label="Type" error={errors.vehicleTypeId?.message}>
                <NativeSelect {...form.register("vehicleTypeId")}>
                  <option value="">—</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="v-size" label="Size" error={errors.vehicleSizeId?.message}>
                <NativeSelect {...form.register("vehicleSizeId")}>
                  <option value="">—</option>
                  {sizes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field id="v-vin" label="VIN" hint="Optional — 17 characters" error={errors.vin?.message}>
              <Input className="font-mono uppercase" maxLength={17} {...form.register("vin")} />
            </Field>
            <Field id="v-notes" label="Notes" error={errors.notes?.message}>
              <Textarea rows={2} {...form.register("notes")} />
            </Field>
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="vehicle-form" loading={action.pending}>
              Save vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

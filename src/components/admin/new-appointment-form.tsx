"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { emptyJob, normaliseJob, PriceBreakdown, useJob, type JobState } from "@/components/booking/configurator";
import { SlotPicker } from "@/components/booking/slot-picker";
import type { PricingCatalog } from "@/lib/pricing/engine";
import { centsToDollarsInput, dollarsToCents } from "@/lib/utils";
import { createAdminAppointmentAction } from "@/server/admin/appointments";

export interface NewAppointmentDefaults {
  quoteId?: string | null;
  userId?: string | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  vehicleYear?: number | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  job?: Partial<JobState>;
  priceOverride?: number | null;
  notes?: string | null;
}

export function NewAppointmentForm({
  catalog,
  technicians,
  customers,
  defaults,
  today,
  maxAdvanceDays,
}: {
  catalog: PricingCatalog;
  technicians: { id: string; name: string }[];
  customers: { id: string; name: string | null; email: string; phone: string | null }[];
  defaults: NewAppointmentDefaults;
  today: string;
  maxAdvanceDays: number;
}) {
  const router = useRouter();
  const [job, setJob] = React.useState<JobState>(() => normaliseJob(catalog, { ...emptyJob, ...defaults.job, addOnIds: defaults.job?.addOnIds ?? [] }));
  const d = useJob(catalog, job);
  const [contact, setContact] = React.useState({
    userId: defaults.userId ?? "",
    customerName: defaults.customerName ?? "",
    customerEmail: defaults.customerEmail ?? "",
    customerPhone: defaults.customerPhone ?? "",
  });
  const [vehicle, setVehicle] = React.useState({
    vehicleYear: defaults.vehicleYear ? String(defaults.vehicleYear) : "",
    vehicleMake: defaults.vehicleMake ?? "",
    vehicleModel: defaults.vehicleModel ?? "",
    vehicleColor: "",
  });
  const [slot, setSlot] = React.useState<{ date: string | null; time: string | null }>({ date: null, time: null });
  const [manualTime, setManualTime] = React.useState(false);
  const [technicianId, setTechnicianId] = React.useState("");
  const [status, setStatus] = React.useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [allowOverlap, setAllowOverlap] = React.useState(false);
  const [sendConfirmation, setSendConfirmation] = React.useState(true);
  const [override, setOverride] = React.useState(defaults.priceOverride != null ? centsToDollarsInput(defaults.priceOverride) : "");
  const [customerNotes, setCustomerNotes] = React.useState(defaults.notes ?? "");
  const [internalNotes, setInternalNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  const update = (patch: Partial<JobState>) => setJob((prev) => normaliseJob(catalog, { ...prev, ...patch }));

  function pickCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    setContact(c ? { userId: c.id, customerName: c.name ?? "", customerEmail: c.email, customerPhone: c.phone ?? "" } : { ...contact, userId: "" });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!slot.date || !slot.time) return setError("Choose a date and time.");
    start(async () => {
      const res = await createAdminAppointmentAction({
        userId: contact.userId || null,
        customerName: contact.customerName,
        customerEmail: contact.customerEmail,
        customerPhone: contact.customerPhone,
        config: {
          serviceId: job.serviceId,
          optionId: job.optionId,
          filmTypeId: d.service?.filmTypeId ?? job.filmTypeId,
          shade: job.shade,
          vehicleTypeId: job.vehicleTypeId,
          vehicleSizeId: job.vehicleSizeId,
          addOnIds: job.addOnIds,
        },
        vehicle: { ...vehicle, vehicleColor: vehicle.vehicleColor || null },
        date: slot.date,
        time: slot.time,
        technicianId: technicianId || null,
        status,
        customerNotes: customerNotes || null,
        internalNotes: internalNotes || null,
        allowOverlap: manualTime ? allowOverlap : false,
        sendConfirmation,
        quoteId: defaults.quoteId ?? null,
        priceOverride: override.trim() ? dollarsToCents(override) : null,
      });
      if (res.ok && res.data) {
        toast.success(res.message ?? "Appointment created");
        router.push(`/admin/appointments/${res.data.id}`);
      } else if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" noValidate>
      <div className="grid content-start gap-6">
        {error && <FormMessage type="error">{error}</FormMessage>}
        <section className="grid gap-4 rounded-2xl border border-white/[0.07] bg-card p-6">
          <h2 className="font-semibold">Customer</h2>
          <Field id="n-existing" label="Existing customer">
            <NativeSelect value={contact.userId} onChange={(e) => pickCustomer(e.target.value)}>
              <option value="">New / guest customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? c.email} — {c.email}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="n-name" label="Name" required>
              <Input value={contact.customerName} onChange={(e) => setContact({ ...contact, customerName: e.target.value })} />
            </Field>
            <Field id="n-email" label="Email" required>
              <Input type="email" value={contact.customerEmail} onChange={(e) => setContact({ ...contact, customerEmail: e.target.value })} />
            </Field>
            <Field id="n-phone" label="Phone" required>
              <Input value={contact.customerPhone} onChange={(e) => setContact({ ...contact, customerPhone: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            {(["vehicleYear", "vehicleMake", "vehicleModel", "vehicleColor"] as const).map((k) => (
              <Field key={k} id={`n-${k}`} label={k.replace("vehicle", "")} required={k !== "vehicleColor"}>
                <Input value={vehicle[k]} onChange={(e) => setVehicle({ ...vehicle, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-white/[0.07] bg-card p-6">
          <h2 className="font-semibold">Service</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="n-service" label="Service" required>
              <NativeSelect value={job.serviceId ?? ""} onChange={(e) => update({ serviceId: e.target.value || null })}>
                <option value="">Choose…</option>
                {catalog.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {d.coverage.length > 0 && (
              <Field id="n-option" label="Coverage / package" required>
                <NativeSelect value={job.optionId ?? ""} onChange={(e) => update({ optionId: e.target.value || null })}>
                  <option value="">Choose…</option>
                  {d.coverage.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field id="n-type" label="Vehicle type" required>
              <NativeSelect value={job.vehicleTypeId ?? ""} onChange={(e) => update({ vehicleTypeId: e.target.value || null })}>
                <option value="">Choose…</option>
                {catalog.vehicleTypes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="n-size" label="Vehicle size">
              <NativeSelect value={job.vehicleSizeId ?? ""} onChange={(e) => update({ vehicleSizeId: e.target.value || null })}>
                <option value="">Standard</option>
                {catalog.vehicleSizes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {d.needsFilm && !d.filmLocked && (
              <Field id="n-film" label="Film" required>
                <NativeSelect value={job.filmTypeId ?? ""} onChange={(e) => update({ filmTypeId: e.target.value || null })}>
                  <option value="">Choose…</option>
                  {d.films.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {d.film && d.film.shades.length > 0 && (
              <Field id="n-shade" label="Shade" required>
                <NativeSelect value={job.shade ?? ""} onChange={(e) => update({ shade: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Choose…</option>
                  {d.film.shades.map((s) => (
                    <option key={s} value={s}>
                      {s}%
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </div>
          {d.addOns.length > 0 && (
            <fieldset className="flex flex-wrap gap-4">
              <legend className="mb-2 text-sm font-medium">Add-ons</legend>
              {d.addOns.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={job.addOnIds.includes(a.id)}
                    onChange={(e) => update({ addOnIds: e.target.checked ? [...job.addOnIds, a.id] : job.addOnIds.filter((x) => x !== a.id) })}
                  />
                  {a.name}
                </label>
              ))}
            </fieldset>
          )}
        </section>

        <section className="grid gap-4 rounded-2xl border border-white/[0.07] bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Date &amp; time</h2>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={manualTime} onChange={(e) => setManualTime(e.target.checked)} /> Enter any time manually
            </label>
          </div>
          <Field id="n-tech" label="Technician">
            <NativeSelect value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
              <option value="">Auto-assign</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {manualTime ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="n-date" label="Date" required>
                <Input type="date" value={slot.date ?? ""} onChange={(e) => setSlot({ ...slot, date: e.target.value || null })} />
              </Field>
              <Field id="n-time" label="Start time" required>
                <Input type="time" step={900} value={slot.time ?? ""} onChange={(e) => setSlot({ ...slot, time: e.target.value || null })} />
              </Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Checkbox checked={allowOverlap} onChange={(e) => setAllowOverlap(e.target.checked)} /> Allow overlap with other bookings
              </label>
            </div>
          ) : d.pricingServiceId && d.price?.ok ? (
            <SlotPicker
              serviceId={d.pricingServiceId}
              duration={d.price.durationMinutes}
              technicianId={technicianId || null}
              today={today}
              maxAdvanceDays={maxAdvanceDays}
              value={slot}
              onChange={setSlot}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Configure the service to see open times.</p>
          )}
        </section>
      </div>

      <aside className="grid content-start gap-6 xl:sticky xl:top-8 xl:self-start">
        <section className="grid gap-4 rounded-2xl border border-white/[0.07] bg-card p-6">
          <h2 className="font-semibold">Price</h2>
          <PriceBreakdown price={d.price} />
          <Field id="n-override" label="Override subtotal ($)" hint="Optional — e.g. a quoted or discounted price">
            <Input inputMode="decimal" value={override} onChange={(e) => setOverride(e.target.value)} />
          </Field>
        </section>
        <section className="grid gap-4 rounded-2xl border border-white/[0.07] bg-card p-6">
          <Field id="n-status" label="Status">
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as "CONFIRMED" | "PENDING")}>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PENDING">Pending</option>
            </NativeSelect>
          </Field>
          <Field id="n-cnotes" label="Customer notes">
            <Textarea rows={2} value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} />
          </Field>
          <Field id="n-inotes" label="Internal notes">
            <Textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={sendConfirmation} onChange={(e) => setSendConfirmation(e.target.checked)} /> Email confirmation to customer
          </label>
          <Button type="submit" size="lg" loading={pending} disabled={!d.complete}>
            Create appointment
          </Button>
        </section>
      </aside>
    </form>
  );
}

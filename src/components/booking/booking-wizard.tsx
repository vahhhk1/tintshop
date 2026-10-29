"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowLeft, ArrowRight, CalendarCheck, Car, Clock, CreditCard, Lock, ShieldCheck, Store, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import {
  AddOnPicker,
  ChoiceCard,
  CoveragePicker,
  emptyJob,
  FilmPicker,
  normaliseJob,
  PriceBreakdown,
  ProgressBar,
  readPrefill,
  ShadePicker,
  StepHeading,
  useJob,
  VehicleSizePicker,
  VehicleTypePicker,
  type JobState,
} from "@/components/booking/configurator";
import { SlotPicker } from "@/components/booking/slot-picker";
import { useFormAction } from "@/hooks/use-form-action";
import { track } from "@/lib/analytics";
import { calculateTotals, type PricingCatalog } from "@/lib/pricing/engine";
import { formatHm, formatYmd } from "@/lib/time";
import { cn, formatCurrency, formatDuration } from "@/lib/utils";
import { bookingDetailsFormSchema } from "@/lib/validation/public";
import { createBookingAction } from "@/server/appointments/actions";

type StepId = "service" | "vehicle" | "options" | "time" | "details" | "review";
const LABELS: Record<StepId, string> = { service: "Service", vehicle: "Vehicle", options: "Options", time: "Date & time", details: "Your details", review: "Review & pay" };

export interface BookingSettings {
  taxRateBps: number;
  depositPercent: number;
  depositMinimum: number;
  requireDeposit: boolean;
  allowPayInFull: boolean;
  cancellationPolicy: string;
  maxAdvanceDays: number;
  today: string;
  holdMinutes: number;
}

export interface SavedVehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  color: string | null;
  vehicleTypeId: string | null;
  vehicleSizeId: string | null;
}

type DetailsValues = z.input<typeof bookingDetailsFormSchema>;
type PaymentChoice = "deposit" | "full" | "later";

export function BookingWizard({
  catalog,
  initial,
  settings,
  paymentMode,
  technicians,
  user,
  savedVehicles,
}: {
  catalog: PricingCatalog;
  initial: { serviceId: string | null; optionId: string | null; filmId: string | null; fromQuote: boolean };
  settings: BookingSettings;
  paymentMode: "stripe" | "demo" | "offline";
  technicians: { id: string; name: string; title: string | null; serviceIds: string[] }[];
  user: { name: string | null; email: string; phone: string | null } | null;
  savedVehicles: SavedVehicle[];
}) {
  const router = useRouter();
  const bookable = React.useMemo(() => catalog.services.filter((s) => s.bookable), [catalog]);
  // Selection + contact details carried over from the quote tool (sessionStorage, never the URL).
  // This component renders client-only when `fromQuote` is set, so reading storage here is safe.
  const [prefill] = React.useState(() => (initial.fromQuote && typeof window !== "undefined" ? readPrefill() : null));
  const [job, setJob] = React.useState<JobState>(() =>
    normaliseJob(
      catalog,
      prefill?.job
        ? { ...emptyJob, ...prefill.job, addOnIds: prefill.job.addOnIds ?? [] }
        : { ...emptyJob, serviceId: initial.serviceId, optionId: initial.optionId, filmTypeId: initial.filmId },
    ),
  );
  const [index, setIndex] = React.useState(prefill?.job ? 3 : initial.serviceId ? 1 : 0);
  const [slot, setSlot] = React.useState<{ date: string | null; time: string | null }>({ date: null, time: null });
  const [technicianId, setTechnicianId] = React.useState<string>("");
  const [vehicleId, setVehicleId] = React.useState<string | null>(null);
  const [saveVehicle, setSaveVehicle] = React.useState(true);
  const [payment, setPayment] = React.useState<PaymentChoice>(paymentMode === "offline" ? "later" : (prefill?.paymentChoice ?? "deposit"));
  const topRef = React.useRef<HTMLDivElement>(null);
  const derived = useJob(catalog, job);

  const c = prefill?.contact;
  const form = useForm<DetailsValues, unknown, z.output<typeof bookingDetailsFormSchema>>({
    resolver: zodResolver(bookingDetailsFormSchema),
    defaultValues: {
      name: c?.name || user?.name || "",
      email: c?.email || user?.email || "",
      phone: c?.phone || user?.phone || "",
      vehicleYear: (c?.vehicleYear ?? "") as unknown as number,
      vehicleMake: c?.vehicleMake ?? "",
      vehicleModel: c?.vehicleModel ?? "",
      vehicleColor: "",
      notes: c?.notes ?? "",
    },
  });

  React.useEffect(() => {
    track("booking_started", { source: initial.fromQuote ? "quote" : "direct" });
  }, [initial.fromQuote]);

  const steps: StepId[] = ["service", "vehicle", "options", "time", "details", "review"];
  const step = steps[index]!;

  const action = useFormAction(null, createBookingAction, {
    successToast: false,
    onSuccess: (res) => {
      const data = res.data as { url: string; reference: string; paymentChoice: string } | undefined;
      if (!data) return;
      track("booking_completed", { reference: data.reference, payment: data.paymentChoice });
      if (data.paymentChoice !== "later") track("checkout_started", { reference: data.reference });
      router.push(data.url);
    },
    onError: (error) => {
      // The chosen time was taken meanwhile — send the customer back to pick another.
      if (/time|slot|taken|available/i.test(error)) {
        setSlot((prev) => ({ ...prev, time: null }));
        setIndex(3);
      }
    },
  });

  function update(patch: Partial<JobState>) {
    setJob((prev) => normaliseJob(catalog, { ...prev, ...patch }));
  }

  function go(delta: number) {
    setIndex((i) => Math.max(0, Math.min(steps.length - 1, i + delta)));
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function chooseSavedVehicle(id: string | null) {
    setVehicleId(id);
    const v = savedVehicles.find((x) => x.id === id);
    if (!v) return;
    update({ vehicleTypeId: v.vehicleTypeId ?? job.vehicleTypeId, vehicleSizeId: v.vehicleSizeId ?? job.vehicleSizeId });
    form.setValue("vehicleYear", v.year);
    form.setValue("vehicleMake", v.make);
    form.setValue("vehicleModel", v.model);
    form.setValue("vehicleColor", v.color ?? "");
  }

  const eligibleTechs = technicians.filter((t) => !t.serviceIds.length || (derived.pricingServiceId && t.serviceIds.includes(derived.pricingServiceId)));
  const price = derived.price?.ok ? derived.price : null;
  const service = derived.service;
  const parent = service?.parentId ? catalog.services.find((s) => s.id === service.parentId) : null;
  const totals = price
    ? calculateTotals({
        subtotal: price.subtotal,
        taxRateBps: settings.taxRateBps,
        depositPercent: settings.depositPercent,
        depositMinimum: settings.depositMinimum,
        depositOverride: service?.depositAmount ?? parent?.depositAmount ?? null,
      })
    : null;

  const canContinue = (() => {
    switch (step) {
      case "service":
        return Boolean(service);
      case "vehicle":
        return Boolean(job.vehicleTypeId && job.vehicleSizeId);
      case "options":
        return derived.complete;
      case "time":
        return Boolean(slot.date && slot.time);
      default:
        return true;
    }
  })();

  async function next() {
    if (step === "details") {
      const ok = await form.trigger();
      if (!ok) return;
    }
    go(1);
  }

  function submit() {
    if (!price || !slot.date || !slot.time) return;
    const d = form.getValues();
    action.run({
      config: {
        serviceId: job.serviceId,
        optionId: job.optionId,
        filmTypeId: service?.filmTypeId ?? job.filmTypeId,
        shade: job.shade,
        vehicleTypeId: job.vehicleTypeId,
        vehicleSizeId: job.vehicleSizeId,
        addOnIds: job.addOnIds,
      },
      date: slot.date,
      time: slot.time,
      technicianId: technicianId || null,
      contact: { name: d.name, email: d.email, phone: d.phone },
      vehicle: {
        vehicleYear: d.vehicleYear,
        vehicleMake: d.vehicleMake,
        vehicleModel: d.vehicleModel,
        vehicleColor: d.vehicleColor || null,
        vehicleId,
        saveVehicle: Boolean(user && saveVehicle && !vehicleId),
      },
      notes: d.notes || null,
      paymentChoice: payment,
      company: "",
    });
  }

  const dueNow = totals ? (payment === "deposit" ? totals.deposit : payment === "full" ? totals.total : 0) : 0;
  const errors = form.formState.errors;

  return (
    <div ref={topRef} className="grid scroll-mt-24 gap-8 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 rounded-3xl border border-white/[0.08] bg-card p-5 sm:p-8">
        <ProgressBar step={index} total={steps.length} labels={steps.map((s) => LABELS[s])} />
        <div key={step} className="mt-8 min-h-[340px] animate-in fade-in slide-in-from-right-2 duration-300">
          {step === "service" && (
            <>
              <StepHeading title="Choose a service" description="Not sure? Start with window tint — you can pick the film next." />
              <div role="radiogroup" aria-label="Service" className="grid gap-3 sm:grid-cols-2">
                {bookable.map((s) => (
                  <ChoiceCard
                    key={s.id}
                    selected={job.serviceId === s.id}
                    onSelect={() => {
                      update({ serviceId: s.id });
                      window.setTimeout(() => go(1), 160);
                    }}
                    icon={
                      s.imageUrl ? (
                        <span className="relative block size-14 overflow-hidden rounded-xl">
                          <Image src={s.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                        </span>
                      ) : undefined
                    }
                    title={s.name}
                    description={<span className="line-clamp-2">{s.shortDescription}</span>}
                  />
                ))}
              </div>
            </>
          )}

          {step === "vehicle" && (
            <>
              <StepHeading title="Tell us about your vehicle" />
              {savedVehicles.length > 0 && (
                <div className="mb-6">
                  <p className="mb-2 text-sm font-medium">Your saved vehicles</p>
                  <div className="flex flex-wrap gap-2">
                    {savedVehicles.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => chooseSavedVehicle(vehicleId === v.id ? null : v.id)}
                        aria-pressed={vehicleId === v.id}
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                          vehicleId === v.id ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/25",
                        )}
                      >
                        <Car className="size-4" aria-hidden /> {v.year} {v.make} {v.model}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="mb-3 text-sm font-medium">Vehicle type</p>
              <VehicleTypePicker catalog={catalog} value={job.vehicleTypeId} onChange={(id) => update({ vehicleTypeId: id })} />
              <p className="mt-8 mb-3 text-sm font-medium">Size</p>
              <VehicleSizePicker
                catalog={catalog}
                value={job.vehicleSizeId}
                onChange={(id) => {
                  update({ vehicleSizeId: id });
                  if (job.vehicleTypeId) window.setTimeout(() => go(1), 160);
                }}
              />
            </>
          )}

          {step === "options" && (
            <div className="grid gap-10">
              {derived.coverage.length > 0 && (
                <section>
                  <StepHeading title={service?.category === "WINDOW_TINT" ? "What should we tint?" : "Choose your package"} />
                  <CoveragePicker catalog={catalog} job={job} onChange={(id) => update({ optionId: id })} />
                </section>
              )}
              {derived.needsFilm && !derived.filmLocked && (
                <section>
                  <h3 className="mb-4 text-lg font-semibold">Film</h3>
                  <FilmPicker films={derived.films} job={job} catalog={catalog} onChange={(id) => update({ filmTypeId: id })} />
                </section>
              )}
              {derived.needsShade && derived.film && (
                <section>
                  <h3 className="mb-4 text-lg font-semibold">Tint percentage</h3>
                  <ShadePicker film={derived.film} value={job.shade} onChange={(s) => update({ shade: s })} />
                </section>
              )}
              {derived.addOns.length > 0 && (
                <section>
                  <h3 className="mb-4 text-lg font-semibold">Add-ons</h3>
                  <AddOnPicker
                    catalog={catalog}
                    job={job}
                    onToggle={(id) => update({ addOnIds: job.addOnIds.includes(id) ? job.addOnIds.filter((a) => a !== id) : [...job.addOnIds, id] })}
                  />
                </section>
              )}
            </div>
          )}

          {step === "time" && derived.pricingServiceId && price && (
            <>
              <StepHeading
                title="Pick a date & time"
                description={
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" aria-hidden /> Your appointment takes about {formatDuration(price.durationMinutes)}. Only open times are shown.
                  </span>
                }
              />
              {eligibleTechs.length > 1 && (
                <label className="mb-6 grid max-w-sm gap-1.5 text-sm">
                  <span className="font-medium">Technician</span>
                  <NativeSelect value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
                    <option value="">Any available technician</option>
                    {eligibleTechs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.title ? ` — ${t.title}` : ""}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              )}
              <SlotPicker
                serviceId={derived.pricingServiceId}
                duration={price.durationMinutes}
                technicianId={technicianId || null}
                today={settings.today}
                maxAdvanceDays={settings.maxAdvanceDays}
                value={slot}
                onChange={setSlot}
              />
            </>
          )}

          {step === "details" && (
            <>
              <StepHeading
                title="Your details"
                description={
                  user ? undefined : (
                    <>
                      Have an account?{" "}
                      <Link href="/login?callbackUrl=/book" className="text-primary underline-offset-4 hover:underline">
                        Sign in
                      </Link>{" "}
                      to use saved vehicles — or continue as a guest.
                    </>
                  )
                }
              />
              <form
                noValidate
                className="grid gap-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void next();
                }}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="b-name" label="Full name" required error={errors.name?.message}>
                    <Input autoComplete="name" {...form.register("name")} />
                  </Field>
                  <Field id="b-phone" label="Mobile phone" required error={errors.phone?.message}>
                    <Input type="tel" inputMode="tel" autoComplete="tel" {...form.register("phone")} />
                  </Field>
                </div>
                <Field id="b-email" label="Email" required error={errors.email?.message} hint="Your confirmation and receipt are sent here">
                  <Input type="email" inputMode="email" autoComplete="email" {...form.register("email")} />
                </Field>
                <div className="grid gap-5 sm:grid-cols-[110px_1fr_1fr_1fr]">
                  <Field id="b-year" label="Year" required error={errors.vehicleYear?.message}>
                    <Input inputMode="numeric" maxLength={4} placeholder="2024" {...form.register("vehicleYear")} />
                  </Field>
                  <Field id="b-make" label="Make" required error={errors.vehicleMake?.message}>
                    <Input placeholder="Tesla" {...form.register("vehicleMake")} />
                  </Field>
                  <Field id="b-model" label="Model" required error={errors.vehicleModel?.message}>
                    <Input placeholder="Model Y" {...form.register("vehicleModel")} />
                  </Field>
                  <Field id="b-color" label="Color" error={errors.vehicleColor?.message}>
                    <Input placeholder="White" {...form.register("vehicleColor")} />
                  </Field>
                </div>
                <Field id="b-notes" label="Notes for the installer" error={errors.notes?.message}>
                  <Textarea rows={3} placeholder="Existing tint to remove, factory privacy glass, questions…" {...form.register("notes")} />
                </Field>
                {user && !vehicleId && (
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox checked={saveVehicle} onChange={(e) => setSaveVehicle(e.target.checked)} /> Save this vehicle to my account
                  </label>
                )}
                <button type="submit" className="hidden" tabIndex={-1} aria-hidden />
              </form>
            </>
          )}

          {step === "review" && totals && price && slot.date && slot.time && (
            <>
              <StepHeading title="Review & confirm" />
              {action.result && !action.result.ok && <FormMessage type="error">{action.result.error}</FormMessage>}
              <dl className="mt-2 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm sm:grid-cols-2">
                <ReviewItem icon={<CalendarCheck className="size-4" />} label="When" value={`${formatYmd(slot.date, { weekday: "long", month: "long", day: "numeric" })} · ${formatHm(slot.time)}`} />
                <ReviewItem icon={<Car className="size-4" />} label="Vehicle" value={`${form.getValues("vehicleYear")} ${form.getValues("vehicleMake")} ${form.getValues("vehicleModel")}`} />
                <ReviewItem icon={<UserRound className="size-4" />} label="Contact" value={`${form.getValues("name")} · ${form.getValues("phone")}`} />
                <ReviewItem icon={<Clock className="size-4" />} label="Duration" value={formatDuration(price.durationMinutes)} />
              </dl>

              <fieldset className="mt-8">
                <legend className="mb-3 text-lg font-semibold">Payment</legend>
                {paymentMode === "offline" ? (
                  <p className="rounded-2xl border border-white/10 p-4 text-sm text-muted-foreground">Online payment isn’t available right now — you’ll pay at the shop after your service.</p>
                ) : (
                  <div role="radiogroup" aria-label="Payment option" className="grid gap-3">
                    <ChoiceCard
                      selected={payment === "deposit"}
                      onSelect={() => setPayment("deposit")}
                      icon={<CreditCard className="size-5" />}
                      title={`Pay ${formatCurrency(totals.deposit, { exact: true })} deposit now`}
                      description={`Balance of ${formatCurrency(totals.total - totals.deposit, { exact: true })} due at pickup. Refundable per our cancellation policy.`}
                    />
                    {settings.allowPayInFull && (
                      <ChoiceCard
                        selected={payment === "full"}
                        onSelect={() => setPayment("full")}
                        icon={<ShieldCheck className="size-5" />}
                        title={`Pay in full — ${formatCurrency(totals.total, { exact: true })}`}
                        description="Skip the counter at pickup."
                      />
                    )}
                    {!settings.requireDeposit && (
                      <ChoiceCard
                        selected={payment === "later"}
                        onSelect={() => setPayment("later")}
                        icon={<Store className="size-5" />}
                        title="Pay at the shop"
                        description="Reserve now and pay after your service."
                      />
                    )}
                  </div>
                )}
              </fieldset>
              {paymentMode === "demo" && payment !== "later" && (
                <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                  Demo mode: Stripe isn’t configured, so a simulated checkout is used. No real payment is taken.
                </p>
              )}
              <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
                {settings.cancellationPolicy}{" "}
                <Link href="/legal/cancellation" className="underline underline-offset-2">
                  Policy
                </Link>
                {" · "}
                <Link href="/legal/terms" className="underline underline-offset-2">
                  Terms
                </Link>
              </p>
            </>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-6">
          <Button variant="ghost" onClick={() => go(-1)} disabled={index === 0 || action.pending}>
            <ArrowLeft aria-hidden /> Back
          </Button>
          {step === "review" ? (
            <Button size="lg" onClick={submit} loading={action.pending} disabled={!totals}>
              {!action.pending && (payment === "later" ? <CalendarCheck aria-hidden /> : <Lock aria-hidden />)}
              {payment === "later" ? "Confirm booking" : `Continue to payment · ${formatCurrency(dueNow, { exact: true })}`}
            </Button>
          ) : (
            <Button size="lg" onClick={() => void next()} disabled={!canContinue}>
              Continue <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Booking summary">
        <div className="rounded-3xl border border-white/[0.08] bg-card p-6">
          <h2 className="text-sm font-semibold tracking-[0.16em] text-foreground/50 uppercase">Summary</h2>
          {service ? (
            <div className="mt-4 flex items-center gap-3">
              {service.imageUrl && (
                <span className="relative size-12 shrink-0 overflow-hidden rounded-xl">
                  <Image src={service.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                </span>
              )}
              <div>
                <p className="font-semibold">{service.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[derived.coverage.find((o) => o.id === job.optionId)?.name, derived.film?.name, job.shade ? `${job.shade}%` : null].filter(Boolean).join(" · ") || "Configure your service"}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Choose a service to begin.</p>
          )}
          {slot.date && slot.time && (
            <p className="mt-4 flex items-center gap-2 text-sm">
              <CalendarCheck className="size-4 text-primary" aria-hidden />
              {formatYmd(slot.date)} · {formatHm(slot.time)}
            </p>
          )}
          <div className="mt-5 border-t border-white/10 pt-5">
            <PriceBreakdown price={derived.price?.ok ? derived.price : null} />
            {totals && (
              <dl className="mt-4 grid gap-1.5 border-t border-white/10 pt-4 text-sm">
                {totals.tax > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tax ({(settings.taxRateBps / 100).toFixed(2)}%)</dt>
                    <dd className="tabular-nums">{formatCurrency(totals.tax, { exact: true })}</dd>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatCurrency(totals.total, { exact: true })}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Deposit to reserve</dt>
                  <dd className="tabular-nums">{formatCurrency(totals.deposit, { exact: true })}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden /> Secure checkout · Prices verified on our server
        </p>
      </aside>
    </div>
  );
}

function ReviewItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
    </div>
  );
}

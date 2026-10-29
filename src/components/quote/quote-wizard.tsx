"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowLeft, ArrowRight, CalendarCheck, CheckCircle2, CreditCard, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import {
  AddOnPicker,
  CoveragePicker,
  emptyJob,
  FilmPicker,
  normaliseJob,
  PriceBreakdown,
  ProgressBar,
  savePrefill,
  ShadePicker,
  StepHeading,
  useJob,
  VehicleSizePicker,
  VehicleTypePicker,
  type JobState,
} from "@/components/booking/configurator";
import { useFormAction } from "@/hooks/use-form-action";
import { track } from "@/lib/analytics";
import type { PricingCatalog } from "@/lib/pricing/engine";
import { cn, formatCurrency } from "@/lib/utils";
import { quoteContactFormSchema } from "@/lib/validation/public";
import { submitQuoteAction } from "@/server/quotes/actions";

type StepId = "vehicle" | "size" | "service" | "film" | "shade" | "estimate" | "details" | "finish";
const LABELS: Record<StepId, string> = {
  vehicle: "Vehicle type",
  size: "Vehicle size",
  service: "Service",
  film: "Film",
  shade: "Tint %",
  estimate: "Estimate",
  details: "Your details",
  finish: "Next steps",
};

type ContactValues = z.input<typeof quoteContactFormSchema>;

export function QuoteWizard({
  catalog,
  initialServiceId,
  initialOptionId,
  initialFilmId,
  user,
  depositPercent,
  canPayOnline,
}: {
  catalog: PricingCatalog;
  initialServiceId: string | null;
  initialOptionId?: string | null;
  initialFilmId?: string | null;
  user: { name: string | null; email: string; phone: string | null } | null;
  depositPercent: number;
  canPayOnline: boolean;
}) {
  const router = useRouter();
  const [job, setJob] = React.useState<JobState>(() =>
    normaliseJob(catalog, { ...emptyJob, serviceId: initialServiceId, optionId: initialOptionId ?? null, filmTypeId: initialFilmId ?? null }),
  );
  const derived = useJob(catalog, job);
  const steps = React.useMemo<StepId[]>(() => {
    const s: StepId[] = ["vehicle", "size", "service"];
    if (derived.needsFilm && !derived.filmLocked) s.push("film");
    if (derived.needsShade || (derived.needsFilm && !derived.film)) s.push("shade");
    s.push("estimate", "details", "finish");
    return s;
  }, [derived.needsFilm, derived.filmLocked, derived.needsShade, derived.film]);
  const [index, setIndex] = React.useState(0);
  const step = steps[Math.min(index, steps.length - 1)]!;
  const started = React.useRef(false);
  const topRef = React.useRef<HTMLDivElement>(null);

  const form = useForm<ContactValues, unknown, z.output<typeof quoteContactFormSchema>>({
    resolver: zodResolver(quoteContactFormSchema),
    defaultValues: { name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", vehicleYear: "" as unknown as number, vehicleMake: "", vehicleModel: "", notes: "" },
  });
  const action = useFormAction(form, submitQuoteAction, {
    successToast: false,
    onSuccess: (res) => track("quote_completed", { value: (res.data as { estimate?: number } | undefined)?.estimate ? ((res.data as { estimate: number }).estimate / 100) : undefined }),
  });

  function update(patch: Partial<JobState>, advance = false) {
    if (!started.current) {
      started.current = true;
      track("quote_started");
    }
    setJob((prev) => normaliseJob(catalog, { ...prev, ...patch }));
    if (advance) window.setTimeout(() => go(1), 180);
  }

  function go(delta: number) {
    setIndex((i) => Math.max(0, Math.min(steps.length - 1, i + delta)));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const canContinue = (() => {
    switch (step) {
      case "vehicle":
        return Boolean(job.vehicleTypeId);
      case "size":
        return Boolean(job.vehicleSizeId);
      case "service":
        return Boolean(derived.service && (!derived.coverage.length || job.optionId));
      case "film":
        return Boolean(derived.film);
      case "shade":
        return !derived.needsShade || Boolean(job.shade);
      case "estimate":
        return derived.complete;
      default:
        return true;
    }
  })();

  async function nextFromDetails() {
    const ok = await form.trigger();
    if (ok) go(1);
  }

  function payload() {
    const contact = form.getValues();
    return {
      config: {
        serviceId: job.serviceId,
        optionId: job.optionId,
        filmTypeId: derived.service?.filmTypeId ?? job.filmTypeId,
        shade: job.shade,
        vehicleTypeId: job.vehicleTypeId,
        vehicleSizeId: job.vehicleSizeId,
        addOnIds: job.addOnIds,
      },
      contact,
      company: "",
    };
  }

  function continueToBooking(paymentChoice: "deposit" | "later") {
    const contact = form.getValues();
    savePrefill({ job, contact: { ...contact, vehicleYear: contact.vehicleYear as number }, paymentChoice });
    track("booking_started", { source: "quote" });
    router.push("/book?from=quote");
  }

  const bookableService = derived.service?.bookable !== false;
  const price = derived.price?.ok ? derived.price : null;

  if (action.result?.ok) {
    const data = action.result.data as { reference: string; estimate: number } | undefined;
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-white/[0.08] bg-card p-8 text-center sm:p-12" role="status">
        <CheckCircle2 className="mx-auto size-14 text-emerald-400" aria-hidden />
        <h2 className="mt-5 text-3xl font-semibold">Quote request sent</h2>
        <p className="mt-3 text-muted-foreground">
          Reference <strong className="text-foreground">{data?.reference}</strong>. Your estimate is{" "}
          <strong className="text-foreground">{formatCurrency(data?.estimate ?? 0, { exact: true })}</strong> before tax. We’ve emailed you a copy and will confirm within one business day.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {bookableService && (
            <Button size="lg" onClick={() => continueToBooking("deposit")}>
              <CalendarCheck aria-hidden /> Book this now
            </Button>
          )}
          <Button asChild size="lg" variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={topRef} className="grid scroll-mt-24 gap-8 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 rounded-3xl border border-white/[0.08] bg-card p-5 sm:p-8">
        <ProgressBar step={index} total={steps.length} labels={steps.map((s) => LABELS[s])} />
        <div key={step} className="mt-8 min-h-[320px] animate-in fade-in slide-in-from-right-2 duration-300">
          {step === "vehicle" && (
            <>
              <StepHeading title="What are you driving?" description="Pricing adjusts automatically for your vehicle." />
              <VehicleTypePicker catalog={catalog} value={job.vehicleTypeId} onChange={(id) => update({ vehicleTypeId: id }, true)} />
            </>
          )}
          {step === "size" && (
            <>
              <StepHeading title="How big is it?" description="Larger vehicles have more glass and take longer to tint." />
              <VehicleSizePicker catalog={catalog} value={job.vehicleSizeId} onChange={(id) => update({ vehicleSizeId: id }, true)} />
            </>
          )}
          {step === "service" && (
            <>
              <StepHeading title="What would you like done?" />
              <label className="mb-5 grid gap-1.5 text-sm">
                <span className="text-muted-foreground">Service</span>
                <NativeSelect value={job.serviceId ?? ""} onChange={(e) => update({ serviceId: e.target.value || null })}>
                  <option value="">Choose a service…</option>
                  {catalog.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              {derived.coverage.length > 0 && <CoveragePicker catalog={catalog} job={job} onChange={(id) => update({ optionId: id }, true)} />}
            </>
          )}
          {step === "film" && (
            <>
              <StepHeading title="Choose your film" description="All films block 99% of UV. Higher grades reject more heat and last longer." />
              <FilmPicker films={derived.films} job={job} catalog={catalog} onChange={(id) => update({ filmTypeId: id }, true)} />
            </>
          )}
          {step === "shade" && derived.film && (
            <>
              <StepHeading title="Pick a tint percentage" description={`${derived.film.name} film is available in these shades.`} />
              <ShadePicker film={derived.film} value={job.shade} onChange={(s) => update({ shade: s }, true)} />
            </>
          )}
          {step === "estimate" && (
            <>
              <StepHeading title="Your estimated price" description="Calculated live from our current pricing. Add any extras below." />
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <PriceBreakdown price={derived.price} />
              </div>
              {derived.addOns.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-semibold">Popular add-ons</h3>
                  <AddOnPicker
                    catalog={catalog}
                    job={job}
                    onToggle={(id) => update({ addOnIds: job.addOnIds.includes(id) ? job.addOnIds.filter((a) => a !== id) : [...job.addOnIds, id] })}
                  />
                </div>
              )}
              <p className="mt-5 text-xs text-muted-foreground">Estimate excludes tax. Final price is confirmed after a quick look at your vehicle (e.g. if old film needs removing).</p>
            </>
          )}
          {step === "details" && (
            <>
              <StepHeading title="Where should we send your quote?" />
              <form
                className="grid gap-5"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void nextFromDetails();
                }}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="q-name" label="Name" required error={form.formState.errors.name?.message}>
                    <Input autoComplete="name" {...form.register("name")} />
                  </Field>
                  <Field id="q-phone" label="Phone" required error={form.formState.errors.phone?.message}>
                    <Input type="tel" inputMode="tel" autoComplete="tel" {...form.register("phone")} />
                  </Field>
                </div>
                <Field id="q-email" label="Email" required error={form.formState.errors.email?.message}>
                  <Input type="email" inputMode="email" autoComplete="email" {...form.register("email")} />
                </Field>
                <div className="grid gap-5 sm:grid-cols-[120px_1fr_1fr]">
                  <Field id="q-year" label="Year" required error={form.formState.errors.vehicleYear?.message}>
                    <Input inputMode="numeric" placeholder="2024" maxLength={4} {...form.register("vehicleYear")} />
                  </Field>
                  <Field id="q-make" label="Make" required error={form.formState.errors.vehicleMake?.message}>
                    <Input placeholder="Tesla" autoComplete="off" {...form.register("vehicleMake")} />
                  </Field>
                  <Field id="q-model" label="Model" required error={form.formState.errors.vehicleModel?.message}>
                    <Input placeholder="Model Y" autoComplete="off" {...form.register("vehicleModel")} />
                  </Field>
                </div>
                <Field id="q-notes" label="Notes" error={form.formState.errors.notes?.message} hint="Existing tint, preferred dates, questions…">
                  <Textarea rows={3} {...form.register("notes")} />
                </Field>
                <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
              </form>
            </>
          )}
          {step === "finish" && (
            <>
              <StepHeading title="How would you like to continue?" description="Lock in a time now, or send us your quote request and we’ll get back to you." />
              {action.result && !action.result.ok && <FormMessage type="error">{action.result.error}</FormMessage>}
              <div className="mt-4 grid gap-3">
                {bookableService && canPayOnline && (
                  <FinishOption
                    icon={<CreditCard className="size-5" />}
                    title="Pay deposit & reserve"
                    description={`Choose your time and secure it with a ${depositPercent}% deposit.`}
                    onClick={() => continueToBooking("deposit")}
                    primary
                  />
                )}
                {bookableService && (
                  <FinishOption
                    icon={<CalendarCheck className="size-5" />}
                    title="Book appointment"
                    description="Pick a date and time that works for you."
                    onClick={() => continueToBooking("later")}
                    primary={!canPayOnline}
                  />
                )}
                <FinishOption
                  icon={<Send className="size-5" />}
                  title="Request quote"
                  description="Send this to our team — we’ll confirm the price and follow up."
                  onClick={() => action.run(payload())}
                  loading={action.pending}
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-6">
          <Button variant="ghost" onClick={() => go(-1)} disabled={index === 0}>
            <ArrowLeft aria-hidden /> Back
          </Button>
          {step !== "finish" && (
            <Button onClick={() => (step === "details" ? void nextFromDetails() : go(1))} disabled={!canContinue} size="lg">
              Continue <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Quote summary">
        <div className="rounded-3xl border border-white/[0.08] bg-card p-6">
          <h2 className="text-sm font-semibold tracking-[0.16em] text-foreground/50 uppercase">Your quote</h2>
          <dl className="mt-4 grid gap-2.5 text-sm">
            <SummaryRow label="Vehicle" value={catalog.vehicleTypes.find((v) => v.id === job.vehicleTypeId)?.name} />
            <SummaryRow label="Size" value={catalog.vehicleSizes.find((v) => v.id === job.vehicleSizeId)?.name} />
            <SummaryRow label="Service" value={derived.service?.name} />
            <SummaryRow label="Coverage" value={derived.coverage.find((o) => o.id === job.optionId)?.name} hidden={!derived.coverage.length} />
            <SummaryRow label="Film" value={derived.film?.name} hidden={!derived.needsFilm} />
            <SummaryRow label="Shade" value={job.shade ? `${job.shade}%` : undefined} hidden={!derived.needsShade} />
          </dl>
          <div className="mt-5 border-t border-white/10 pt-5">
            {price ? <PriceBreakdown price={price} compact /> : <p className="text-sm text-muted-foreground">Your price appears as you choose.</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({ label, value, hidden }: { label: string; value?: string | null; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right font-medium", !value && "text-foreground/30")}>{value ?? "—"}</dd>
    </div>
  );
}

function FinishOption({
  icon,
  title,
  description,
  onClick,
  primary,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex items-center gap-4 rounded-2xl border p-5 text-left transition-colors disabled:opacity-60",
        primary ? "border-primary/60 bg-primary/[0.08] hover:bg-primary/[0.12]" : "border-white/10 hover:border-white/25 hover:bg-white/[0.03]",
      )}
    >
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", primary ? "bg-primary text-primary-foreground" : "bg-white/[0.06] text-foreground")}>{icon}</span>
      <span className="flex-1">
        <span className="block font-semibold">{loading ? "Sending…" : title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
    </button>
  );
}

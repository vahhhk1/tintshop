"use client";

import * as React from "react";
import { Check, Clock, Info } from "lucide-react";
import {
  addOnsFor,
  calculatePrice,
  coverageOptionsFor,
  filmsFor,
  type CatalogFilm,
  type PriceResult,
  type PricingCatalog,
} from "@/lib/pricing/engine";
import { cn, formatCurrency, formatDuration } from "@/lib/utils";

export interface JobState {
  serviceId: string | null;
  vehicleTypeId: string | null;
  vehicleSizeId: string | null;
  optionId: string | null;
  filmTypeId: string | null;
  shade: number | null;
  addOnIds: string[];
}

export const emptyJob: JobState = { serviceId: null, vehicleTypeId: null, vehicleSizeId: null, optionId: null, filmTypeId: null, shade: null, addOnIds: [] };

/** Derived option lists + live price for the current selection. */
export function useJob(catalog: PricingCatalog, job: JobState) {
  return React.useMemo(() => {
    const service = job.serviceId ? (catalog.services.find((s) => s.id === job.serviceId) ?? null) : null;
    const coverage = service ? coverageOptionsFor(catalog, service.id) : [];
    const addOns = service ? addOnsFor(catalog, service.id) : [];
    const films = service ? filmsFor(catalog, service.id) : [];
    const effectiveFilmId = service?.filmTypeId ?? job.filmTypeId;
    const film = films.find((f) => f.id === effectiveFilmId) ?? null;
    let price: PriceResult | null = null;
    if (service && job.vehicleTypeId) {
      price = calculatePrice(catalog, {
        serviceId: service.id,
        optionId: job.optionId,
        filmTypeId: effectiveFilmId,
        vehicleTypeId: job.vehicleTypeId,
        vehicleSizeId: job.vehicleSizeId,
        addOnIds: job.addOnIds,
      });
    }
    const needsFilm = films.length > 0;
    const filmLocked = Boolean(service?.filmTypeId);
    const needsShade = Boolean(film && film.shades.length > 0);
    const complete = Boolean(
      service && job.vehicleTypeId && (!coverage.length || job.optionId) && (!needsFilm || film) && (!needsShade || (job.shade && film?.shades.includes(job.shade))) && price?.ok,
    );
    return { service, coverage, addOns, films, film, price, needsFilm, filmLocked, needsShade, complete, pricingServiceId: service?.parentId ?? service?.id ?? null };
  }, [catalog, job]);
}

/** Normalises a job after a change (clears choices that no longer apply). */
export function normaliseJob(catalog: PricingCatalog, next: JobState): JobState {
  const service = next.serviceId ? catalog.services.find((s) => s.id === next.serviceId) : null;
  if (!service) return { ...next, optionId: null, filmTypeId: null, shade: null, addOnIds: [] };
  const coverage = coverageOptionsFor(catalog, service.id);
  const addOns = addOnsFor(catalog, service.id);
  const films = filmsFor(catalog, service.id);
  const optionId = coverage.some((o) => o.id === next.optionId) ? next.optionId : coverage.length === 1 ? coverage[0]!.id : null;
  const filmTypeId = service.filmTypeId ?? (films.some((f) => f.id === next.filmTypeId) ? next.filmTypeId : films.length === 1 ? films[0]!.id : null);
  const film = films.find((f) => f.id === filmTypeId);
  const shade = film && next.shade && film.shades.includes(next.shade) ? next.shade : null;
  return { ...next, optionId, filmTypeId, shade, addOnIds: next.addOnIds.filter((id) => addOns.some((a) => a.id === id)) };
}

// ─── Building blocks ─────────────────────────────────────────────────────────

export function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  meta,
  icon,
  className,
  name,
  centered,
}: {
  centered?: boolean;
  selected: boolean;
  onSelect: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  name?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-name={name}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-[border-color,background-color,transform] active:scale-[0.99] sm:p-5",
        selected ? "border-primary bg-primary/[0.08]" : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]",
        className,
      )}
    >
      {icon && <span className={cn("shrink-0 transition-colors", selected ? "text-primary" : "text-foreground/70")}>{icon}</span>}
      <span className={cn("min-w-0 flex-1", centered && "w-full")}>
        <span className={cn("flex items-start gap-3", centered ? "justify-center text-center" : "justify-between")}>
          <span className="font-semibold">{title}</span>
          {meta && <span className="shrink-0 text-sm font-medium text-foreground/80 tabular-nums">{meta}</span>}
        </span>
        {description && <span className={cn("mt-1 block text-sm leading-snug text-muted-foreground", centered && "text-center")}>{description}</span>}
      </span>
      <span
        className={cn(
          "absolute top-3 right-3 grid size-5 place-items-center rounded-full border transition-colors",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-white/20 opacity-0 group-hover:opacity-100",
          meta && "hidden",
        )}
        aria-hidden
      >
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
    </button>
  );
}

const VEHICLE_PATHS: Record<string, string> = {
  coupe: "M4 21 7.5 15.5 21 13 29 7.5h13.5L51 13.5l8 2V21Z",
  sedan: "M3 21 5.5 15.5 17 13l7.5-6.5h17L50 13l9.5 2 .5 6Z",
  suv: "M3 21 3.5 13 11 11.5 16.5 4.5h33.5l6 7 4.5 1.5V21Z",
  truck: "M3 21V13l10-1.5 5-7.5h15l2 7.5h26V21Z",
  van: "M3 21V9.5C3 6 5 4.5 8.5 4.5H49l11 8.5V21Z",
};

export function VehicleIcon({ slug, className }: { slug: string; className?: string }) {
  const d = VEHICLE_PATHS[slug] ?? VEHICLE_PATHS.sedan!;
  return (
    <svg viewBox="0 0 64 28" className={cn("h-7 w-16", className)} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d={d} fill="currentColor" fillOpacity="0.12" />
      <circle cx="15" cy="21.5" r="4" fill="var(--background)" />
      <circle cx="49" cy="21.5" r="4" fill="var(--background)" />
    </svg>
  );
}

export function StepHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>
      {description && <p className="mt-2 text-muted-foreground">{description}</p>}
    </div>
  );
}

export function VehicleTypePicker({ catalog, value, onChange }: { catalog: PricingCatalog; value: string | null; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Vehicle type" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {catalog.vehicleTypes.map((vt) => (
        <ChoiceCard
          key={vt.id}
          selected={value === vt.id}
          onSelect={() => onChange(vt.id)}
          centered
          className="flex-col items-center gap-3 py-6 sm:py-7"
          icon={<VehicleIcon slug={vt.slug} className="h-9 w-20" />}
          title={vt.name}
          description={vt.description ? <span className="hidden text-xs sm:block">{vt.description}</span> : undefined}
        />
      ))}
    </div>
  );
}

export function VehicleSizePicker({ catalog, value, onChange }: { catalog: PricingCatalog; value: string | null; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Vehicle size" className="grid gap-3 sm:grid-cols-2">
      {catalog.vehicleSizes.map((s) => (
        <ChoiceCard
          key={s.id}
          selected={value === s.id}
          onSelect={() => onChange(s.id)}
          title={s.name}
          description={s.description}
          meta={s.priceAdjustPercent ? <span className={s.priceAdjustPercent < 0 ? "text-emerald-400" : "text-foreground/70"}>{s.priceAdjustPercent > 0 ? "+" : ""}{s.priceAdjustPercent}%</span> : undefined}
        />
      ))}
    </div>
  );
}

/** Price for each coverage option given the rest of the selection — shown on the cards. */
function optionPrice(catalog: PricingCatalog, job: JobState, optionId: string, filmFallback: string | null) {
  if (!job.serviceId || !job.vehicleTypeId) return null;
  const r = calculatePrice(catalog, { serviceId: job.serviceId, optionId, filmTypeId: job.filmTypeId ?? filmFallback, vehicleTypeId: job.vehicleTypeId, vehicleSizeId: job.vehicleSizeId });
  return r.ok ? r.subtotal : null;
}

export function CoveragePicker({ catalog, job, onChange }: { catalog: PricingCatalog; job: JobState; onChange: (id: string) => void }) {
  const { coverage, films, service } = useJob(catalog, job);
  const cheapestFilm = service?.filmTypeId ?? films[0]?.id ?? null;
  return (
    <div role="radiogroup" aria-label="Coverage" className="grid gap-3 sm:grid-cols-2">
      {coverage.map((o) => {
        const p = optionPrice(catalog, job, o.id, cheapestFilm);
        return (
          <ChoiceCard
            key={o.id}
            selected={job.optionId === o.id}
            onSelect={() => onChange(o.id)}
            title={o.name}
            description={o.description}
            meta={p != null ? `${job.filmTypeId || !films.length ? "" : "from "}${formatCurrency(p)}` : undefined}
          />
        );
      })}
    </div>
  );
}

export function FilmPicker({ films, job, catalog, onChange }: { films: CatalogFilm[]; job: JobState; catalog: PricingCatalog; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Film type" className="grid gap-3">
      {films.map((f) => {
        const r =
          job.serviceId && job.vehicleTypeId
            ? calculatePrice(catalog, { serviceId: job.serviceId, optionId: job.optionId, filmTypeId: f.id, vehicleTypeId: job.vehicleTypeId, vehicleSizeId: job.vehicleSizeId })
            : null;
        return (
          <ChoiceCard
            key={f.id}
            selected={job.filmTypeId === f.id}
            onSelect={() => onChange(f.id)}
            title={f.name}
            description={
              <>
                {f.tagline}
                <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/70">
                  {f.heatRejection != null && <span>Up to {f.heatRejection}% IR heat rejection</span>}
                  {f.uvRejection != null && <span>{f.uvRejection}% UV blocked</span>}
                </span>
              </>
            }
            meta={r?.ok ? formatCurrency(r.subtotal) : undefined}
          />
        );
      })}
    </div>
  );
}

const SHADE_LABEL: Record<number, string> = { 5: "Limo", 15: "Dark", 20: "Popular", 35: "Balanced", 50: "Light", 70: "Clear" };

export function ShadePicker({ film, value, onChange }: { film: CatalogFilm; value: number | null; onChange: (shade: number) => void }) {
  return (
    <div>
      <div role="radiogroup" aria-label="Tint percentage" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {film.shades.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            onClick={() => onChange(s)}
            className={cn("rounded-2xl border p-3 text-left transition-colors", value === s ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/25")}
          >
            <span
              className="mb-3 block h-12 overflow-hidden rounded-lg border border-white/10"
              style={{ backgroundImage: `linear-gradient(rgb(8 8 10 / ${((1 - s / 100) * 0.9).toFixed(2)}), rgb(8 8 10 / ${((1 - s / 100) * 0.9).toFixed(2)})), linear-gradient(135deg, #cfe3f5, #f6e7c8 55%, #9fb8cf)` }}
              aria-hidden
            />
            <span className="block font-display text-lg font-semibold">{s}%</span>
            <span className="block text-xs text-muted-foreground">{SHADE_LABEL[s] ?? "VLT"}</span>
          </button>
        ))}
      </div>
      <p className="mt-5 flex gap-2.5 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        Lower numbers are darker. Tint laws vary by location and by window — please verify your local regulations. Not sure? Pick the closest and we’ll confirm with you.
      </p>
    </div>
  );
}

export function AddOnPicker({ catalog, job, onToggle }: { catalog: PricingCatalog; job: JobState; onToggle: (id: string) => void }) {
  const { addOns } = useJob(catalog, job);
  if (!addOns.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {addOns.map((a) => {
        const on = job.addOnIds.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onToggle(a.id)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
              on ? "border-primary bg-primary/[0.08]" : "border-white/10 hover:border-white/25",
            )}
          >
            <span className="flex items-center gap-3">
              <span className={cn("grid size-5 place-items-center rounded-md border", on ? "border-primary bg-primary text-primary-foreground" : "border-white/25")} aria-hidden>
                {on && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span>
                {a.name}
                {a.description && <span className="block text-xs text-muted-foreground">{a.description}</span>}
              </span>
            </span>
            {a.price != null && <span className="font-medium tabular-nums">+{formatCurrency(a.price)}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function PriceBreakdown({ price, compact }: { price: PriceResult | null; compact?: boolean }) {
  if (!price) return <p className="text-sm text-muted-foreground">Make your selections to see a live price.</p>;
  if (!price.ok) return <p className="text-sm text-muted-foreground">{price.error}</p>;
  return (
    <div>
      {!compact && (
        <ul className="grid gap-2 text-sm">
          {price.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span className="text-foreground/80">
                {l.label}
                {l.description && <span className="block text-xs text-muted-foreground">{l.description}</span>}
              </span>
              <span className="tabular-nums">{l.amount < 0 ? "−" : ""}{formatCurrency(Math.abs(l.amount), { exact: true })}</span>
            </li>
          ))}
        </ul>
      )}
      <div className={cn("flex items-end justify-between gap-4", !compact && "mt-4 border-t border-white/10 pt-4")}>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden /> about {formatDuration(price.durationMinutes)}
        </span>
        <span className="font-display text-3xl font-semibold tabular-nums">{formatCurrency(price.subtotal, { exact: true })}</span>
      </div>
    </div>
  );
}

export function ProgressBar({ step, total, labels }: { step: number; total: number; labels?: string[] }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Step {step + 1} of {total}
          {labels?.[step] ? ` · ${labels[step]}` : ""}
        </span>
        <span className="tabular-nums">{Math.round(((step + 1) / total) * 100)}%</span>
      </div>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step + 1}
        aria-label="Progress"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>
    </div>
  );
}

/** Saves a quote selection + contact details for the booking flow (kept out of URLs). */
export const PREFILL_KEY = "tint:prefill";
export interface Prefill {
  job?: Partial<JobState>;
  contact?: { name?: string; email?: string; phone?: string; vehicleYear?: string | number; vehicleMake?: string; vehicleModel?: string; notes?: string | null };
  paymentChoice?: "deposit" | "full" | "later";
}
export function savePrefill(data: Prefill) {
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(data));
  } catch {
    // storage unavailable — booking will simply start empty
  }
}
export function readPrefill(): Prefill | null {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    return raw ? (JSON.parse(raw) as Prefill) : null;
  } catch {
    return null;
  }
}

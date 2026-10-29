/**
 * Pricing engine — pure and isomorphic. The browser uses it for instant estimates;
 * the server re-runs it with fresh database data before anything is saved or charged.
 *
 * Rule matching: a PricingRule matches when every non-null dimension equals the
 * selection. The most specific rule wins (ties broken by `priority`).
 */

export type ServiceCategoryValue = "WINDOW_TINT" | "PAINT_PROTECTION" | "COATING" | "LIGHTING";
export type OptionKindValue = "COVERAGE" | "ADDON";
export type LineKind = "SERVICE" | "ADDON" | "ADJUSTMENT";

export interface CatalogService {
  id: string;
  slug: string;
  name: string;
  category: ServiceCategoryValue;
  usesFilm: boolean;
  filmTypeId: string | null;
  parentId: string | null;
  startingPrice: number;
  durationMinutes: number;
  depositAmount: number | null;
  bookable: boolean;
  imageUrl: string | null;
  shortDescription: string;
}

export interface CatalogOption {
  id: string;
  serviceId: string;
  name: string;
  description: string | null;
  kind: OptionKindValue;
  windowCount: number;
  durationMinutes: number | null;
  price: number | null;
}

export interface CatalogFilm {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  shades: number[];
  heatRejection: number | null;
  uvRejection: number | null;
}

export interface CatalogVehicleType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface CatalogVehicleSize {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceAdjustPercent: number;
  durationAdjustPercent: number;
}

export interface CatalogRule {
  id: string;
  serviceId: string | null;
  serviceOptionId: string | null;
  filmTypeId: string | null;
  vehicleTypeId: string | null;
  vehicleSizeId: string | null;
  price: number;
  pricePerWindow: number;
  durationMinutes: number | null;
  priority: number;
}

export interface PricingCatalog {
  services: CatalogService[];
  options: CatalogOption[];
  films: CatalogFilm[];
  vehicleTypes: CatalogVehicleType[];
  vehicleSizes: CatalogVehicleSize[];
  rules: CatalogRule[];
}

export interface PricingSelection {
  serviceId: string;
  optionId?: string | null;
  filmTypeId?: string | null;
  vehicleTypeId?: string | null;
  vehicleSizeId?: string | null;
  addOnIds?: string[];
}

export interface PriceLine {
  kind: LineKind;
  label: string;
  description?: string;
  optionId?: string;
  amount: number;
}

export type PriceResult =
  | {
      ok: true;
      lines: PriceLine[];
      subtotal: number;
      durationMinutes: number;
      filmTypeId: string | null;
      optionId: string | null;
      addOnIds: string[];
    }
  | { ok: false; error: string };

export function findService(catalog: PricingCatalog, serviceId: string) {
  return catalog.services.find((s) => s.id === serviceId) ?? null;
}

/** Variants (e.g. "Ceramic Window Tint") share options and pricing with their parent. */
export function pricingServiceFor(catalog: PricingCatalog, service: CatalogService) {
  if (!service.parentId) return service;
  return findService(catalog, service.parentId) ?? service;
}

export function coverageOptionsFor(catalog: PricingCatalog, serviceId: string) {
  const service = findService(catalog, serviceId);
  if (!service) return [];
  const source = pricingServiceFor(catalog, service);
  return catalog.options.filter((o) => o.serviceId === source.id && o.kind === "COVERAGE");
}

export function addOnsFor(catalog: PricingCatalog, serviceId: string) {
  const service = findService(catalog, serviceId);
  if (!service) return [];
  const source = pricingServiceFor(catalog, service);
  return catalog.options.filter((o) => o.serviceId === source.id && o.kind === "ADDON");
}

/** Films the customer may choose for a service (locked film → one choice, no film → none). */
export function filmsFor(catalog: PricingCatalog, serviceId: string) {
  const service = findService(catalog, serviceId);
  if (!service) return [];
  if (service.filmTypeId) return catalog.films.filter((f) => f.id === service.filmTypeId);
  const source = pricingServiceFor(catalog, service);
  if (!service.usesFilm && !source.usesFilm) return [];
  return catalog.films;
}

export function serviceUsesFilm(catalog: PricingCatalog, serviceId: string) {
  return filmsFor(catalog, serviceId).length > 0;
}

interface MatchContext {
  serviceIds: string[];
  optionId: string | null;
  filmTypeId: string | null;
  vehicleTypeId: string | null;
  vehicleSizeId: string | null;
}

export function matchRule(rules: CatalogRule[], ctx: MatchContext): CatalogRule | null {
  let best: { rule: CatalogRule; score: number } | null = null;
  for (const rule of rules) {
    if (rule.serviceId && !ctx.serviceIds.includes(rule.serviceId)) continue;
    if (rule.serviceOptionId && rule.serviceOptionId !== ctx.optionId) continue;
    if (rule.filmTypeId && rule.filmTypeId !== ctx.filmTypeId) continue;
    if (rule.vehicleTypeId && rule.vehicleTypeId !== ctx.vehicleTypeId) continue;
    if (rule.vehicleSizeId && rule.vehicleSizeId !== ctx.vehicleSizeId) continue;
    // A rule must target the service or option to be considered at all.
    if (!rule.serviceId && !rule.serviceOptionId) continue;

    let score = 0;
    if (rule.serviceOptionId) score += 16;
    if (rule.serviceId) score += rule.serviceId === ctx.serviceIds[0] && ctx.serviceIds.length > 1 ? 9 : 8;
    if (rule.filmTypeId) score += 4;
    if (rule.vehicleTypeId) score += 2;
    if (rule.vehicleSizeId) score += 1;
    score = score * 1000 + rule.priority;
    if (!best || score > best.score) best = { rule, score };
  }
  return best?.rule ?? null;
}

const roundToDollar = (cents: number) => Math.round(cents / 100) * 100;
const roundToQuarterHour = (minutes: number) => Math.max(15, Math.round(minutes / 15) * 15);

export function calculatePrice(catalog: PricingCatalog, selection: PricingSelection): PriceResult {
  const service = findService(catalog, selection.serviceId);
  if (!service) return { ok: false, error: "Please choose a service." };
  const source = pricingServiceFor(catalog, service);
  const serviceIds = service.id === source.id ? [service.id] : [service.id, source.id];

  const coverage = coverageOptionsFor(catalog, service.id);
  let option: CatalogOption | null = null;
  if (coverage.length > 0) {
    option = coverage.find((o) => o.id === selection.optionId) ?? null;
    if (!option) return { ok: false, error: "Please choose what you'd like covered." };
  }

  const films = filmsFor(catalog, service.id);
  let filmTypeId: string | null = null;
  if (films.length > 0) {
    filmTypeId = service.filmTypeId ?? selection.filmTypeId ?? null;
    if (!filmTypeId || !films.some((f) => f.id === filmTypeId)) return { ok: false, error: "Please choose a film type." };
  }

  const size = catalog.vehicleSizes.find((s) => s.id === selection.vehicleSizeId) ?? null;
  const vehicleTypeId = selection.vehicleTypeId ?? null;
  const vehicleSizeId = size?.id ?? null;
  const film = films.find((f) => f.id === filmTypeId) ?? null;

  const lines: PriceLine[] = [];
  const rule = matchRule(catalog.rules, { serviceIds, optionId: option?.id ?? null, filmTypeId, vehicleTypeId, vehicleSizeId });

  const base = rule
    ? rule.price + rule.pricePerWindow * (option?.windowCount ?? 0)
    : (option?.price ?? service.startingPrice);

  lines.push({
    kind: "SERVICE",
    label: option ? `${service.name} — ${option.name}` : service.name,
    description: film ? `${film.name} film` : undefined,
    optionId: option?.id,
    amount: base,
  });

  // Size adjustment only when the matched rule is not already size-specific.
  if (size && size.priceAdjustPercent !== 0 && !rule?.vehicleSizeId) {
    const adjustment = roundToDollar((base * size.priceAdjustPercent) / 100);
    if (adjustment !== 0) {
      lines.push({
        kind: "ADJUSTMENT",
        label: `${size.name} vehicle adjustment`,
        description: `${size.priceAdjustPercent > 0 ? "+" : ""}${size.priceAdjustPercent}%`,
        amount: adjustment,
      });
    }
  }

  let duration = rule?.durationMinutes ?? option?.durationMinutes ?? service.durationMinutes;
  if (size && size.durationAdjustPercent !== 0) duration = duration * (1 + size.durationAdjustPercent / 100);

  const availableAddOns = addOnsFor(catalog, service.id);
  const addOnIds: string[] = [];
  for (const id of new Set(selection.addOnIds ?? [])) {
    const addOn = availableAddOns.find((a) => a.id === id);
    if (!addOn) continue;
    const addOnRule = matchRule(catalog.rules, { serviceIds, optionId: addOn.id, filmTypeId, vehicleTypeId, vehicleSizeId });
    const amount = addOnRule ? addOnRule.price + addOnRule.pricePerWindow * addOn.windowCount : (addOn.price ?? 0);
    lines.push({ kind: "ADDON", label: addOn.name, optionId: addOn.id, amount });
    duration += addOnRule?.durationMinutes ?? addOn.durationMinutes ?? 0;
    addOnIds.push(addOn.id);
  }

  const subtotal = Math.max(0, lines.reduce((sum, l) => sum + l.amount, 0));
  return {
    ok: true,
    lines,
    subtotal,
    durationMinutes: roundToQuarterHour(duration),
    filmTypeId,
    optionId: option?.id ?? null,
    addOnIds,
  };
}

export interface TotalsInput {
  subtotal: number;
  discount?: number;
  taxRateBps: number;
  depositPercent: number;
  depositMinimum: number;
  depositOverride?: number | null;
}

export function calculateTotals({ subtotal, discount = 0, taxRateBps, depositPercent, depositMinimum, depositOverride }: TotalsInput) {
  const safeDiscount = Math.min(Math.max(0, discount), subtotal);
  const taxable = subtotal - safeDiscount;
  const tax = Math.round((taxable * taxRateBps) / 10000);
  const total = taxable + tax;
  let deposit = depositOverride ?? Math.round((total * depositPercent) / 100);
  deposit = Math.min(Math.max(deposit, depositMinimum), total);
  return { subtotal, discount: safeDiscount, taxable, tax, total, deposit };
}

export interface CouponMath {
  type: "PERCENT" | "FIXED";
  value: number;
  maxDiscount: number | null;
}

export function couponDiscount(coupon: CouponMath, subtotal: number) {
  const raw = coupon.type === "PERCENT" ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
  const capped = coupon.maxDiscount != null ? Math.min(raw, coupon.maxDiscount) : raw;
  return Math.max(0, Math.min(capped, subtotal));
}

/** Cheapest configuration for a service — used for "from $X" hints when needed. */
export function lowestPriceFor(catalog: PricingCatalog, serviceId: string) {
  const coverage = coverageOptionsFor(catalog, serviceId);
  const films = filmsFor(catalog, serviceId);
  const optionIds = coverage.length ? coverage.map((o) => o.id) : [null];
  const filmIds = films.length ? films.map((f) => f.id) : [null];
  const typeIds = catalog.vehicleTypes.length ? catalog.vehicleTypes.map((t) => t.id) : [null];
  let min: number | null = null;
  for (const optionId of optionIds)
    for (const filmTypeId of filmIds)
      for (const vehicleTypeId of typeIds) {
        const r = calculatePrice(catalog, { serviceId, optionId, filmTypeId, vehicleTypeId });
        if (r.ok && (min === null || r.subtotal < min)) min = r.subtotal;
      }
  return min;
}

export interface JobSelection extends PricingSelection {
  shade?: number | null;
}

/** Full validation of a job configuration (service, vehicle, film, shade, add-ons) plus its price. */
export function evaluateJob(catalog: PricingCatalog, job: JobSelection) {
  const service = findService(catalog, job.serviceId);
  if (!service) return { ok: false as const, error: "This service is no longer available." };
  if (!job.vehicleTypeId || !catalog.vehicleTypes.some((v) => v.id === job.vehicleTypeId)) {
    return { ok: false as const, error: "Please choose your vehicle type." };
  }
  if (job.vehicleSizeId && !catalog.vehicleSizes.some((s) => s.id === job.vehicleSizeId)) {
    return { ok: false as const, error: "Please choose your vehicle size." };
  }
  const price = calculatePrice(catalog, job);
  if (!price.ok) return { ok: false as const, error: price.error };

  let shade: number | null = null;
  if (price.filmTypeId) {
    const film = catalog.films.find((f) => f.id === price.filmTypeId);
    if (film && film.shades.length > 0) {
      if (!job.shade || !film.shades.includes(job.shade)) return { ok: false as const, error: "Please choose a tint shade." };
      shade = job.shade;
    }
  }
  return { ok: true as const, service, price, shade };
}

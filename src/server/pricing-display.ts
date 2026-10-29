import "server-only";
import { cache } from "react";
import { addOnsFor, calculatePrice, coverageOptionsFor, filmsFor, lowestPriceFor, type PricingCatalog } from "@/lib/pricing/engine";
import { getPricingCatalog, type PackageCard } from "./catalog";

/**
 * Marketing "from $X" prices derived from the live pricing rules, so the only
 * place prices are edited is the admin pricing screen. Falls back to the
 * service's configured starting price when no rule applies.
 */
export const getStartingPrices = cache(async () => {
  const catalog = await getPricingCatalog();
  const map = new Map<string, number>();
  for (const service of catalog.services) {
    map.set(service.id, primaryFromPrice(catalog, service.id) ?? service.startingPrice);
  }
  return map;
});

/**
 * Cheapest price for the service's primary (first) coverage option — e.g. "Full Tint"
 * rather than a sun strip — across films and vehicle types.
 */
export function primaryFromPrice(catalog: PricingCatalog, serviceId: string) {
  const primary = coverageOptionsFor(catalog, serviceId)[0];
  if (!primary) return lowestPriceFor(catalog, serviceId);
  const films = filmsFor(catalog, serviceId);
  let min: number | null = null;
  for (const film of films.length ? films : [null]) {
    for (const vt of catalog.vehicleTypes) {
      const r = calculatePrice(catalog, { serviceId, optionId: primary.id, filmTypeId: film?.id ?? null, vehicleTypeId: vt.id });
      if (r.ok && (min === null || r.subtotal < min)) min = r.subtotal;
    }
  }
  return min;
}

export function packageFromPrice(catalog: PricingCatalog, pkg: Pick<PackageCard, "serviceId" | "serviceOptionId" | "filmTypeId" | "price">) {
  if (!pkg.serviceId) return pkg.price;
  let min: number | null = null;
  for (const vt of catalog.vehicleTypes) {
    const r = calculatePrice(catalog, { serviceId: pkg.serviceId, optionId: pkg.serviceOptionId, filmTypeId: pkg.filmTypeId, vehicleTypeId: vt.id });
    if (r.ok && (min === null || r.subtotal < min)) min = r.subtotal;
  }
  return min ?? pkg.price;
}

/**
 * Price grid for a service: coverage options × vehicle types (standard size),
 * cheapest film per cell, plus add-on prices.
 */
export function servicePriceTable(catalog: PricingCatalog, serviceId: string) {
  const coverage = coverageOptionsFor(catalog, serviceId);
  const films = filmsFor(catalog, serviceId);
  const rows = (coverage.length ? coverage : [null]).map((option) => ({
    id: option?.id ?? "base",
    name: option?.name ?? "Service",
    description: option?.description ?? null,
    prices: catalog.vehicleTypes.map((vt) => {
      let min: number | null = null;
      for (const film of films.length ? films : [null]) {
        const r = calculatePrice(catalog, { serviceId, optionId: option?.id ?? null, filmTypeId: film?.id ?? null, vehicleTypeId: vt.id });
        if (r.ok && (min === null || r.subtotal < min)) min = r.subtotal;
      }
      return min;
    }),
  }));
  const addOns = addOnsFor(catalog, serviceId).map((a) => {
    const r = calculatePrice(catalog, { serviceId, optionId: coverage[0]?.id ?? null, filmTypeId: films[0]?.id ?? null, vehicleTypeId: catalog.vehicleTypes[0]?.id, addOnIds: [a.id] });
    const line = r.ok ? r.lines.find((l) => l.optionId === a.id) : null;
    return { id: a.id, name: a.name, description: a.description, price: line?.amount ?? a.price ?? 0 };
  });
  return { vehicleTypes: catalog.vehicleTypes.map((v) => v.name), rows, addOns, filmCount: films.length };
}

/** Package prices per vehicle type, for the pricing table. */
export function packagePriceByVehicle(catalog: PricingCatalog, pkg: Pick<PackageCard, "serviceId" | "serviceOptionId" | "filmTypeId">) {
  if (!pkg.serviceId) return [];
  return catalog.vehicleTypes.map((vt) => {
    const r = calculatePrice(catalog, { serviceId: pkg.serviceId!, optionId: pkg.serviceOptionId, filmTypeId: pkg.filmTypeId, vehicleTypeId: vt.id });
    return { vehicleType: vt.name, price: r.ok ? r.subtotal : null };
  });
}

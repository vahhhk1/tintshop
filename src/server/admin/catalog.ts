"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "@/lib/validation/common";
import { idField } from "@/lib/validation/common";
import {
  faqSchema,
  filmTypeSchema,
  packageSchema,
  priceMatrixSchema,
  pricingRuleSchema,
  serviceOptionSchema,
  serviceSchema,
  vehicleSizeSchema,
  vehicleTypeSchema,
} from "@/lib/validation/admin";
import { adminAction, invalidate, parseForm } from "./helpers";

const optionalIdFrom = (fd: FormData) => {
  const v = fd.get("id");
  return typeof v === "string" && v ? v : null;
};

// ─── Services ────────────────────────────────────────────────────────────────

export async function saveServiceAction(input: FormData): Promise<ActionResult<{ id: string }>> {
  return adminAction("services:manage", async () => {
    const parsed = parseForm(serviceSchema, input);
    if (!parsed.ok) return parsed.result;
    const id = optionalIdFrom(input);
    const { slug, filmTypeId, parentId, ...rest } = parsed.data;
    if (parentId && parentId === id) return { ok: false, error: "A service can’t be its own parent.", fieldErrors: { parentId: ["Choose a different parent"] } };
    const data = { ...rest, slug: slug ?? slugify(rest.name), filmTypeId, parentId };
    const service = id ? await prisma.service.update({ where: { id }, data }) : await prisma.service.create({ data });
    invalidate("catalog", "gallery");
    return { ok: true, message: id ? "Service saved." : "Service created.", data: { id: service.id } };
  });
}

export async function setServiceActiveAction(id: string, active: boolean): Promise<ActionResult> {
  return adminAction("services:manage", async () => {
    await prisma.service.update({ where: { id: idField.parse(id) }, data: { active } });
    invalidate("catalog");
    return { ok: true, message: active ? "Service activated." : "Service hidden from the website." };
  });
}

export async function deleteServiceAction(id: string): Promise<ActionResult> {
  return adminAction("services:manage", async () => {
    const sid = idField.parse(id);
    const used = await prisma.appointment.count({ where: { serviceId: sid } });
    if (used > 0) return { ok: false, error: `This service has ${used} appointments, so it can’t be deleted. Deactivate it instead.` };
    await prisma.service.updateMany({ where: { parentId: sid }, data: { parentId: null } });
    await prisma.service.delete({ where: { id: sid } });
    invalidate("catalog");
    return { ok: true, message: "Service deleted." };
  });
}

export async function saveServiceOptionAction(input: FormData): Promise<ActionResult> {
  return adminAction("services:manage", async () => {
    const parsed = parseForm(serviceOptionSchema, input);
    if (!parsed.ok) return parsed.result;
    const { id, ...data } = parsed.data;
    if (id) await prisma.serviceOption.update({ where: { id }, data });
    else await prisma.serviceOption.create({ data });
    invalidate("catalog");
    return { ok: true, message: id ? "Option saved." : "Option added." };
  });
}

export async function deleteServiceOptionAction(id: string): Promise<ActionResult> {
  return adminAction("services:manage", async () => {
    const oid = idField.parse(id);
    const used = await prisma.appointment.count({ where: { serviceOptionId: oid } });
    if (used > 0) {
      await prisma.serviceOption.update({ where: { id: oid }, data: { active: false } });
      invalidate("catalog");
      return { ok: true, message: "Option is used by past bookings, so it was deactivated instead of deleted." };
    }
    await prisma.serviceOption.delete({ where: { id: oid } });
    invalidate("catalog");
    return { ok: true, message: "Option deleted." };
  });
}

export async function saveFaqAction(input: FormData): Promise<ActionResult> {
  return adminAction("services:manage", async () => {
    const parsed = parseForm(faqSchema, input);
    if (!parsed.ok) return parsed.result;
    const { id, ...data } = parsed.data;
    if (id) await prisma.faq.update({ where: { id }, data });
    else await prisma.faq.create({ data });
    invalidate("catalog");
    return { ok: true, message: id ? "FAQ saved." : "FAQ added." };
  });
}

export async function deleteFaqAction(id: string): Promise<ActionResult> {
  return adminAction("services:manage", async () => {
    await prisma.faq.delete({ where: { id: idField.parse(id) } });
    invalidate("catalog");
    return { ok: true, message: "FAQ deleted." };
  });
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

export async function savePricingRuleAction(input: FormData): Promise<ActionResult> {
  return adminAction("pricing:manage", async () => {
    const parsed = parseForm(pricingRuleSchema, input);
    if (!parsed.ok) return parsed.result;
    const { id, ...data } = parsed.data;
    if (!data.serviceId && !data.serviceOptionId) return { ok: false, error: "A rule must target a service or an option.", fieldErrors: { serviceId: ["Choose a service"] } };
    if (id) await prisma.pricingRule.update({ where: { id }, data });
    else await prisma.pricingRule.create({ data });
    invalidate("catalog");
    return { ok: true, message: id ? "Rule saved." : "Rule added." };
  });
}

export async function deletePricingRuleAction(id: string): Promise<ActionResult> {
  return adminAction("pricing:manage", async () => {
    await prisma.pricingRule.delete({ where: { id: idField.parse(id) } });
    invalidate("catalog");
    return { ok: true, message: "Rule deleted." };
  });
}

/**
 * Saves a grid of prices (vehicle type × film) for one service option.
 * Each cell maps to exactly one rule with those dimensions; empty cells delete it.
 */
export async function savePriceMatrixAction(input: unknown): Promise<ActionResult> {
  return adminAction("pricing:manage", async () => {
    const parsed = priceMatrixSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid prices." };
    const { serviceId, serviceOptionId, vehicleSizeId, cells } = parsed.data;
    await prisma.$transaction(async (tx) => {
      for (const cell of cells) {
        const where = { serviceId, serviceOptionId, vehicleSizeId, vehicleTypeId: cell.vehicleTypeId, filmTypeId: cell.filmTypeId };
        const existing = await tx.pricingRule.findFirst({ where });
        if (cell.price === null) {
          if (existing) await tx.pricingRule.delete({ where: { id: existing.id } });
        } else if (existing) {
          if (existing.price !== cell.price || !existing.active) await tx.pricingRule.update({ where: { id: existing.id }, data: { price: cell.price, active: true } });
        } else {
          await tx.pricingRule.create({ data: { ...where, price: cell.price } });
        }
      }
    });
    invalidate("catalog");
    return { ok: true, message: "Prices saved — the website and quote tool are updated." };
  });
}

export async function saveFilmTypeAction(input: FormData): Promise<ActionResult> {
  return adminAction("pricing:manage", async () => {
    const parsed = parseForm(filmTypeSchema, input);
    if (!parsed.ok) return parsed.result;
    const id = optionalIdFrom(input);
    const { slug, ...rest } = parsed.data;
    const data = { ...rest, slug: slug ?? slugify(rest.name) };
    if (id) await prisma.filmType.update({ where: { id }, data });
    else await prisma.filmType.create({ data });
    invalidate("catalog");
    return { ok: true, message: id ? "Film saved." : "Film added." };
  });
}

export async function saveVehicleTypeAction(input: FormData): Promise<ActionResult> {
  return adminAction("pricing:manage", async () => {
    const parsed = parseForm(vehicleTypeSchema, input);
    if (!parsed.ok) return parsed.result;
    const { id, slug, ...rest } = parsed.data;
    const data = { ...rest, slug: slug ?? slugify(rest.name) };
    if (id) await prisma.vehicleType.update({ where: { id }, data });
    else await prisma.vehicleType.create({ data });
    invalidate("catalog");
    return { ok: true, message: "Vehicle type saved." };
  });
}

export async function saveVehicleSizeAction(input: FormData): Promise<ActionResult> {
  return adminAction("pricing:manage", async () => {
    const parsed = parseForm(vehicleSizeSchema, input);
    if (!parsed.ok) return parsed.result;
    const { id, slug, ...rest } = parsed.data;
    const data = { ...rest, slug: slug ?? slugify(rest.name) };
    if (id) await prisma.vehicleSize.update({ where: { id }, data });
    else await prisma.vehicleSize.create({ data });
    invalidate("catalog");
    return { ok: true, message: "Vehicle size saved." };
  });
}

export async function savePackageAction(input: FormData): Promise<ActionResult> {
  return adminAction("pricing:manage", async () => {
    const parsed = parseForm(packageSchema, input);
    if (!parsed.ok) return parsed.result;
    const { id, slug, ...rest } = parsed.data;
    const data = { ...rest, slug: slug ?? slugify(rest.name) };
    if (id) await prisma.package.update({ where: { id }, data });
    else await prisma.package.create({ data });
    invalidate("catalog");
    return { ok: true, message: "Package saved." };
  });
}

export async function deletePackageAction(id: string): Promise<ActionResult> {
  return adminAction("pricing:manage", async () => {
    await prisma.package.delete({ where: { id: idField.parse(id) } });
    invalidate("catalog");
    return { ok: true, message: "Package deleted." };
  });
}

export async function deleteCatalogDimensionAction(kind: "film" | "type" | "size", id: string): Promise<ActionResult> {
  return adminAction("pricing:manage", async () => {
    const k = z.enum(["film", "type", "size"]).parse(kind);
    const did = idField.parse(id);
    // Historical bookings keep their snapshot via SetNull relations; deactivating is safer when in use.
    const inUse =
      k === "film"
        ? await prisma.appointment.count({ where: { filmTypeId: did } })
        : k === "type"
          ? await prisma.appointment.count({ where: { vehicleTypeId: did } })
          : await prisma.appointment.count({ where: { vehicleSizeId: did } });
    if (inUse > 0) {
      if (k === "film") await prisma.filmType.update({ where: { id: did }, data: { active: false } });
      if (k === "type") await prisma.vehicleType.update({ where: { id: did }, data: { active: false } });
      if (k === "size") await prisma.vehicleSize.update({ where: { id: did }, data: { active: false } });
      invalidate("catalog");
      return { ok: true, message: "In use by past bookings — deactivated instead of deleted." };
    }
    if (k === "film") await prisma.filmType.delete({ where: { id: did } });
    if (k === "type") await prisma.vehicleType.delete({ where: { id: did } });
    if (k === "size") await prisma.vehicleSize.delete({ where: { id: did } });
    invalidate("catalog");
    return { ok: true, message: "Deleted." };
  });
}

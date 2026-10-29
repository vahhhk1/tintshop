"use server";

import { prisma } from "@/lib/db/prisma";
import type { ActionResult } from "@/lib/validation/common";
import { idField } from "@/lib/validation/common";
import { galleryImageSchema } from "@/lib/validation/admin";
import { adminAction, invalidate, parseForm } from "./helpers";

export async function saveGalleryImageAction(input: FormData): Promise<ActionResult> {
  return adminAction("gallery:manage", async () => {
    const parsed = parseForm(galleryImageSchema, input);
    if (!parsed.ok) return parsed.result;
    const id = input.get("id");
    const data = { ...parsed.data, imageUrl: parsed.data.imageUrl! };
    if (typeof id === "string" && id) {
      await prisma.galleryImage.update({ where: { id }, data });
    } else {
      const last = await prisma.galleryImage.aggregate({ _max: { sortOrder: true } });
      await prisma.galleryImage.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    }
    invalidate("gallery");
    return { ok: true, message: typeof id === "string" && id ? "Photo updated." : "Photo added to the gallery." };
  });
}

export async function toggleGalleryFlagAction(id: string, flag: "featured" | "published", value: boolean): Promise<ActionResult> {
  return adminAction("gallery:manage", async () => {
    const gid = idField.parse(id);
    await prisma.galleryImage.update({ where: { id: gid }, data: flag === "featured" ? { featured: value } : { published: value } });
    invalidate("gallery");
    return { ok: true, message: "Updated." };
  });
}

/** Swaps an image with its neighbour in the display order. */
export async function moveGalleryImageAction(id: string, direction: "up" | "down"): Promise<ActionResult> {
  return adminAction("gallery:manage", async () => {
    const items = await prisma.galleryImage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true } });
    const index = items.findIndex((i) => i.id === id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= items.length) return { ok: true, message: "Already at the edge." };
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    await prisma.$transaction(reordered.map((item, i) => prisma.galleryImage.update({ where: { id: item.id }, data: { sortOrder: i } })));
    invalidate("gallery");
    return { ok: true, message: "Order updated." };
  });
}

export async function deleteGalleryImageAction(id: string): Promise<ActionResult> {
  return adminAction("gallery:manage", async () => {
    await prisma.galleryImage.delete({ where: { id: idField.parse(id) } });
    invalidate("gallery");
    return { ok: true, message: "Photo deleted." };
  });
}

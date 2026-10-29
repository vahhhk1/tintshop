"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { ActionResult } from "@/lib/validation/common";
import { idField, optionalText } from "@/lib/validation/common";
import { reviewAdminSchema } from "@/lib/validation/admin";
import { adminAction, invalidate, parseForm } from "./helpers";

// ─── Contact messages ────────────────────────────────────────────────────────

const contactStatus = z.enum(["NEW", "READ", "REPLIED", "ARCHIVED"]);

export async function setMessageStatusAction(id: string, status: string): Promise<ActionResult> {
  return adminAction("messages:manage", async () => {
    await prisma.contactMessage.update({ where: { id: idField.parse(id) }, data: { status: contactStatus.parse(status) } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Message updated." };
  });
}

export async function updateMessageNotesAction(input: FormData): Promise<ActionResult> {
  return adminAction("messages:manage", async () => {
    const parsed = parseForm(z.object({ id: idField, adminNotes: optionalText(3000) }), input);
    if (!parsed.ok) return parsed.result;
    await prisma.contactMessage.update({ where: { id: parsed.data.id }, data: { adminNotes: parsed.data.adminNotes } });
    revalidatePath("/admin/messages");
    return { ok: true, message: "Notes saved." };
  });
}

export async function deleteMessageAction(id: string): Promise<ActionResult> {
  return adminAction("messages:manage", async () => {
    await prisma.contactMessage.delete({ where: { id: idField.parse(id) } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Message deleted." };
  });
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export async function setReviewStatusAction(id: string, status: "APPROVED" | "REJECTED" | "PENDING"): Promise<ActionResult> {
  return adminAction("reviews:manage", async () => {
    const s = z.enum(["APPROVED", "REJECTED", "PENDING"]).parse(status);
    const review = await prisma.review.findUnique({ where: { id: idField.parse(id) }, select: { publishedAt: true } });
    if (!review) return { ok: false, error: "Review not found." };
    await prisma.review.update({ where: { id }, data: { status: s, publishedAt: s === "APPROVED" ? (review.publishedAt ?? new Date()) : review.publishedAt } });
    invalidate("reviews");
    return { ok: true, message: s === "APPROVED" ? "Review approved and published." : s === "REJECTED" ? "Review rejected." : "Moved back to pending." };
  });
}

export async function setReviewFeaturedAction(id: string, featured: boolean): Promise<ActionResult> {
  return adminAction("reviews:manage", async () => {
    await prisma.review.update({ where: { id: idField.parse(id) }, data: { featured } });
    invalidate("reviews");
    return { ok: true, message: featured ? "Review featured." : "Review un-featured." };
  });
}

export async function updateReviewAction(input: FormData): Promise<ActionResult> {
  return adminAction("reviews:manage", async () => {
    const parsed = parseForm(reviewAdminSchema, input);
    if (!parsed.ok) return parsed.result;
    const { reviewId, ...data } = parsed.data;
    await prisma.review.update({ where: { id: reviewId }, data });
    invalidate("reviews");
    return { ok: true, message: "Review saved." };
  });
}

export async function deleteReviewAction(id: string): Promise<ActionResult> {
  return adminAction("reviews:manage", async () => {
    await prisma.review.delete({ where: { id: idField.parse(id) } });
    invalidate("reviews");
    return { ok: true, message: "Review deleted." };
  });
}

// ─── Admin notifications ─────────────────────────────────────────────────────

export async function markAdminNotificationsReadAction(): Promise<ActionResult> {
  return adminAction("admin:access", async () => {
    await prisma.notification.updateMany({ where: { audience: "ADMIN", readAt: null }, data: { readAt: new Date() } });
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

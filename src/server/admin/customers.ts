"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { ActionResult } from "@/lib/validation/common";
import { idField, optionalText } from "@/lib/validation/common";
import { adminAction, parseForm } from "./helpers";

export async function updateCustomerNotesAction(input: FormData): Promise<ActionResult> {
  return adminAction("customers:manage", async () => {
    const parsed = parseForm(z.object({ userId: idField, adminNotes: optionalText(5000) }), input);
    if (!parsed.ok) return parsed.result;
    const { userId, adminNotes } = parsed.data;
    await prisma.customerProfile.upsert({ where: { userId }, create: { userId, adminNotes }, update: { adminNotes } });
    revalidatePath(`/admin/customers/${userId}`);
    return { ok: true, message: "Notes saved." };
  });
}

export async function setCustomerActiveAction(userId: string, isActive: boolean): Promise<ActionResult> {
  return adminAction("customers:manage", async () => {
    const id = idField.parse(userId);
    const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!user || user.role !== "CUSTOMER") return { ok: false, error: "Customer not found." };
    await prisma.user.update({ where: { id }, data: { isActive } });
    revalidatePath(`/admin/customers/${id}`);
    return { ok: true, message: isActive ? "Account enabled." : "Account disabled — the customer can no longer sign in." };
  });
}

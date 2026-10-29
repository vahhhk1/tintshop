"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { ActionResult } from "@/lib/validation/common";
import { idField, optionalText } from "@/lib/validation/common";
import { quoteResponseSchema, quoteStatusSchema } from "@/lib/validation/admin";
import { notify } from "@/server/notifications";
import { adminAction, parseForm } from "./helpers";

function refresh(id: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/quotes/${id}`);
  revalidatePath("/dashboard/quotes");
}

export async function updateQuoteStatusAction(input: FormData): Promise<ActionResult> {
  return adminAction("quotes:manage", async () => {
    const parsed = parseForm(quoteStatusSchema, input);
    if (!parsed.ok) return parsed.result;
    await prisma.quote.update({ where: { id: parsed.data.quoteId }, data: { status: parsed.data.status } });
    refresh(parsed.data.quoteId);
    return { ok: true, message: "Quote status updated." };
  });
}

export async function updateQuoteNotesAction(input: FormData): Promise<ActionResult> {
  return adminAction("quotes:manage", async () => {
    const parsed = parseForm(z.object({ quoteId: idField, adminNotes: optionalText(5000) }), input);
    if (!parsed.ok) return parsed.result;
    await prisma.quote.update({ where: { id: parsed.data.quoteId }, data: { adminNotes: parsed.data.adminNotes } });
    refresh(parsed.data.quoteId);
    return { ok: true, message: "Notes saved." };
  });
}

/** Sends the quote response to the customer (email + in-app) and marks it Estimate Sent. */
export async function respondToQuoteAction(input: FormData): Promise<ActionResult> {
  return adminAction("quotes:manage", async () => {
    const parsed = parseForm(quoteResponseSchema, input);
    if (!parsed.ok) return parsed.result;
    const { quoteId, quotedPrice, message } = parsed.data;
    const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { status: true } });
    if (!quote) return { ok: false, error: "Quote not found." };
    await prisma.quote.update({
      where: { id: quoteId },
      data: {
        responseMessage: message,
        quotedPrice,
        respondedAt: new Date(),
        status: quote.status === "NEW" || quote.status === "CONTACTED" ? "ESTIMATE_SENT" : quote.status,
      },
    });
    after(() => notify.quoteResponded(quoteId));
    refresh(quoteId);
    return { ok: true, message: "Response sent to the customer." };
  });
}

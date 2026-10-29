"use server";

import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { evaluateJob } from "@/lib/pricing/engine";
import { limitByIp } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/validation/common";
import { quoteRequestSchema } from "@/lib/validation/public";
import { getFreshPricingCatalog } from "@/server/catalog";
import { quoteReference } from "@/server/codes";
import { notify } from "@/server/notifications";

export async function submitQuoteAction(input: unknown): Promise<ActionResult<{ reference: string; estimate: number }>> {
  const limit = await limitByIp("quote", 8, 60 * 60);
  if (!limit.success) return { ok: false, error: "Too many requests. Please try again later or give us a call." };

  const parsed = quoteRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  const { config, contact, company } = parsed.data;
  if (company) return { ok: false, error: "Unable to submit this request." };

  const catalog = await getFreshPricingCatalog();
  const job = evaluateJob(catalog, config);
  if (!job.ok) return { ok: false, error: job.error };

  const user = await getSessionUser();
  const quote = await prisma.quote.create({
    data: {
      reference: quoteReference(),
      userId: user?.id ?? null,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      vehicleYear: contact.vehicleYear,
      vehicleMake: contact.vehicleMake,
      vehicleModel: contact.vehicleModel,
      vehicleTypeId: config.vehicleTypeId,
      vehicleSizeId: config.vehicleSizeId ?? null,
      serviceId: job.service.id,
      serviceOptionId: job.price.optionId,
      filmTypeId: job.price.filmTypeId,
      shade: job.shade,
      notes: contact.notes,
      estimatedTotal: job.price.subtotal,
      items: {
        create: job.price.lines.map((l) => ({
          kind: l.kind,
          label: l.label,
          description: l.description ?? null,
          serviceOptionId: l.optionId ?? null,
          unitPrice: l.amount,
          total: l.amount,
        })),
      },
    },
  });

  after(() => notify.quoteReceived(quote.id));
  return { ok: true, data: { reference: quote.reference, estimate: quote.estimatedTotal } };
}

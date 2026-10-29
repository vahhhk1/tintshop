import "server-only";
import type { AppointmentSource, AppointmentStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { calculateTotals, evaluateJob, pricingServiceFor, type PriceLine } from "@/lib/pricing/engine";
import type { JobConfig } from "@/lib/validation/public";
import { getFreshPricingCatalog } from "@/server/catalog";
import { appointmentReference, manageToken } from "@/server/codes";
import { getSettings } from "@/server/settings";
import { reserveSlot } from "./availability";

export class BookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingError";
  }
}

export interface CreateAppointmentParams {
  config: JobConfig;
  date: string;
  time: string;
  technicianId?: string | null;
  contact: { name: string; email: string; phone: string };
  vehicle: { vehicleYear: number; vehicleMake: string; vehicleModel: string; vehicleColor?: string | null; vehicleId?: string | null };
  customerNotes?: string | null;
  internalNotes?: string | null;
  userId?: string | null;
  source: AppointmentSource;
  status: AppointmentStatus;
  /** Minutes to hold the slot while the customer pays. Null = no expiry. */
  holdMinutes: number | null;
  allowOverlap?: boolean;
  ignoreNotice?: boolean;
  quoteId?: string | null;
  /** Staff-quoted price that replaces the calculated subtotal (e.g. converting a quote). */
  priceOverride?: number | null;
}

/** Prices a job from fresh database rules. Shared by booking, checkout and admin flows. */
export async function priceJobFromDb(config: JobConfig) {
  const catalog = await getFreshPricingCatalog();
  const job = evaluateJob(catalog, config);
  if (!job.ok) throw new BookingError(job.error);
  const pricingService = pricingServiceFor(catalog, job.service);
  return { catalog, ...job, pricingService };
}

export async function createAppointment(params: CreateAppointmentParams) {
  const { service, price, shade, pricingService } = await priceJobFromDb(params.config);
  if (params.source === "WEBSITE" && !service.bookable) throw new BookingError("This service is booked by consultation — please request a quote.");
  const settings = await getSettings();

  let lines: PriceLine[] = price.lines;
  let subtotal = price.subtotal;
  if (params.priceOverride != null) {
    lines = [{ kind: "SERVICE", label: price.lines[0]?.label ?? service.name, description: "Quoted price", amount: params.priceOverride }];
    subtotal = params.priceOverride;
  }

  const totals = calculateTotals({
    subtotal,
    taxRateBps: settings.taxRateBps,
    depositPercent: settings.depositPercent,
    depositMinimum: settings.depositMinimum,
    depositOverride: service.depositAmount ?? pricingService.depositAmount,
  });

  const now = new Date();
  return prisma.$transaction(
    async (tx) => {
      const slot = await reserveSlot(tx, {
        date: params.date,
        time: params.time,
        durationMinutes: price.durationMinutes,
        // Technician skills are assigned on the base service (variants share them).
        serviceId: pricingService.id,
        technicianId: params.technicianId ?? null,
        ignoreNotice: params.ignoreNotice,
        allowOverlap: params.allowOverlap,
      });

      return tx.appointment.create({
        data: {
          reference: appointmentReference(),
          manageToken: manageToken(),
          userId: params.userId ?? null,
          customerName: params.contact.name,
          customerEmail: params.contact.email,
          customerPhone: params.contact.phone,
          serviceId: service.id,
          serviceOptionId: price.optionId,
          filmTypeId: price.filmTypeId,
          shade,
          vehicleTypeId: params.config.vehicleTypeId,
          vehicleSizeId: params.config.vehicleSizeId ?? null,
          vehicleId: params.vehicle.vehicleId ?? null,
          vehicleYear: params.vehicle.vehicleYear,
          vehicleMake: params.vehicle.vehicleMake,
          vehicleModel: params.vehicle.vehicleModel,
          vehicleColor: params.vehicle.vehicleColor ?? null,
          technicianId: slot.technicianId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: params.status,
          source: params.source,
          subtotal: totals.subtotal,
          discount: 0,
          tax: totals.tax,
          total: totals.total,
          depositAmount: totals.deposit,
          customerNotes: params.customerNotes ?? null,
          internalNotes: params.internalNotes ?? null,
          holdExpiresAt: params.holdMinutes ? new Date(now.getTime() + params.holdMinutes * 60_000) : null,
          confirmedAt: params.status === "CONFIRMED" ? now : null,
          quoteId: params.quoteId ?? null,
          items: {
            create: lines.map((l) => ({
              kind: l.kind,
              label: l.label,
              description: l.description ?? null,
              serviceOptionId: l.optionId ?? null,
              quantity: 1,
              unitPrice: l.amount,
              total: l.amount,
            })),
          },
        },
      });
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}

/** Recomputes tax/total/deposit after a discount change. */
export async function recalculateAppointmentTotals(appointmentId: string, discount: number, couponId: string | null) {
  const settings = await getSettings();
  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: { service: { select: { depositAmount: true, parent: { select: { depositAmount: true } } } } },
  });
  const totals = calculateTotals({
    subtotal: appointment.subtotal,
    discount,
    taxRateBps: settings.taxRateBps,
    depositPercent: settings.depositPercent,
    depositMinimum: settings.depositMinimum,
    depositOverride: appointment.service.depositAmount ?? appointment.service.parent?.depositAmount ?? null,
  });
  return prisma.appointment.update({
    where: { id: appointmentId },
    data: { discount: totals.discount, tax: totals.tax, total: totals.total, depositAmount: totals.deposit, couponId },
  });
}

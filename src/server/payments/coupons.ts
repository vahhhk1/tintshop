import "server-only";
import { prisma } from "@/lib/db/prisma";
import { couponDiscount } from "@/lib/pricing/engine";

export type CouponCheck =
  | { ok: true; couponId: string; code: string; discount: number; description: string | null }
  | { ok: false; error: string };

/** Server-side coupon validation. Never trust a discount calculated in the browser. */
export async function validateCoupon(
  rawCode: string,
  ctx: { subtotal: number; serviceIds: string[]; email: string; excludeAppointmentId?: string },
): Promise<CouponCheck> {
  const code = rawCode.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({ where: { code }, include: { services: { select: { id: true } } } });
  const now = new Date();
  if (!coupon || !coupon.active) return { ok: false, error: "That code isn't valid." };
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, error: "That code isn't active yet." };
  if (coupon.expiresAt && coupon.expiresAt < now) return { ok: false, error: "That code has expired." };
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) return { ok: false, error: "That code has reached its usage limit." };
  if (coupon.minPurchase != null && ctx.subtotal < coupon.minPurchase) {
    return { ok: false, error: `This code requires a minimum purchase of $${(coupon.minPurchase / 100).toFixed(0)}.` };
  }
  if (coupon.services.length > 0 && !coupon.services.some((s) => ctx.serviceIds.includes(s.id))) {
    return { ok: false, error: "That code doesn't apply to this service." };
  }
  if (coupon.perCustomerLimit != null) {
    const used = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, email: ctx.email.toLowerCase(), ...(ctx.excludeAppointmentId ? { appointmentId: { not: ctx.excludeAppointmentId } } : {}) },
    });
    if (used >= coupon.perCustomerLimit) return { ok: false, error: "You've already used this code." };
  }
  const discount = couponDiscount(coupon, ctx.subtotal);
  if (discount <= 0) return { ok: false, error: "That code doesn't reduce this total." };
  return { ok: true, couponId: coupon.id, code: coupon.code, discount, description: coupon.description };
}

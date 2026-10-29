import "server-only";
import { getPaymentMode } from "@/lib/stripe";
import { todayYmd } from "@/lib/time";
import type { ManageProps } from "@/components/booking/appointment-manager";
import type { SessionUser } from "@/lib/auth/session";
import type { Settings } from "@/server/settings";
import type { AppointmentDetail } from "./access";

const CHANGEABLE = ["PENDING", "CONFIRMED", "DEPOSIT_PAID"];

/** Props for the customer-facing appointment manager (guest link or dashboard). */
export function buildManageProps(a: AppointmentDetail, settings: Settings, viewer: SessionUser | null): ManageProps {
  const hoursUntil = (a.startsAt.getTime() - Date.now()) / 3_600_000;
  return {
    appointment: {
      id: a.id,
      token: a.manageToken,
      status: a.status,
      durationMinutes: Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000),
      pricingServiceId: a.service.parentId ?? a.service.id,
      technicianId: a.technicianId,
      amountPaid: a.amountPaid,
      total: a.total,
      hasReview: Boolean(a.review),
      canChange: CHANGEABLE.includes(a.status) && hoursUntil >= settings.cancellationWindowHours,
      claimable: Boolean(viewer && !a.userId && viewer.email.toLowerCase() === a.customerEmail.toLowerCase()),
    },
    settings: {
      today: todayYmd(settings.timezone),
      maxAdvanceDays: settings.maxAdvanceDays,
      cancellationWindowHours: settings.cancellationWindowHours,
      phone: settings.phone,
      cancellationPolicy: settings.cancellationPolicy,
      onlinePayments: getPaymentMode() !== "offline",
    },
  };
}

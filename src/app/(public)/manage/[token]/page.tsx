import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppointmentManager } from "@/components/booking/appointment-manager";
import { OrderSummary } from "@/components/checkout/order-summary";
import { StatusBadge } from "@/components/ui/status";
import { getSessionUser } from "@/lib/auth/session";
import { formatLongDate, formatTime } from "@/lib/time";
import { getAppointmentByToken } from "@/server/appointments/access";
import { buildManageProps } from "@/server/appointments/manage";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Manage your booking", robots: { index: false, follow: false } };

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [appointment, settings, user] = await Promise.all([getAppointmentByToken(decodeURIComponent(token)), getSettings(), getSessionUser().catch(() => null)]);
  if (!appointment) notFound();
  const props = buildManageProps(appointment, settings, user);

  return (
    <div className="container-page pt-28 pb-24 sm:pt-36">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow">Booking {appointment.reference}</p>
          <StatusBadge kind="appointment" status={appointment.status} />
        </div>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
          {formatLongDate(appointment.startsAt, settings.timezone)} · {formatTime(appointment.startsAt, settings.timezone)}
        </h1>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <OrderSummary a={appointment} timeZone={settings.timezone} currency={settings.currency} />
          <div className="lg:self-start">
            <div className="rounded-3xl border border-white/[0.08] bg-card p-6">
              <h2 className="mb-4 font-semibold">Manage</h2>
              <AppointmentManager {...props} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

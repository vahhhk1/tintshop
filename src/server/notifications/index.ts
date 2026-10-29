import "server-only";
import type { NotificationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates, type AppointmentEmailData, type EmailBrand } from "@/lib/email/templates";
import { sendSms } from "@/lib/sms";
import { formatDateTime } from "@/lib/time";
import { formatCurrency, vehicleLabel } from "@/lib/utils";
import { formatAddress, getSettings, type Settings } from "@/server/settings";

/**
 * Notification dispatcher: every customer/admin event fans out to in-app
 * notifications, email and (when opted in and configured) SMS.
 * Failures are logged and never break the calling flow.
 */

async function context() {
  const settings = await getSettings();
  const brand: EmailBrand = {
    businessName: settings.businessName,
    phone: settings.phone,
    email: settings.email,
    address: formatAddress(settings),
    siteUrl: env.siteUrl,
  };
  return { settings, brand };
}

const appointmentInclude = {
  service: { select: { name: true } },
  serviceOption: { select: { name: true } },
  filmType: { select: { name: true } },
  user: { select: { id: true, profile: { select: { smsOptIn: true } } } },
} as const;

async function loadAppointment(id: string) {
  return prisma.appointment.findUnique({ where: { id }, include: appointmentInclude });
}
type LoadedAppointment = NonNullable<Awaited<ReturnType<typeof loadAppointment>>>;

export function customerAppointmentUrl(a: { id: string; userId: string | null; manageToken: string }) {
  return a.userId ? `${env.siteUrl}/dashboard/appointments/${a.id}` : `${env.siteUrl}/manage/${a.manageToken}`;
}

function customerAppointmentPath(a: { id: string; userId: string | null; manageToken: string }) {
  return a.userId ? `/dashboard/appointments/${a.id}` : `/manage/${a.manageToken}`;
}

function serviceLabel(a: LoadedAppointment) {
  const parts = [a.service.name];
  if (a.serviceOption) parts.push(a.serviceOption.name);
  let label = parts.join(" — ");
  if (a.filmType) label += ` · ${a.filmType.name}${a.shade ? ` ${a.shade}%` : ""}`;
  return label;
}

function emailData(a: LoadedAppointment, settings: Settings): AppointmentEmailData {
  return {
    reference: a.reference,
    customerName: a.customerName,
    serviceName: serviceLabel(a),
    vehicle: vehicleLabel(a),
    when: formatDateTime(a.startsAt, settings.timezone),
    subtotal: a.subtotal,
    discount: a.discount,
    tax: a.tax,
    total: a.total,
    amountPaid: a.amountPaid,
    currency: settings.currency,
    manageUrl: customerAppointmentUrl(a),
  };
}

async function inApp(input: { userId?: string | null; audience: "CUSTOMER" | "ADMIN"; type: NotificationType; title: string; body: string; link?: string }) {
  if (input.audience === "CUSTOMER" && !input.userId) return;
  await prisma.notification.create({
    data: {
      userId: input.audience === "CUSTOMER" ? input.userId : null,
      audience: input.audience,
      type: input.type,
      title: input.title,
      body: input.body.slice(0, 500),
      link: input.link,
    },
  });
}

async function smsCustomer(a: LoadedAppointment, body: string, template: string) {
  if (!a.user?.profile?.smsOptIn) return;
  await sendSms(a.customerPhone, body, template);
}

async function alertAdmins(
  brand: EmailBrand,
  settings: Settings,
  alert: { type: NotificationType; title: string; body: string; path: string; lines: { label: string; value: string }[] },
) {
  await inApp({ audience: "ADMIN", type: alert.type, title: alert.title, body: alert.body, link: alert.path });
  const to = env.email.adminRecipient ?? settings.email;
  const message = emailTemplates.adminAlert(brand, { title: alert.title, lines: alert.lines, href: `${env.siteUrl}${alert.path}` });
  await sendEmail({ to, template: `admin:${alert.type}`, ...message });
}

async function safe(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    console.error(`[notify:${name}] failed`, error);
  }
}

function bookingAdminLines(a: LoadedAppointment, settings: Settings) {
  return [
    { label: "Customer", value: `${a.customerName} · ${a.customerPhone}` },
    { label: "Service", value: serviceLabel(a) },
    { label: "Vehicle", value: vehicleLabel(a) },
    { label: "When", value: formatDateTime(a.startsAt, settings.timezone) },
    { label: "Total", value: formatCurrency(a.total, { currency: settings.currency, exact: true }) },
  ];
}

export const notify = {
  /** Booking created without upfront payment (pay at shop / admin-created). */
  bookingCreated: (appointmentId: string) =>
    safe("bookingCreated", async () => {
      const a = await loadAppointment(appointmentId);
      if (!a) return;
      const { settings, brand } = await context();
      const confirmed = a.status === "CONFIRMED" || a.status === "DEPOSIT_PAID";
      const mail = emailTemplates.bookingReceived(brand, emailData(a, settings), confirmed);
      await sendEmail({ to: a.customerEmail, template: "booking-received", ...mail });
      await inApp({
        userId: a.userId,
        audience: "CUSTOMER",
        type: "BOOKING_CONFIRMED",
        title: confirmed ? "Appointment confirmed" : "Booking request received",
        body: `${serviceLabel(a)} on ${formatDateTime(a.startsAt, settings.timezone)}`,
        link: customerAppointmentPath(a),
      });
      await smsCustomer(a, `${settings.businessName}: ${confirmed ? "Confirmed" : "Request received"} — ${a.service.name} on ${formatDateTime(a.startsAt, settings.timezone)}. Ref ${a.reference}`, "booking-received");
      if (a.source !== "ADMIN") {
        await alertAdmins(brand, settings, {
          type: "NEW_BOOKING",
          title: `New booking ${a.reference}`,
          body: `${a.customerName} booked ${a.service.name} for ${formatDateTime(a.startsAt, settings.timezone)}`,
          path: `/admin/appointments/${a.id}`,
          lines: bookingAdminLines(a, settings),
        });
      }
    }),

  /** Admin confirmed a pending booking. */
  bookingConfirmed: (appointmentId: string) =>
    safe("bookingConfirmed", async () => {
      const a = await loadAppointment(appointmentId);
      if (!a) return;
      const { settings, brand } = await context();
      const mail = emailTemplates.bookingReceived(brand, emailData(a, settings), true);
      await sendEmail({ to: a.customerEmail, template: "booking-confirmed", ...mail });
      await inApp({
        userId: a.userId,
        audience: "CUSTOMER",
        type: "BOOKING_CONFIRMED",
        title: "Appointment confirmed",
        body: `${serviceLabel(a)} on ${formatDateTime(a.startsAt, settings.timezone)}`,
        link: customerAppointmentPath(a),
      });
      await smsCustomer(a, `${settings.businessName}: You're confirmed for ${formatDateTime(a.startsAt, settings.timezone)}. Ref ${a.reference}`, "booking-confirmed");
    }),

  /** A payment succeeded. `firstPayment` means it also secured a new online booking. */
  paymentReceived: (paymentId: string, opts: { firstPayment: boolean }) =>
    safe("paymentReceived", async () => {
      const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (!payment) return;
      const a = await loadAppointment(payment.appointmentId);
      if (!a) return;
      const { settings, brand } = await context();
      const data = emailData(a, settings);
      const receiptUrl = `${env.siteUrl}/receipts/${payment.id}?t=${a.manageToken}`;

      if (opts.firstPayment) {
        const mail = emailTemplates.bookingReceived(brand, data, true);
        await sendEmail({ to: a.customerEmail, template: "booking-confirmed", ...mail });
      }
      const receipt = emailTemplates.paymentReceipt(brand, data, {
        receiptNumber: payment.receiptNumber,
        amount: payment.amount,
        type: payment.type,
        paidAt: formatDateTime(payment.paidAt ?? new Date(), settings.timezone),
        method: payment.method,
        receiptUrl,
      });
      await sendEmail({ to: payment.billingEmail ?? a.customerEmail, template: "payment-receipt", ...receipt });
      await inApp({
        userId: a.userId,
        audience: "CUSTOMER",
        type: "PAYMENT_RECEIVED",
        title: opts.firstPayment ? "You're booked — payment received" : "Payment received",
        body: `${formatCurrency(payment.amount, { currency: settings.currency, exact: true })} for ${a.service.name} (${a.reference})`,
        link: `/receipts/${payment.id}`,
      });
      if (opts.firstPayment) {
        await smsCustomer(a, `${settings.businessName}: You're booked for ${formatDateTime(a.startsAt, settings.timezone)}. Ref ${a.reference}`, "booking-confirmed");
        await alertAdmins(brand, settings, {
          type: "NEW_BOOKING",
          title: `New booking ${a.reference}`,
          body: `${a.customerName} booked ${a.service.name} for ${formatDateTime(a.startsAt, settings.timezone)}`,
          path: `/admin/appointments/${a.id}`,
          lines: bookingAdminLines(a, settings),
        });
      }
      await inApp({
        audience: "ADMIN",
        type: "NEW_PAYMENT",
        title: `Payment ${formatCurrency(payment.amount, { currency: settings.currency, exact: true })}`,
        body: `${payment.type.toLowerCase()} payment from ${a.customerName} for ${a.reference}`,
        link: `/admin/appointments/${a.id}`,
      });
    }),

  rescheduled: (appointmentId: string, previousStartsAt: Date) =>
    safe("rescheduled", async () => {
      const a = await loadAppointment(appointmentId);
      if (!a) return;
      const { settings, brand } = await context();
      const previous = formatDateTime(previousStartsAt, settings.timezone);
      const mail = emailTemplates.appointmentRescheduled(brand, emailData(a, settings), previous);
      await sendEmail({ to: a.customerEmail, template: "appointment-rescheduled", ...mail });
      await inApp({
        userId: a.userId,
        audience: "CUSTOMER",
        type: "APPOINTMENT_RESCHEDULED",
        title: "Appointment rescheduled",
        body: `New time: ${formatDateTime(a.startsAt, settings.timezone)}`,
        link: customerAppointmentPath(a),
      });
      await smsCustomer(a, `${settings.businessName}: Your appointment moved to ${formatDateTime(a.startsAt, settings.timezone)}. Ref ${a.reference}`, "appointment-rescheduled");
    }),

  cancelled: (appointmentId: string, opts: { reason?: string | null; byCustomer: boolean }) =>
    safe("cancelled", async () => {
      const a = await loadAppointment(appointmentId);
      if (!a) return;
      const { settings, brand } = await context();
      const mail = emailTemplates.appointmentCancelled(brand, emailData(a, settings), opts.reason);
      await sendEmail({ to: a.customerEmail, template: "appointment-cancelled", ...mail });
      await inApp({
        userId: a.userId,
        audience: "CUSTOMER",
        type: "APPOINTMENT_CANCELLED",
        title: "Appointment cancelled",
        body: `${a.service.name} on ${formatDateTime(a.startsAt, settings.timezone)} was cancelled`,
        link: customerAppointmentPath(a),
      });
      await smsCustomer(a, `${settings.businessName}: Your appointment on ${formatDateTime(a.startsAt, settings.timezone)} was cancelled. Ref ${a.reference}`, "appointment-cancelled");
      if (opts.byCustomer) {
        await inApp({
          audience: "ADMIN",
          type: "APPOINTMENT_CANCELLED",
          title: `Cancelled by customer: ${a.reference}`,
          body: `${a.customerName} cancelled ${a.service.name} on ${formatDateTime(a.startsAt, settings.timezone)}`,
          link: `/admin/appointments/${a.id}`,
        });
      }
    }),

  completed: (appointmentId: string) =>
    safe("completed", async () => {
      const a = await loadAppointment(appointmentId);
      if (!a) return;
      const { settings, brand } = await context();
      const reviewUrl = `${env.siteUrl}/reviews?appointment=${a.id}&t=${a.manageToken}#write`;
      const mail = emailTemplates.appointmentCompleted(brand, emailData(a, settings), reviewUrl);
      await sendEmail({ to: a.customerEmail, template: "appointment-completed", ...mail });
      await inApp({
        userId: a.userId,
        audience: "CUSTOMER",
        type: "APPOINTMENT_COMPLETED",
        title: "Your vehicle is ready",
        body: `${a.service.name} is complete. We'd love your feedback!`,
        link: `/reviews?appointment=${a.id}&t=${a.manageToken}#write`,
      });
      await smsCustomer(a, `${settings.businessName}: Your ${a.service.name} is complete! Keep windows up for 3–5 days.`, "appointment-completed");
    }),

  reminder: (appointmentId: string) =>
    safe("reminder", async () => {
      const a = await loadAppointment(appointmentId);
      if (!a) return;
      const { settings, brand } = await context();
      const mail = emailTemplates.bookingReminder(brand, emailData(a, settings));
      await sendEmail({ to: a.customerEmail, template: "booking-reminder", ...mail });
      await inApp({
        userId: a.userId,
        audience: "CUSTOMER",
        type: "BOOKING_REMINDER",
        title: "Upcoming appointment",
        body: `${a.service.name} on ${formatDateTime(a.startsAt, settings.timezone)}`,
        link: customerAppointmentPath(a),
      });
      await smsCustomer(a, `${settings.businessName} reminder: ${a.service.name} on ${formatDateTime(a.startsAt, settings.timezone)}. Reply or call ${settings.phone} to change.`, "booking-reminder");
    }),

  quoteReceived: (quoteId: string) =>
    safe("quoteReceived", async () => {
      const q = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: { service: { select: { name: true } }, serviceOption: { select: { name: true } }, filmType: { select: { name: true } } },
      });
      if (!q) return;
      const { settings, brand } = await context();
      const summary = [q.service?.name, q.serviceOption?.name, q.filmType ? `${q.filmType.name}${q.shade ? ` ${q.shade}%` : ""}` : null]
        .filter(Boolean)
        .join(" · ");
      const estimate = formatCurrency(q.estimatedTotal, { currency: settings.currency });
      const mail = emailTemplates.quoteReceived(brand, { name: q.name, reference: q.reference, summary, estimate });
      await sendEmail({ to: q.email, template: "quote-received", ...mail });
      await inApp({ userId: q.userId, audience: "CUSTOMER", type: "QUOTE_RECEIVED", title: "Quote request received", body: summary, link: "/dashboard/quotes" });
      await alertAdmins(brand, settings, {
        type: "NEW_QUOTE",
        title: `New quote ${q.reference}`,
        body: `${q.name} — ${summary} (${estimate})`,
        path: `/admin/quotes/${q.id}`,
        lines: [
          { label: "Customer", value: `${q.name} · ${q.phone}` },
          { label: "Email", value: q.email },
          { label: "Vehicle", value: vehicleLabel(q) },
          { label: "Request", value: summary },
          { label: "Estimate", value: estimate },
        ],
      });
    }),

  quoteResponded: (quoteId: string) =>
    safe("quoteResponded", async () => {
      const q = await prisma.quote.findUnique({ where: { id: quoteId }, include: { service: { select: { slug: true } } } });
      if (!q || !q.responseMessage) return;
      const { settings, brand } = await context();
      const params = new URLSearchParams();
      if (q.serviceId) params.set("service", q.serviceId);
      if (q.serviceOptionId) params.set("option", q.serviceOptionId);
      if (q.filmTypeId) params.set("film", q.filmTypeId);
      if (q.shade) params.set("shade", String(q.shade));
      if (q.vehicleTypeId) params.set("vt", q.vehicleTypeId);
      if (q.vehicleSizeId) params.set("vs", q.vehicleSizeId);
      const mail = emailTemplates.quoteResponse(brand, {
        name: q.name,
        reference: q.reference,
        message: q.responseMessage,
        price: q.quotedPrice != null ? formatCurrency(q.quotedPrice, { currency: settings.currency }) : null,
        bookUrl: `${env.siteUrl}/book?${params.toString()}`,
      });
      await sendEmail({ to: q.email, template: "quote-response", ...mail, replyTo: settings.email });
      await inApp({ userId: q.userId, audience: "CUSTOMER", type: "QUOTE_RESPONSE", title: "Your estimate is ready", body: q.responseMessage.slice(0, 200), link: "/dashboard/quotes" });
    }),

  contactReceived: (messageId: string) =>
    safe("contactReceived", async () => {
      const m = await prisma.contactMessage.findUnique({ where: { id: messageId } });
      if (!m) return;
      const { settings, brand } = await context();
      await sendEmail({ to: m.email, template: "contact-auto-reply", ...emailTemplates.contactAutoReply(brand, { name: m.name }) });
      await alertAdmins(brand, settings, {
        type: "NEW_CONTACT",
        title: `New message from ${m.name}`,
        body: m.message.slice(0, 200),
        path: `/admin/messages?open=${m.id}`,
        lines: [
          { label: "From", value: `${m.name} <${m.email}>` },
          { label: "Phone", value: m.phone ?? "—" },
          { label: "Vehicle", value: m.vehicle ?? "—" },
          { label: "Interested in", value: m.serviceInterest ?? "—" },
          { label: "Message", value: m.message.slice(0, 500) },
        ],
      });
    }),

  reviewSubmitted: (reviewId: string) =>
    safe("reviewSubmitted", async () => {
      const r = await prisma.review.findUnique({ where: { id: reviewId } });
      if (!r) return;
      const { settings, brand } = await context();
      await alertAdmins(brand, settings, {
        type: "NEW_REVIEW",
        title: `New ${r.rating}★ review from ${r.name}`,
        body: r.body.slice(0, 200),
        path: "/admin/reviews?status=PENDING",
        lines: [
          { label: "Rating", value: `${r.rating} / 5` },
          { label: "Vehicle", value: r.vehicle ?? "—" },
          { label: "Review", value: r.body.slice(0, 500) },
        ],
      });
    }),
};

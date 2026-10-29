import "server-only";
import { formatCurrency } from "@/lib/utils";

/** Branding + contact details every template needs. */
export interface EmailBrand {
  businessName: string;
  phone: string;
  email: string;
  address: string;
  siteUrl: string;
}

export function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Row {
  label: string;
  value: string;
}

interface LayoutInput {
  brand: EmailBrand;
  preheader: string;
  heading: string;
  intro: string;
  rows?: Row[];
  totals?: Row[];
  cta?: { label: string; href: string };
  outro?: string;
}

const ACCENT = "#1f6bff";

function layout({ brand, preheader, heading, intro, rows, totals, cta, outro }: LayoutInput) {
  const rowHtml = (list: Row[], strongLast = false) =>
    list
      .map(
        (r, i) => `<tr>
          <td style="padding:10px 0;color:#9aa0a6;font-size:14px;border-bottom:1px solid #1f2227">${escapeHtml(r.label)}</td>
          <td style="padding:10px 0;color:#f5f6f7;font-size:14px;text-align:right;border-bottom:1px solid #1f2227;${strongLast && i === list.length - 1 ? "font-weight:700;font-size:16px" : ""}">${escapeHtml(r.value)}</td>
        </tr>`,
      )
      .join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#07080a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07080a;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#0f1114;border:1px solid #1f2227;border-radius:16px;overflow:hidden">
<tr><td style="padding:28px 32px;border-bottom:1px solid #1f2227">
  <div style="font-size:13px;letter-spacing:.24em;text-transform:uppercase;color:#f5f6f7;font-weight:800">${escapeHtml(brand.businessName)}</div>
</td></tr>
<tr><td style="padding:32px">
  <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#ffffff">${escapeHtml(heading)}</h1>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#c4c8cd">${intro}</p>
  ${rows?.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 16px">${rowHtml(rows)}</table>` : ""}
  ${totals?.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px">${rowHtml(totals, true)}</table>` : ""}
  ${cta ? `<p style="margin:28px 0 8px"><a href="${escapeHtml(cta.href)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:999px">${escapeHtml(cta.label)}</a></p>` : ""}
  ${outro ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#9aa0a6">${outro}</p>` : ""}
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #1f2227;font-size:12px;line-height:1.6;color:#6b7078">
  ${escapeHtml(brand.businessName)} · ${escapeHtml(brand.address)}<br>
  <a href="tel:${escapeHtml(brand.phone.replace(/[^0-9+]/g, ""))}" style="color:#9aa0a6">${escapeHtml(brand.phone)}</a> · <a href="mailto:${escapeHtml(brand.email)}" style="color:#9aa0a6">${escapeHtml(brand.email)}</a>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    heading,
    "",
    intro.replace(/<[^>]+>/g, ""),
    "",
    ...(rows ?? []).map((r) => `${r.label}: ${r.value}`),
    ...(totals ?? []).map((r) => `${r.label}: ${r.value}`),
    cta ? `\n${cta.label}: ${cta.href}` : "",
    outro ? `\n${outro.replace(/<[^>]+>/g, "")}` : "",
    "",
    `${brand.businessName} · ${brand.phone} · ${brand.email}`,
  ].join("\n");

  return { html, text };
}

export interface AppointmentEmailData {
  reference: string;
  customerName: string;
  serviceName: string;
  vehicle: string;
  when: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  currency: string;
  manageUrl: string;
}

function appointmentRows(a: AppointmentEmailData): Row[] {
  return [
    { label: "Reference", value: a.reference },
    { label: "Service", value: a.serviceName },
    { label: "Vehicle", value: a.vehicle },
    { label: "When", value: a.when },
  ];
}

function appointmentTotals(a: AppointmentEmailData): Row[] {
  const fmt = (n: number) => formatCurrency(n, { currency: a.currency, exact: true });
  const rows: Row[] = [{ label: "Subtotal", value: fmt(a.subtotal) }];
  if (a.discount > 0) rows.push({ label: "Discount", value: `−${fmt(a.discount)}` });
  if (a.tax > 0) rows.push({ label: "Tax", value: fmt(a.tax) });
  rows.push({ label: "Total", value: fmt(a.total) });
  if (a.amountPaid > 0) rows.push({ label: "Paid", value: fmt(a.amountPaid) }, { label: "Balance due at shop", value: fmt(Math.max(0, a.total - a.amountPaid)) });
  return rows;
}

const first = (name: string) => escapeHtml(name.split(" ")[0] || name);

export const emailTemplates = {
  bookingReceived(brand: EmailBrand, a: AppointmentEmailData, confirmed: boolean) {
    return {
      subject: confirmed ? `You're booked — ${a.serviceName} on ${a.when}` : `Booking request received — ${a.reference}`,
      ...layout({
        brand,
        preheader: `${a.serviceName} · ${a.when}`,
        heading: confirmed ? "Your appointment is confirmed" : "We received your booking request",
        intro: confirmed
          ? `Thanks ${first(a.customerName)} — your spot is reserved. Here are the details:`
          : `Thanks ${first(a.customerName)} — we'll confirm your appointment shortly. Here's what you requested:`,
        rows: appointmentRows(a),
        totals: appointmentTotals(a),
        cta: { label: "Manage appointment", href: a.manageUrl },
        outro: "Please arrive a few minutes early with the windows clean and the vehicle interior free of loose items near the glass.",
      }),
    };
  },
  bookingReminder(brand: EmailBrand, a: AppointmentEmailData) {
    return {
      subject: `Reminder: ${a.serviceName} — ${a.when}`,
      ...layout({
        brand,
        preheader: `See you ${a.when}`,
        heading: "See you soon",
        intro: `Hi ${first(a.customerName)}, this is a friendly reminder about your upcoming appointment.`,
        rows: appointmentRows(a),
        cta: { label: "View or reschedule", href: a.manageUrl },
        outro: "Need to change something? Use the link above or give us a call.",
      }),
    };
  },
  appointmentRescheduled(brand: EmailBrand, a: AppointmentEmailData, previous: string) {
    return {
      subject: `Appointment rescheduled — ${a.when}`,
      ...layout({
        brand,
        preheader: `New time: ${a.when}`,
        heading: "Your appointment has been rescheduled",
        intro: `Hi ${first(a.customerName)}, your appointment moved from <strong>${escapeHtml(previous)}</strong> to the new time below.`,
        rows: appointmentRows(a),
        cta: { label: "View appointment", href: a.manageUrl },
      }),
    };
  },
  appointmentCancelled(brand: EmailBrand, a: AppointmentEmailData, reason?: string | null) {
    return {
      subject: `Appointment cancelled — ${a.reference}`,
      ...layout({
        brand,
        preheader: "Your appointment was cancelled",
        heading: "Your appointment was cancelled",
        intro: `Hi ${first(a.customerName)}, your appointment for ${escapeHtml(a.serviceName)} on ${escapeHtml(a.when)} has been cancelled.${reason ? ` Reason: ${escapeHtml(reason)}` : ""}`,
        rows: appointmentRows(a),
        cta: { label: "Book a new time", href: `${brand.siteUrl}/book` },
        outro: "If a refund applies under our cancellation policy it will be processed to your original payment method.",
      }),
    };
  },
  appointmentCompleted(brand: EmailBrand, a: AppointmentEmailData, reviewUrl: string) {
    return {
      subject: `Your ${a.serviceName} is complete`,
      ...layout({
        brand,
        preheader: "Care tips inside + share your experience",
        heading: "Your vehicle is ready",
        intro: `Thanks for trusting us, ${first(a.customerName)}! Keep windows rolled up for 3–5 days and avoid cleaning the film for a week while it cures. Small haze or water pockets are normal and disappear as the film dries.`,
        rows: appointmentRows(a),
        cta: { label: "Leave a review", href: reviewUrl },
        outro: "Your warranty details are available anytime from your account or by contacting us.",
      }),
    };
  },
  paymentReceipt(
    brand: EmailBrand,
    a: AppointmentEmailData,
    p: { receiptNumber: string; amount: number; type: string; paidAt: string; method?: string | null; receiptUrl: string },
  ) {
    const fmt = (n: number) => formatCurrency(n, { currency: a.currency, exact: true });
    return {
      subject: `Payment receipt ${p.receiptNumber} — ${fmt(p.amount)}`,
      ...layout({
        brand,
        preheader: `We received ${fmt(p.amount)}`,
        heading: "Payment received",
        intro: `Thanks ${first(a.customerName)} — we received your ${escapeHtml(p.type.toLowerCase())} payment.`,
        rows: [
          { label: "Receipt", value: p.receiptNumber },
          { label: "Amount", value: fmt(p.amount) },
          { label: "Date", value: p.paidAt },
          ...(p.method ? [{ label: "Method", value: p.method }] : []),
          ...appointmentRows(a),
        ],
        totals: appointmentTotals(a),
        cta: { label: "View receipt", href: p.receiptUrl },
      }),
    };
  },
  quoteReceived(brand: EmailBrand, q: { name: string; reference: string; summary: string; estimate: string }) {
    return {
      subject: `Your quote request ${q.reference}`,
      ...layout({
        brand,
        preheader: `Estimated ${q.estimate}`,
        heading: "We received your quote request",
        intro: `Thanks ${first(q.name)}! A specialist will review your request and follow up shortly — usually within one business day.`,
        rows: [
          { label: "Reference", value: q.reference },
          { label: "Request", value: q.summary },
          { label: "Online estimate", value: q.estimate },
        ],
        cta: { label: "Book an appointment", href: `${brand.siteUrl}/book` },
        outro: "Online estimates are based on the options you selected; your final price is confirmed after we see the vehicle.",
      }),
    };
  },
  quoteResponse(brand: EmailBrand, q: { name: string; reference: string; message: string; price?: string | null; bookUrl: string }) {
    return {
      subject: `Your estimate from ${brand.businessName} — ${q.reference}`,
      ...layout({
        brand,
        preheader: q.price ? `Your price: ${q.price}` : "We've reviewed your request",
        heading: "Your estimate is ready",
        intro: `Hi ${first(q.name)},<br><br>${escapeHtml(q.message).replace(/\n/g, "<br>")}`,
        rows: q.price ? [{ label: "Quoted price", value: q.price }, { label: "Reference", value: q.reference }] : [{ label: "Reference", value: q.reference }],
        cta: { label: "Book this service", href: q.bookUrl },
      }),
    };
  },
  contactAutoReply(brand: EmailBrand, c: { name: string }) {
    return {
      subject: `Thanks for contacting ${brand.businessName}`,
      ...layout({
        brand,
        preheader: "We'll get back to you soon",
        heading: "Message received",
        intro: `Thanks ${first(c.name)} — we got your message and will reply within one business day. Need a faster answer? Give us a call.`,
        cta: { label: "Get an instant quote", href: `${brand.siteUrl}/quote` },
      }),
    };
  },
  passwordReset(brand: EmailBrand, r: { name: string | null; url: string }) {
    return {
      subject: `Reset your ${brand.businessName} password`,
      ...layout({
        brand,
        preheader: "This link expires in 1 hour",
        heading: "Reset your password",
        intro: `Hi ${first(r.name ?? "there")}, use the button below to choose a new password. This link expires in 1 hour. If you didn't request this you can ignore this email.`,
        cta: { label: "Reset password", href: r.url },
      }),
    };
  },
  adminAlert(brand: EmailBrand, alert: { title: string; lines: Row[]; href: string }) {
    return {
      subject: `[${brand.businessName}] ${alert.title}`,
      ...layout({
        brand,
        preheader: alert.title,
        heading: alert.title,
        intro: "A new event needs your attention:",
        rows: alert.lines,
        cta: { label: "Open in dashboard", href: alert.href },
      }),
    };
  },
};

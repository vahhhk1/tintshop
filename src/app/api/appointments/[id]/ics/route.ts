import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { tokenMatches } from "@/server/appointments/access";
import { formatAddress, getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** Downloads an .ics calendar file for an appointment (guest token or signed-in owner/staff). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("t");
  const a = await prisma.appointment.findUnique({
    where: { id },
    include: { service: { select: { name: true } }, serviceOption: { select: { name: true } } },
  });
  if (!a) return new Response("Not found", { status: 404 });
  let allowed = tokenMatches(a.manageToken, token);
  if (!allowed) {
    const user = await getSessionUser();
    allowed = Boolean(user && (user.id === a.userId || can(user.role, "appointments:manage")));
  }
  if (!allowed) return new Response("Not found", { status: 404 });

  const settings = await getSettings();
  const title = `${[a.service.name, a.serviceOption?.name].filter(Boolean).join(" — ")} · ${settings.businessName}`;
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tint Shop//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${a.id}@tint-shop`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(a.startsAt)}`,
    `DTEND:${icsDate(a.endsAt)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(`Booking ${a.reference}\nQuestions? Call ${settings.phone}`)}`,
    `LOCATION:${esc(formatAddress(settings))}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${a.reference}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

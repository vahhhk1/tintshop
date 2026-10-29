"use server";

import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { limitByIp } from "@/lib/rate-limit";
import { fieldErrors, type ActionResult } from "@/lib/validation/common";
import { contactSchema, reviewSchema } from "@/lib/validation/public";
import { tokenMatches } from "@/server/appointments/access";
import { notify } from "@/server/notifications";

export async function submitContactAction(input: unknown): Promise<ActionResult> {
  const limit = await limitByIp("contact", 5, 60 * 60);
  if (!limit.success) return { ok: false, error: "Too many messages. Please try again later or call us." };
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const { company, ...data } = parsed.data;
  // Honeypot filled: report success without storing anything.
  if (company) return { ok: true, message: "Thanks! We'll be in touch soon." };

  const message = await prisma.contactMessage.create({ data });
  after(() => notify.contactReceived(message.id));
  return { ok: true, message: "Thanks! We'll be in touch within one business day." };
}

export async function submitReviewAction(input: unknown): Promise<ActionResult> {
  const limit = await limitByIp("review", 4, 60 * 60);
  if (!limit.success) return { ok: false, error: "Too many submissions. Please try again later." };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const { company, appointmentId, ...data } = parsed.data;
  if (company) return { ok: true, message: "Thanks for your review!" };

  const user = await getSessionUser();
  let linkedAppointmentId: string | null = null;
  if (appointmentId) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, userId: true, manageToken: true, status: true, review: { select: { id: true } } },
    });
    const token = (input as { token?: string | null }).token;
    const allowed = appointment && ((user && appointment.userId === user.id) || tokenMatches(appointment.manageToken, token));
    if (appointment && allowed) {
      if (appointment.review) return { ok: false, error: "You've already reviewed this appointment — thank you!" };
      linkedAppointmentId = appointment.id;
    }
  }

  const review = await prisma.review.create({
    data: { ...data, email: data.email ?? user?.email ?? null, userId: user?.id ?? null, appointmentId: linkedAppointmentId, status: "PENDING" },
  });
  after(() => notify.reviewSubmitted(review.id));
  return { ok: true, message: "Thanks for your review! It will appear once approved." };
}

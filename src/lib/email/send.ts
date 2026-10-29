import "server-only";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  replyTo?: string;
}

/**
 * Sends a transactional email through Resend's HTTP API. When EMAIL_API_KEY is not
 * configured the message is logged instead so development flows still work.
 */
export async function sendEmail(message: EmailMessage) {
  if (!env.email.enabled) {
    console.info(`[email:not-configured] to=${message.to} subject="${message.subject}"`);
    await logMessage(message, "SKIPPED", { error: "EMAIL_API_KEY not configured" });
    return { ok: true as const, skipped: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.email.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.email.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      await logMessage(message, "FAILED", { error: body.message ?? `HTTP ${response.status}` });
      return { ok: false as const, error: body.message ?? "Email failed" };
    }
    await logMessage(message, "SENT", { providerMessageId: body.id });
    return { ok: true as const, id: body.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await logMessage(message, "FAILED", { error: msg });
    return { ok: false as const, error: msg };
  }
}

async function logMessage(
  message: EmailMessage,
  status: "SENT" | "FAILED" | "SKIPPED",
  extra: { providerMessageId?: string; error?: string },
) {
  await prisma.messageLog
    .create({
      data: {
        channel: "EMAIL",
        to: message.to,
        subject: message.subject.slice(0, 250),
        template: message.template,
        status,
        provider: "resend",
        providerMessageId: extra.providerMessageId,
        error: extra.error?.slice(0, 500),
      },
    })
    .catch((e) => console.error("[email] failed to write MessageLog", e));
}

import "server-only";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";

/**
 * SMS abstraction. Add a provider by implementing `SmsProvider` and returning it
 * from `getSmsProvider()`. With no provider configured, sends are skipped and logged.
 */
export interface SmsProvider {
  name: string;
  send(to: string, body: string): Promise<{ id?: string }>;
}

class TwilioProvider implements SmsProvider {
  name = "twilio";
  constructor(
    private sid: string,
    private token: string,
    private from: string,
  ) {}

  async send(to: string, body: string) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: this.from, Body: body }),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) throw new Error(json.message ?? `Twilio HTTP ${res.status}`);
    return { id: json.sid };
  }
}

export function getSmsProvider(): SmsProvider | null {
  if (env.sms.provider === "twilio" && env.sms.twilioSid && env.sms.twilioToken && env.sms.twilioFrom) {
    return new TwilioProvider(env.sms.twilioSid, env.sms.twilioToken, env.sms.twilioFrom);
  }
  return null;
}

/** Best-effort E.164 normalisation (defaults to +1 for 10-digit numbers). */
export function toE164(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function sendSms(to: string, body: string, template: string) {
  const provider = getSmsProvider();
  const number = toE164(to);
  if (!provider) {
    await prisma.messageLog
      .create({ data: { channel: "SMS", to: number, template, status: "SKIPPED", error: "SMS provider not configured" } })
      .catch(() => {});
    return { ok: true as const, skipped: true };
  }
  try {
    const { id } = await provider.send(number, body.slice(0, 480));
    await prisma.messageLog.create({ data: { channel: "SMS", to: number, template, status: "SENT", provider: provider.name, providerMessageId: id } });
    return { ok: true as const, id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "SMS failed";
    await prisma.messageLog
      .create({ data: { channel: "SMS", to: number, template, status: "FAILED", provider: provider.name, error: msg.slice(0, 500) } })
      .catch(() => {});
    return { ok: false as const, error: msg };
  }
}

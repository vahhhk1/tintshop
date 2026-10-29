"use server";

import { AuthError } from "next-auth";
import { after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { signIn, signOut } from "@/lib/auth";
import { hashPassword, randomToken, sha256 } from "@/lib/auth/password";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { emailTemplates } from "@/lib/email/templates";
import { limitByIp } from "@/lib/rate-limit";
import { fieldErrors, type ActionResult } from "@/lib/validation/common";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validation/public";
import { formatAddress, getSettings } from "@/server/settings";

/** Only allow same-site relative redirects after sign-in. */
function safeCallback(url: unknown, fallback = "/dashboard") {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\") ? url : fallback;
}

export async function loginAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please enter your email and password.", fieldErrors: fieldErrors(parsed.error) };
  const callbackUrl = safeCallback((input as { callbackUrl?: unknown })?.callbackUrl);
  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error as AuthError & { code?: string }).code;
      if (code === "rate_limited") return { ok: false, error: "Too many sign-in attempts. Please wait 15 minutes and try again." };
      return { ok: false, error: "Incorrect email or password." };
    }
    throw error;
  }
  // Staff land in the admin dashboard unless they asked for somewhere specific.
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { role: true } });
  const url = callbackUrl === "/dashboard" && user && user.role !== "CUSTOMER" ? "/admin" : callbackUrl;
  return { ok: true, data: { url } };
}

export async function registerAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  const limit = await limitByIp("register", 5, 60 * 60);
  if (!limit.success) return { ok: false, error: "Too many sign-ups from this network. Please try again later." };
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const { name, email, phone, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "An account with this email already exists. Try signing in or resetting your password.", fieldErrors: { email: ["Already registered"] } };

  await prisma.user.create({
    data: { name, email, phone, passwordHash: await hashPassword(password), profile: { create: {} } },
  });
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    return { ok: true, message: "Account created — please sign in.", data: { url: "/login" } };
  }
  return { ok: true, message: "Welcome! Your account is ready.", data: { url: safeCallback((input as { callbackUrl?: unknown })?.callbackUrl) } };
}

export async function googleSignInAction(formData: FormData) {
  await signIn("google", { redirectTo: safeCallback(formData.get("callbackUrl")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  const limit = await limitByIp("forgot-password", 5, 60 * 60);
  if (!limit.success) return { ok: false, error: "Too many requests. Please try again later." };
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address.", fieldErrors: fieldErrors(parsed.error) };

  // Same response whether or not the account exists, to avoid account enumeration.
  const message = "If an account exists for that email, we’ve sent a link to reset your password.";
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, name: true, email: true, isActive: true } });
  if (!user || !user.isActive) return { ok: true, message };

  const token = randomToken(32);
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });

  after(async () => {
    const settings = await getSettings();
    const brand = { businessName: settings.businessName, phone: settings.phone, email: settings.email, address: formatAddress(settings), siteUrl: env.siteUrl };
    const mail = emailTemplates.passwordReset(brand, { name: user.name, url: `${env.siteUrl}/reset-password?token=${token}` });
    await sendEmail({ to: user.email, template: "password-reset", ...mail });
    if (!env.email.enabled && !env.isProduction) console.info(`[dev] Password reset link for ${user.email}: ${env.siteUrl}/reset-password?token=${token}`);
  });
  return { ok: true, message };
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const limit = await limitByIp("reset-password", 10, 60 * 60);
  if (!limit.success) return { ok: false, error: "Too many attempts. Please try again later." };
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(parsed.data.token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return { ok: false, error: "This reset link is invalid or has expired. Please request a new one." };

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(parsed.data.password) } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  return { ok: true, message: "Password updated. You can now sign in." };
}

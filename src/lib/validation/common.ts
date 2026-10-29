import { z } from "zod";

/** Trims and collapses control characters. React escapes output, so this is defence in depth. */
export const cleanText = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(z.string().max(max, `Must be ${max} characters or fewer`));

export const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `${label} is required` })
    .transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(z.string().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`));

export const optionalText = (max = 500) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      const t = (v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
      return t === "" ? null : t;
    })
    .pipe(z.string().max(max, `Must be ${max} characters or fewer`).nullable());

export const emailField = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(254)
  .pipe(z.email("Enter a valid email address"));

export const phoneField = z
  .string({ error: "Phone is required" })
  .trim()
  .min(1, "Phone is required")
  .max(30)
  .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a valid phone number");

export const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || v.replace(/\D/g, "").length >= 10, "Enter a valid phone number");

export const idField = z.string().trim().min(1).max(64);
export const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const ymdField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
export const hmField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

const currentYear = new Date().getFullYear();
export const vehicleYearField = z.coerce
  .number({ error: "Year is required" })
  .int()
  .min(1950, "Enter a valid year")
  .max(currentYear + 2, "Enter a valid year");

export const passwordField = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include at least one letter and one number");

/** Money entered as dollars in forms → integer cents. */
export const centsField = z.coerce
  .number({ error: "Enter an amount" })
  .min(0, "Must be 0 or more")
  .max(1_000_000)
  .transform((v) => Math.round(v * 100));

export const optionalCents = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().min(0).max(1_000_000)])
  .transform((v) => (v === "" || v == null ? null : Math.round(Number(v) * 100)));

export const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false"), z.literal(""), z.null(), z.undefined()])
  .transform((v) => v === true || v === "on" || v === "true");

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function formDataToObject(formData: FormData) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (key in out) {
      const existing = out[key];
      out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

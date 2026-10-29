import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import type { z } from "zod";
import { assertPermission, AuthorizationError, type SessionUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/roles";
import { fieldErrors, formDataToObject, type ActionResult } from "@/lib/validation/common";
import { CACHE_TAGS } from "@/server/settings";

export type FormActionState = ActionResult<Record<string, unknown>> | null;

/**
 * Wraps an admin mutation: checks the permission against the database-backed
 * session, converts errors into ActionResults and never leaks internals.
 */
export async function adminAction<T = Record<string, unknown>>(permission: Permission, fn: (user: SessionUser) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const user = await assertPermission(permission);
    return await fn(user);
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    if (isUniqueViolation(error)) return { ok: false, error: "That value is already in use (must be unique)." };
    if (isNextControlFlow(error)) throw error;
    console.error("[admin-action]", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

function isNextControlFlow(error: unknown) {
  const digest = (error as { digest?: string } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND") || digest.startsWith("NEXT_HTTP_ERROR"));
}

/** Parses FormData (or a plain object) with a Zod schema into an ActionResult-friendly shape. */
export function parseForm<S extends z.ZodType>(schema: S, input: FormData | Record<string, unknown>) {
  const raw = input instanceof FormData ? formDataToObject(input) : input;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, result: { ok: false as const, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) } };
  }
  return { ok: true as const, data: parsed.data as z.output<S> };
}

/** Expires cached public data after admin edits so the site updates immediately. */
export function invalidate(...tags: (keyof typeof CACHE_TAGS)[]) {
  for (const tag of tags) revalidateTag(CACHE_TAGS[tag], { expire: 0 });
  revalidatePath("/", "layout");
}

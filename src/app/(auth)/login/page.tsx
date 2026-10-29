import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/auth-forms";
import { GoogleButton } from "@/components/forms/google-button";
import { getSessionUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/roles";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "That email is linked to a different sign-in method.",
  AccessDenied: "Access denied. Your account may be disabled.",
  Configuration: "Sign-in is temporarily unavailable.",
  CredentialsSignin: "Incorrect email or password.",
};

function safe(url?: string) {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : "/dashboard";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const sp = await searchParams;
  const callbackUrl = safe(sp.callbackUrl);
  const user = await getSessionUser().catch(() => null);
  if (user) redirect(callbackUrl === "/dashboard" && isStaffRole(user.role) ? "/admin" : callbackUrl);

  return (
    <div>
      <h1 className="text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Sign in to manage appointments, quotes and vehicles.</p>
      <div className="mt-8 grid gap-6">
        {env.google.enabled && (
          <>
            <GoogleButton callbackUrl={callbackUrl} />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-white/10" /> or with email <span className="h-px flex-1 bg-white/10" />
            </div>
          </>
        )}
        <LoginForm callbackUrl={callbackUrl} initialError={sp.error ? (ERRORS[sp.error] ?? "Sign-in failed. Please try again.") : null} />
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="font-medium text-foreground hover:text-primary">
          Create an account
        </Link>
      </p>
      {!env.isProduction && (
        <div className="mt-10 rounded-2xl border border-dashed border-white/15 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground/80">Development demo accounts</p>
          <p className="mt-1">
            Admin: <code>admin@example.com</code> · Customer: <code>customer@example.com</code> (also <code>manager@</code>, <code>staff@example.com</code>). Passwords are
            SEED_ADMIN_PASSWORD / SEED_CUSTOMER_PASSWORD in your <code>.env</code>.
          </p>
        </div>
      )}
    </div>
  );
}

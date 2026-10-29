import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/forms/auth-forms";
import { GoogleButton } from "@/components/forms/google-button";
import { getSessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const sp = await searchParams;
  const callbackUrl = sp.callbackUrl && sp.callbackUrl.startsWith("/") && !sp.callbackUrl.startsWith("//") ? sp.callbackUrl : "/dashboard";
  if (await getSessionUser().catch(() => null)) redirect(callbackUrl);
  return (
    <div>
      <h1 className="text-3xl font-semibold">Create your account</h1>
      <p className="mt-2 text-muted-foreground">Book faster, save your vehicles and track every appointment and receipt.</p>
      <div className="mt-8 grid gap-6">
        {env.google.enabled && (
          <>
            <GoogleButton callbackUrl={callbackUrl} />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-white/10" /> or with email <span className="h-px flex-1 bg-white/10" />
            </div>
          </>
        )}
        <RegisterForm callbackUrl={callbackUrl} />
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:text-primary">
          Sign in
        </Link>
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/forms/auth-forms";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div>
      <h1 className="text-3xl font-semibold">Choose a new password</h1>
      {token ? (
        <div className="mt-8">
          <ResetPasswordForm token={token} />
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          <p className="text-muted-foreground">This link is missing its reset token. Please request a new one.</p>
          <Button asChild>
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

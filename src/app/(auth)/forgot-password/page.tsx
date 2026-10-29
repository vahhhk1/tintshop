import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold">Reset your password</h1>
      <p className="mt-2 mb-8 text-muted-foreground">Enter the email you signed up with and we’ll send you a secure reset link.</p>
      <ForgotPasswordForm />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-foreground hover:text-primary">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

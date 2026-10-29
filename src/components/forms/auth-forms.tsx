"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validation/public";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/server/auth/actions";

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function LoginForm({ callbackUrl, initialError }: { callbackUrl: string; initialError?: string | null }) {
  const form = useForm<z.input<typeof loginSchema>, unknown, z.output<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const action = useFormAction(form, loginAction, {
    successToast: false,
    onSuccess: (res) => window.location.assign((res.data as { url: string }).url),
  });
  const errors = form.formState.errors;
  return (
    <form method="post" onSubmit={form.handleSubmit((v) => action.run({ ...v, callbackUrl }))} noValidate className="grid gap-5">
      {initialError && !action.result && <FormMessage type="error">{initialError}</FormMessage>}
      {action.result && !action.result.ok && <FormMessage type="error">{action.result.error}</FormMessage>}
      <Field id="login-email" label="Email" required error={errors.email?.message}>
        <Input type="email" autoComplete="email" inputMode="email" autoFocus {...form.register("email")} />
      </Field>
      <Field id="login-password" label="Password" required error={errors.password?.message}>
        <PasswordInput autoComplete="current-password" {...form.register("password")} />
      </Field>
      <div className="-mt-2 text-right">
        <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" loading={action.pending}>
        Sign in
      </Button>
    </form>
  );
}

export function RegisterForm({ callbackUrl }: { callbackUrl: string }) {
  const form = useForm<z.input<typeof registerSchema>, unknown, z.output<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", phone: "", password: "", confirmPassword: "" },
  });
  const action = useFormAction(form, registerAction, {
    onSuccess: (res) => window.location.assign((res.data as { url: string }).url),
  });
  const errors = form.formState.errors;
  return (
    <form method="post" onSubmit={form.handleSubmit((v) => action.run({ ...v, callbackUrl }))} noValidate className="grid gap-5">
      {action.result && !action.result.ok && <FormMessage type="error">{action.result.error}</FormMessage>}
      <Field id="reg-name" label="Full name" required error={errors.name?.message}>
        <Input autoComplete="name" {...form.register("name")} />
      </Field>
      <Field id="reg-email" label="Email" required error={errors.email?.message}>
        <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
      </Field>
      <Field id="reg-phone" label="Mobile phone" error={errors.phone?.message} hint="For appointment reminders">
        <Input type="tel" autoComplete="tel" inputMode="tel" {...form.register("phone")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="reg-password" label="Password" required error={errors.password?.message} hint="8+ characters with a letter and a number">
          <PasswordInput autoComplete="new-password" {...form.register("password")} />
        </Field>
        <Field id="reg-confirm" label="Confirm password" required error={errors.confirmPassword?.message}>
          <PasswordInput autoComplete="new-password" {...form.register("confirmPassword")} />
        </Field>
      </div>
      <Button type="submit" size="lg" loading={action.pending}>
        Create account
      </Button>
      <p className="text-xs text-muted-foreground">
        By creating an account you agree to our{" "}
        <Link href="/legal/terms" className="underline underline-offset-2">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const form = useForm<z.input<typeof forgotPasswordSchema>, unknown, z.output<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const action = useFormAction(form, forgotPasswordAction, { successToast: false });
  if (action.result?.ok) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center" role="status">
        <CheckCircle2 className="mx-auto size-10 text-emerald-400" aria-hidden />
        <p className="mt-3 text-sm text-foreground/80">{action.result.message}</p>
      </div>
    );
  }
  return (
    <form method="post" onSubmit={form.handleSubmit(action.run)} noValidate className="grid gap-5">
      {action.result && !action.result.ok && <FormMessage type="error">{action.result.error}</FormMessage>}
      <Field id="forgot-email" label="Email" required error={form.formState.errors.email?.message}>
        <Input type="email" autoComplete="email" inputMode="email" autoFocus {...form.register("email")} />
      </Field>
      <Button type="submit" size="lg" loading={action.pending}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const form = useForm<z.input<typeof resetPasswordSchema>, unknown, z.output<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });
  const action = useFormAction(form, resetPasswordAction, { successToast: false });
  if (action.result?.ok) {
    return (
      <div className="grid gap-4 text-center" role="status">
        <CheckCircle2 className="mx-auto size-10 text-emerald-400" aria-hidden />
        <p className="text-sm text-foreground/80">{action.result.message}</p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }
  const errors = form.formState.errors;
  return (
    <form method="post" onSubmit={form.handleSubmit(action.run)} noValidate className="grid gap-5">
      {action.result && !action.result.ok && <FormMessage type="error">{action.result.error}</FormMessage>}
      <Field id="reset-password" label="New password" required error={errors.password?.message} hint="8+ characters with a letter and a number">
        <PasswordInput autoComplete="new-password" autoFocus {...form.register("password")} />
      </Field>
      <Field id="reset-confirm" label="Confirm new password" required error={errors.confirmPassword?.message}>
        <PasswordInput autoComplete="new-password" {...form.register("confirmPassword")} />
      </Field>
      <Button type="submit" size="lg" loading={action.pending}>
        Update password
      </Button>
    </form>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-field";
import { Input, NativeSelect, Switch } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";
import { changePasswordSchema, profileSchema } from "@/lib/validation/public";
import { changePasswordAction, updateProfileAction } from "@/server/customers/actions";

type ProfileValues = z.input<typeof profileSchema>;

export function ProfileForm({ defaults, email }: { defaults: ProfileValues; email: string }) {
  const form = useForm<ProfileValues, unknown, z.output<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: defaults });
  const action = useFormAction(form, updateProfileAction);
  const errors = form.formState.errors;
  return (
    <form method="post" onSubmit={form.handleSubmit(action.run)} noValidate className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="p-name" label="Full name" required error={errors.name?.message}>
          <Input autoComplete="name" {...form.register("name")} />
        </Field>
        <Field id="p-email" label="Email" hint="Contact us to change your sign-in email">
          <Input value={email} disabled readOnly />
        </Field>
        <Field id="p-phone" label="Mobile phone" error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" {...form.register("phone")} />
        </Field>
        <Field id="p-pref" label="Preferred contact" error={errors.preferredContact?.message}>
          <NativeSelect {...form.register("preferredContact", { setValueAs: (v) => (v ? v : null) })}>
            <option value="">No preference</option>
            <option value="email">Email</option>
            <option value="phone">Phone call</option>
            <option value="sms">Text message</option>
          </NativeSelect>
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="p-a1" label="Address" error={errors.addressLine1?.message}>
          <Input autoComplete="address-line1" {...form.register("addressLine1")} />
        </Field>
        <Field id="p-a2" label="Address line 2" error={errors.addressLine2?.message}>
          <Input autoComplete="address-line2" {...form.register("addressLine2")} />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field id="p-city" label="City" error={errors.city?.message}>
          <Input autoComplete="address-level2" {...form.register("city")} />
        </Field>
        <Field id="p-state" label="State" error={errors.state?.message}>
          <Input autoComplete="address-level1" {...form.register("state")} />
        </Field>
        <Field id="p-zip" label="ZIP" error={errors.postalCode?.message}>
          <Input autoComplete="postal-code" {...form.register("postalCode")} />
        </Field>
      </div>
      <fieldset className="grid gap-3 rounded-2xl border border-white/[0.07] p-5">
        <legend className="px-1 text-sm font-semibold">Notifications</legend>
        {(
          [
            ["emailNotifications", "Email updates", "Confirmations, reminders and receipts"],
            ["smsOptIn", "Text message reminders", "Appointment confirmations and reminders by SMS"],
            ["marketingOptIn", "Offers & promotions", "Occasional seasonal deals — no spam"],
          ] as const
        ).map(([name, label, hint]) => (
          <label key={name} className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
            <Switch {...form.register(name)} />
          </label>
        ))}
      </fieldset>
      <Button type="submit" loading={action.pending} className="justify-self-start">
        Save profile
      </Button>
    </form>
  );
}

type PasswordValues = z.input<typeof changePasswordSchema>;

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const form = useForm<PasswordValues, unknown, z.output<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const action = useFormAction(form, changePasswordAction, { onSuccess: () => form.reset() });
  const errors = form.formState.errors;
  return (
    <form method="post" onSubmit={form.handleSubmit(action.run)} noValidate className="grid gap-5">
      {hasPassword && (
        <Field id="pw-current" label="Current password" required error={errors.currentPassword?.message}>
          <Input type="password" autoComplete="current-password" {...form.register("currentPassword")} />
        </Field>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="pw-new" label="New password" required error={errors.newPassword?.message} hint="8+ characters with a letter and a number">
          <Input type="password" autoComplete="new-password" {...form.register("newPassword")} />
        </Field>
        <Field id="pw-confirm" label="Confirm new password" required error={errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
        </Field>
      </div>
      <Button type="submit" variant="outline" loading={action.pending} className="justify-self-start">
        {hasPassword ? "Change password" : "Set password"}
      </Button>
    </form>
  );
}

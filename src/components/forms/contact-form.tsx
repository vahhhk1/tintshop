"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/form-field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";
import { track } from "@/lib/analytics";
import { contactSchema } from "@/lib/validation/public";
import { submitContactAction } from "@/server/public-actions";

type Values = z.input<typeof contactSchema>;

export function ContactForm({ services }: { services: string[] }) {
  const form = useForm<Values, unknown, z.output<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", vehicle: "", serviceInterest: "", message: "", company: "" },
  });
  const { register, handleSubmit, formState } = form;
  const errors = formState.errors;
  const action = useFormAction(form, submitContactAction, {
    successToast: false,
    onSuccess: () => {
      track("contact_submitted");
      form.reset();
    },
  });

  if (action.result?.ok) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-14 text-center" role="status">
        <CheckCircle2 className="size-12 text-emerald-400" aria-hidden />
        <h3 className="mt-4 text-xl font-semibold">Message sent</h3>
        <p className="mt-2 max-w-sm text-muted-foreground">{action.result.message}</p>
        <Button variant="outline" className="mt-6" onClick={action.reset}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit(action.run)} noValidate className="grid gap-5">
      {action.result && !action.result.ok && <FormMessage type="error">{action.result.error}</FormMessage>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="contact-name" label="Name" required error={errors.name?.message}>
          <Input autoComplete="name" {...register("name")} />
        </Field>
        <Field id="contact-email" label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...register("email")} />
        </Field>
        <Field id="contact-phone" label="Phone" error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" inputMode="tel" {...register("phone")} />
        </Field>
        <Field id="contact-vehicle" label="Vehicle" hint="Year, make and model" error={errors.vehicle?.message}>
          <Input placeholder="2023 Tesla Model Y" {...register("vehicle")} />
        </Field>
      </div>
      <Field id="contact-service" label="Service interested in" error={errors.serviceInterest?.message}>
        <NativeSelect {...register("serviceInterest")}>
          <option value="">Not sure yet</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id="contact-message" label="Message" required error={errors.message?.message}>
        <Textarea rows={5} placeholder="Tell us about your vehicle and what you’re looking for…" {...register("message")} />
      </Field>
      {/* Honeypot: hidden from people, tempting for bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input tabIndex={-1} autoComplete="off" {...register("company")} />
        </label>
      </div>
      <Button type="submit" size="lg" loading={action.pending} className="justify-self-start">
        {!action.pending && <Send aria-hidden />} Send message
      </Button>
      <p className="text-xs text-muted-foreground">
        <span className="text-primary">*</span> Required. We reply within one business day.
      </p>
    </form>
  );
}

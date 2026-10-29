"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CheckCircle2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Label } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { useFormAction } from "@/hooks/use-form-action";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { reviewSchema } from "@/lib/validation/public";
import { submitReviewAction } from "@/server/public-actions";

type Values = z.input<typeof reviewSchema>;

export function ReviewForm({
  defaults,
  appointmentId,
  token,
}: {
  defaults?: { name?: string | null; email?: string | null; vehicle?: string | null };
  appointmentId?: string | null;
  token?: string | null;
}) {
  const form = useForm<Values, unknown, z.output<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      name: defaults?.name ?? "",
      email: defaults?.email ?? "",
      vehicle: defaults?.vehicle ?? "",
      rating: 0,
      title: "",
      body: "",
      appointmentId: appointmentId ?? null,
      company: "",
    },
  });
  const { register, handleSubmit, formState, setValue, control } = form;
  const errors = formState.errors;
  const rating = Number(useWatch({ control, name: "rating" }) ?? 0);
  const [hover, setHover] = React.useState(0);
  const action = useFormAction(form, submitReviewAction, { successToast: false, onSuccess: () => track("review_submitted", { rating }) });

  if (action.result?.ok) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-14 text-center" role="status">
        <CheckCircle2 className="size-12 text-emerald-400" aria-hidden />
        <h3 className="mt-4 text-xl font-semibold">Thank you!</h3>
        <p className="mt-2 max-w-sm text-muted-foreground">{action.result.message}</p>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit((v) => action.run({ ...v, token }))} noValidate className="grid gap-5">
      {action.result && !action.result.ok && <FormMessage type="error">{action.result.error}</FormMessage>}
      <fieldset>
        <legend className="mb-2">
          <Label>
            Your rating<span className="ml-0.5 text-primary" aria-hidden>*</span>
          </Label>
        </legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onMouseEnter={() => setHover(n)}
              onClick={() => setValue("rating", n, { shouldValidate: true })}
              className="rounded-lg p-1 transition-transform hover:scale-110"
            >
              <Star className={cn("size-8", n <= (hover || rating) ? "fill-primary text-primary" : "text-white/20")} />
            </button>
          ))}
        </div>
        {errors.rating && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-red-400">
            Please choose a rating
          </p>
        )}
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="review-name" label="Name" required error={errors.name?.message} hint="Shown publicly — first name and initial is fine">
          <Input autoComplete="name" {...register("name")} />
        </Field>
        <Field id="review-vehicle" label="Vehicle" error={errors.vehicle?.message}>
          <Input placeholder="2022 Ford Mustang" {...register("vehicle")} />
        </Field>
      </div>
      <Field id="review-email" label="Email" error={errors.email?.message} hint="Optional, never shown publicly">
        <Input type="email" autoComplete="email" {...register("email")} />
      </Field>
      <Field id="review-title" label="Headline" error={errors.title?.message}>
        <Input placeholder="Sum it up in a few words" {...register("title")} />
      </Field>
      <Field id="review-body" label="Your review" required error={errors.body?.message}>
        <Textarea rows={5} placeholder="How was your experience and how does the tint look?" {...register("body")} />
      </Field>
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input tabIndex={-1} autoComplete="off" {...register("company")} />
      </div>
      <Button type="submit" size="lg" loading={action.pending} className="justify-self-start">
        Submit review
      </Button>
      <p className="text-xs text-muted-foreground">Reviews are checked by our team before they appear.</p>
    </form>
  );
}

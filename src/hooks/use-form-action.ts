"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/validation/common";

type ErrorSink = { setError: (name: never, error: { message: string }) => void } | null;

/**
 * Runs a server action from a submit handler: tracks pending state, maps
 * server-side field errors back onto a react-hook-form instance and shows toasts.
 */
export function useFormAction<TData = undefined>(
  form: ErrorSink,
  action: (input: never) => Promise<ActionResult<TData>>,
  opts: { onSuccess?: (result: { message?: string; data?: TData }) => void; onError?: (error: string) => void; successToast?: boolean } = {},
) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<TData> | null>(null);

  function run(values: unknown) {
    startTransition(async () => {
      try {
        const res = await (action as (input: unknown) => Promise<ActionResult<TData>>)(values);
        setResult(res);
        if (res.ok) {
          if (opts.successToast !== false && res.message) toast.success(res.message);
          opts.onSuccess?.(res);
        } else {
          if (res.fieldErrors && form) {
            const setError = form.setError as (name: string, error: { message: string }) => void;
            for (const [key, messages] of Object.entries(res.fieldErrors)) {
              if (messages?.[0] && key !== "_form") setError(key, { message: messages[0] });
            }
          }
          toast.error(res.error);
          opts.onError?.(res.error);
        }
      } catch (error) {
        console.error(error);
        const res = { ok: false as const, error: "Something went wrong. Please try again." };
        setResult(res);
        toast.error(res.error);
      }
    });
  }

  return { run, pending, result, reset: () => setResult(null) };
}

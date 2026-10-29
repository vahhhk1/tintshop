"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm";
import { Field } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/validation/common";

type AnyResult = ActionResult<unknown>;
type FormAction = (input: FormData) => Promise<AnyResult>;

const Ctx = React.createContext<{ result: AnyResult | null; pending: boolean }>({ result: null, pending: false });

/**
 * Admin form that submits FormData to a server action without React's automatic
 * form reset (so input survives validation errors), shows toasts and exposes
 * field errors to <AdminField>.
 */
export function ActionForm({
  action,
  children,
  className,
  onSuccess,
  successMessage,
  refresh = true,
  resetOnSuccess,
  successRedirect,
  id,
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  onSuccess?: (result: AnyResult & { ok: true }) => void;
  successMessage?: string;
  refresh?: boolean;
  resetOnSuccess?: boolean;
  /** Navigate after success; ":id" is replaced with result.data.id. */
  successRedirect?: string;
  id?: string;
}) {
  const router = useRouter();
  const [result, setResult] = React.useState<AnyResult | null>(null);
  const [pending, start] = React.useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form, (e.nativeEvent as SubmitEvent).submitter);
    start(async () => {
      try {
        const res = await action(data);
        if (!res) return;
        setResult(res);
        if (res.ok) {
          toast.success(res.message ?? successMessage ?? "Saved");
          if (resetOnSuccess) form.reset();
          onSuccess?.(res);
          const newId = (res.data as { id?: string } | undefined)?.id;
          if (successRedirect) router.push(successRedirect.replace(":id", newId ?? ""));
          else if (refresh) router.refresh();
        } else {
          toast.error(res.error);
        }
      } catch (error) {
        console.error(error);
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Ctx.Provider value={{ result, pending }}>
      <form id={id} onSubmit={onSubmit} noValidate className={cn("grid gap-5", className)}>
        {children}
      </form>
    </Ctx.Provider>
  );
}

export function useActionFormState() {
  return React.useContext(Ctx);
}

/** Field wired to the surrounding ActionForm's server-side errors (matched by `name`). */
export function AdminField({
  name,
  label,
  required,
  hint,
  className,
  children,
}: {
  name: string;
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactElement<{ id?: string }>;
}) {
  const { result } = React.useContext(Ctx);
  const error = result && !result.ok ? result.fieldErrors?.[name]?.[0] : undefined;
  return (
    <Field id={`f-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`} label={label} required={required} hint={hint} error={error} className={className}>
      {children}
    </Field>
  );
}

export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = React.useContext(Ctx);
  return (
    <Button type="submit" loading={pending} {...props}>
      {children}
    </Button>
  );
}

/**
 * Small inline button that runs a server action with fixed arguments (toggle, approve, delete…).
 * Pass the action and its arguments separately (`action={fn} args={[id]}`) rather than a
 * `.bind()`-bound action: many bound server references in one page can break RSC rendering.
 */
export function ActionButton({
  action: serverAction,
  args = [],
  children,
  successMessage,
  confirm,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- server actions with varying signatures
  action: (...args: any[]) => Promise<AnyResult>;
  args?: unknown[];
  successMessage?: string;
  confirm?: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const action = () => serverAction(...args);
  if (confirm) {
    return (
      <ConfirmButton
        {...props}
        title={confirm}
        description="This can’t be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          const res = await action();
          if (res.ok) {
            toast.success(res.message ?? successMessage ?? "Done");
            router.refresh();
          } else toast.error(res.error);
        }}
      >
        {children}
      </ConfirmButton>
    );
  }
  return (
    <Button
      {...props}
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await action();
          if (res.ok) {
            toast.success(res.message ?? successMessage ?? "Done");
            router.refresh();
          } else toast.error(res.error);
        })
      }
    >
      {children}
    </Button>
  );
}

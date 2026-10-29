import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-foreground/90 select-none", className)} {...props} />;
}

interface FieldProps {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string; required?: boolean }>;
}

/**
 * Label + control + hint/error, wired up for screen readers: the control gets
 * `id`, `aria-invalid` and `aria-describedby` automatically.
 *
 * When the control comes from a Server Component it can arrive as a lazy node
 * rather than an element; cloning that would produce an invalid element, so in
 * that case the control is wrapped by its <label> instead (implicit association).
 */
export function Field({ id, label, required, error, hint, className, children }: FieldProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  const labelText = (
    <>
      {label}
      {required && (
        <span className="ml-0.5 text-primary" aria-hidden>
          *
        </span>
      )}
      {required && <span className="sr-only"> (required)</span>}
    </>
  );
  const head = React.isValidElement(children) ? (
    <>
      <Label htmlFor={id}>{labelText}</Label>
      {React.cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
    </>
  ) : (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-foreground/90 select-none">{labelText}</span>
      {children}
    </label>
  );
  return (
    <div className={cn("grid gap-1.5", className)}>
      {head}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-xs font-medium text-red-400">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

export function FormMessage({ type, children }: { type: "error" | "success"; children: React.ReactNode }) {
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        type === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
      )}
    >
      {children}
    </div>
  );
}

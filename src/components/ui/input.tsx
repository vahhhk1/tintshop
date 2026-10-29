import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full min-w-0 rounded-xl border border-input bg-white/[0.03] px-3.5 text-[15px] text-foreground shadow-xs transition-[border-color,box-shadow,background-color] outline-none placeholder:text-muted-foreground/70 hover:border-white/20 focus-visible:border-primary/70 focus-visible:bg-white/[0.05] focus-visible:ring-3 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive/70 aria-invalid:ring-destructive/20";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldBase, "h-11 py-2 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldBase, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

/** Native select: fully accessible, great on mobile, styled to match inputs. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(fieldBase, "h-11 appearance-none py-2 pr-10 [&>option]:bg-popover", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        fill="currentColor"
      >
        <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" />
      </svg>
    </div>
  );
}

function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-[18px] shrink-0 cursor-pointer appearance-none rounded-[5px] border border-white/25 bg-white/[0.03] transition-colors checked:border-primary checked:bg-primary checked:bg-[url(\"data:image/svg+xml,%3Csvg viewBox='0 0 16 16' fill='%231a1206' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z'/%3E%3C/svg%3E\")] bg-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

/** Accessible toggle switch backed by a native checkbox. */
function Switch({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      role="switch"
      className={cn(
        "relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-white/15 transition-colors before:absolute before:top-0.5 before:left-0.5 before:size-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-primary checked:before:translate-x-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input, Textarea, NativeSelect, Checkbox, Switch, fieldBase };

"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border-white/10 !bg-popover !text-foreground !shadow-2xl",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}

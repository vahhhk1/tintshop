"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarkReadButton({ action, label = "Mark all as read" }: { action: () => Promise<unknown>; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          await action();
          router.refresh();
        })
      }
    >
      {!pending && <CheckCheck aria-hidden />} {label}
    </Button>
  );
}

"use client";

import { useTransition } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { completeDemoPaymentAction } from "@/server/payments/actions";

export function DemoPayButton({ paymentId, token, label }: { paymentId: string; token: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="xl"
      className="w-full"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await completeDemoPaymentAction({ paymentId, token });
          if (res.ok && res.data) window.location.assign(res.data.url);
          else toast.error(res.ok ? "Payment failed" : res.error);
        })
      }
    >
      {!pending && <Lock aria-hidden />} {label}
    </Button>
  );
}

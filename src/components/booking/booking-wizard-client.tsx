"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/misc";

/**
 * Client-only booking wizard, used when continuing from the quote tool so the
 * saved selection (sessionStorage) can initialise state without a hydration mismatch.
 */
export const BookingWizardClientOnly = dynamic(() => import("./booking-wizard").then((m) => m.BookingWizard), {
  ssr: false,
  loading: () => <Skeleton className="h-[540px] rounded-3xl" />,
});

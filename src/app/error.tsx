"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div className="max-w-md">
        <AlertTriangle className="mx-auto size-12 text-primary" aria-hidden />
        <h1 className="mt-6 text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-muted-foreground">An unexpected error occurred. Please try again — if it keeps happening, give us a call.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

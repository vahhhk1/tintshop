import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { telHref } from "@/lib/utils";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "You’re offline", robots: { index: false } };

export default async function OfflinePage() {
  const settings = await getSettings().catch(() => null);
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <WifiOff className="mx-auto size-12 text-primary" aria-hidden />
        <h1 className="mt-6 text-3xl font-semibold">You’re offline</h1>
        <p className="mt-3 text-muted-foreground">
          This page isn’t available without a connection. Previously visited pages like services, pricing and contact still work offline.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/">Go to homepage</Link>
          </Button>
          {settings && (
            <Button asChild variant="outline">
              <a href={telHref(settings.phone)}>Call {settings.phone}</a>
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

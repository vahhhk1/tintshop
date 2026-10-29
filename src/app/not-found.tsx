import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="eyebrow">404</p>
        <h1 className="mt-4 text-4xl font-semibold">This page took a wrong turn.</h1>
        <p className="mt-3 text-muted-foreground">The page you’re looking for doesn’t exist or the link has expired.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/book">Book an appointment</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/brand";
import { getSettings } from "@/server/settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo name={settings.businessName} logoUrl={settings.logoUrl} />
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Back to site
          </Link>
        </div>
        <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          {children}
        </main>
      </div>
      <div className="relative hidden lg:block">
        <Image src="/images/demo/sport-porsche-911.jpg" alt="" fill preload sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" aria-hidden />
        <blockquote className="absolute right-10 bottom-10 left-10 max-w-md">
          <p className="text-2xl leading-snug font-medium">“Booking took two minutes and the install was flawless. The car feels like a different vehicle in the summer.”</p>
          <footer className="mt-4 text-sm text-foreground/70">— Verified customer</footer>
        </blockquote>
      </div>
    </div>
  );
}

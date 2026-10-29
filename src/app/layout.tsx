import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@/components/analytics/analytics";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { getSettings } from "@/server/settings";
import { absoluteUrl } from "@/lib/utils";
import "./globals.css";

const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-display-face", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description =
    settings.heroSubheadline ??
    "Professional automotive window tinting with premium ceramic, carbon and dyed films, expert installation and a written warranty.";
  return {
    metadataBase: new URL(absoluteUrl("/")),
    title: { default: `${settings.businessName} — ${settings.tagline ?? "Premium Window Tint"}`, template: `%s | ${settings.businessName}` },
    description,
    applicationName: settings.businessName,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: settings.businessName,
      locale: "en_US",
      url: "/",
      title: settings.businessName,
      description,
    },
    twitter: { card: "summary_large_image", title: settings.businessName, description },
    appleWebApp: { capable: true, title: settings.businessName, statusBarStyle: "black-translucent" },
    formatDetection: { telephone: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${body.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        {/* Enables scroll-reveal styles only when JS can reveal the content again. */}
        <script dangerouslySetInnerHTML={{ __html: "if('IntersectionObserver' in window)document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-dvh font-sans">
        {children}
        <Toaster />
        <Analytics />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

"use client";

import { Suspense, useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";

const GA_ID = process.env.NEXT_PUBLIC_ANALYTICS_ID;

function PageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const last = useRef<string | null>(null);

  useEffect(() => {
    const qs = searchParams?.toString();
    const path = qs ? `${pathname}?${qs}` : pathname;
    if (last.current === path) return;
    last.current = path;
    // Admin pages are not tracked.
    if (pathname.startsWith("/admin")) return;
    track("page_view", { page_path: path, page_title: document.title, page_location: window.location.href });
  }, [pathname, searchParams]);

  return null;
}

/** Loads GA4 when NEXT_PUBLIC_ANALYTICS_ID is set and reports SPA page views. */
export function Analytics() {
  return (
    <>
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(GA_ID)},{send_page_view:false});`}
          </Script>
        </>
      )}
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
    </>
  );
}

/** Fires a single analytics event when mounted (e.g. on confirmation pages). */
export function TrackOnMount({ event, params }: { event: Parameters<typeof track>[0]; params?: Parameters<typeof track>[1] }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, params);
  }, [event, params]);
  return null;
}

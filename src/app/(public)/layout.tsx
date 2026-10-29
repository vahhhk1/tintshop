import { FloatingCallButton, MobileBookBar, SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { JsonLd, localBusinessSchema } from "@/components/seo/json-ld";
import { getApprovedReviews, getServices } from "@/server/catalog";
import { getBusinessHours, getSettings } from "@/server/settings";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [settings, hours, services, reviews] = await Promise.all([getSettings(), getBusinessHours(), getServices(), getApprovedReviews()]);
  return (
    <>
      <SiteHeader businessName={settings.businessName} logoUrl={settings.logoUrl} phone={settings.phone} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter settings={settings} hours={hours} services={services} />
      <MobileBookBar />
      <FloatingCallButton phone={settings.phone} />
      <JsonLd data={localBusinessSchema(settings, hours, { average: reviews.average, count: reviews.count })} />
    </>
  );
}

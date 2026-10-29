import Link from "next/link";
import { Lock } from "lucide-react";
import { ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { ImageUpload } from "@/components/admin/image-upload";
import { PageHeader } from "@/components/dashboard/shell";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { env } from "@/lib/env";
import { getPaymentMode } from "@/lib/stripe";
import { centsToDollarsInput, cn } from "@/lib/utils";
import { savePaymentSettingsAction, saveBusinessSettingsAction, saveLegalPageAction } from "@/server/admin/business";
import { LEGAL_SLUGS } from "@/server/catalog";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Settings" };

function Panel({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab = "business" }, user, settings] = await Promise.all([searchParams, requirePermission("settings:business", "/admin/settings"), getSettings()]);
  const critical = can(user.role, "settings:critical");
  const legal = critical ? await prisma.legalPage.findMany() : [];
  const tabs = [
    ["business", "Business"],
    ["payments", "Payments & policies"],
    ["legal", "Legal pages"],
    ["integrations", "Integrations"],
  ] as const;

  return (
    <>
      <PageHeader title="Settings" description="Everything here updates the website immediately — no code changes needed." />
      <div className="scrollbar-none mb-6 flex gap-2 overflow-x-auto">
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            href={`/admin/settings?tab=${id}`}
            className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm", tab === id ? "border-primary bg-primary text-primary-foreground" : "border-white/10 text-foreground/70 hover:text-foreground")}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "business" && (
        <ActionForm action={saveBusinessSettingsAction} className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="grid content-start gap-6">
            <Panel title="Business details">
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminField name="businessName" label="Business name" required>
                  <Input name="businessName" defaultValue={settings.businessName} />
                </AdminField>
                <AdminField name="tagline" label="Tagline">
                  <Input name="tagline" defaultValue={settings.tagline ?? ""} />
                </AdminField>
                <AdminField name="phone" label="Phone" required>
                  <Input name="phone" defaultValue={settings.phone} />
                </AdminField>
                <AdminField name="email" label="Email" required>
                  <Input name="email" type="email" defaultValue={settings.email} />
                </AdminField>
                <AdminField name="addressLine1" label="Address" required>
                  <Input name="addressLine1" defaultValue={settings.addressLine1} />
                </AdminField>
                <AdminField name="addressLine2" label="Address line 2">
                  <Input name="addressLine2" defaultValue={settings.addressLine2 ?? ""} />
                </AdminField>
                <AdminField name="city" label="City" required>
                  <Input name="city" defaultValue={settings.city} />
                </AdminField>
                <div className="grid grid-cols-3 gap-3">
                  <AdminField name="state" label="State" required>
                    <Input name="state" defaultValue={settings.state} />
                  </AdminField>
                  <AdminField name="postalCode" label="ZIP" required>
                    <Input name="postalCode" defaultValue={settings.postalCode} />
                  </AdminField>
                  <AdminField name="country" label="Country" required>
                    <Input name="country" defaultValue={settings.country} maxLength={2} />
                  </AdminField>
                </div>
                <AdminField name="timezone" label="Time zone" required hint="IANA name, e.g. America/Los_Angeles">
                  <Input name="timezone" defaultValue={settings.timezone} />
                </AdminField>
                <div className="grid grid-cols-2 gap-3">
                  <AdminField name="latitude" label="Latitude">
                    <Input name="latitude" defaultValue={settings.latitude ?? ""} />
                  </AdminField>
                  <AdminField name="longitude" label="Longitude">
                    <Input name="longitude" defaultValue={settings.longitude ?? ""} />
                  </AdminField>
                </div>
              </div>
            </Panel>
            <Panel title="Maps & social">
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminField name="googleMapsUrl" label="Google Maps link">
                  <Input name="googleMapsUrl" defaultValue={settings.googleMapsUrl ?? ""} placeholder="https://maps.app.goo.gl/…" />
                </AdminField>
                <AdminField name="googleMapsEmbedUrl" label="Google Maps embed URL" hint="Maps → Share → Embed → copy the src URL">
                  <Input name="googleMapsEmbedUrl" defaultValue={settings.googleMapsEmbedUrl ?? ""} />
                </AdminField>
                {(["instagramUrl", "facebookUrl", "tiktokUrl", "youtubeUrl", "googleReviewsUrl"] as const).map((k) => (
                  <AdminField key={k} name={k} label={k.replace("Url", "").replace(/^\w/, (c) => c.toUpperCase()).replace("googleReviews", "Google reviews")}>
                    <Input name={k} defaultValue={settings[k] ?? ""} placeholder="https://" />
                  </AdminField>
                ))}
              </div>
            </Panel>
          </div>
          <div className="grid content-start gap-6">
            <Panel title="Logo">
              <ImageUpload name="logoUrl" defaultValue={settings.logoUrl} folder="branding" label="Logo (square works best)" aspect="aspect-square max-w-[200px]" />
            </Panel>
            <Panel title="Homepage">
              <div className="grid gap-4">
                <AdminField name="heroHeadline" label="Hero headline">
                  <Input name="heroHeadline" defaultValue={settings.heroHeadline ?? ""} />
                </AdminField>
                <AdminField name="heroSubheadline" label="Hero subheadline">
                  <Textarea name="heroSubheadline" rows={3} defaultValue={settings.heroSubheadline ?? ""} />
                </AdminField>
                <div className="grid grid-cols-2 gap-3">
                  <AdminField name="yearsInBusiness" label="Years in business">
                    <Input name="yearsInBusiness" inputMode="numeric" defaultValue={settings.yearsInBusiness ?? ""} />
                  </AdminField>
                  <AdminField name="vehiclesCompleted" label="Vehicles completed">
                    <Input name="vehiclesCompleted" inputMode="numeric" defaultValue={settings.vehiclesCompleted ?? ""} />
                  </AdminField>
                </div>
              </div>
            </Panel>
            <SubmitButton size="lg">Save business settings</SubmitButton>
          </div>
        </ActionForm>
      )}

      {tab === "payments" &&
        (critical ? (
          <ActionForm action={savePaymentSettingsAction} className="grid gap-6 xl:grid-cols-2">
            <Panel title="Tax & deposits">
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminField name="taxRatePercent" label="Sales tax (%)">
                  <Input name="taxRatePercent" inputMode="decimal" defaultValue={(settings.taxRateBps / 100).toFixed(2)} />
                </AdminField>
                <AdminField name="currency" label="Currency">
                  <Input name="currency" defaultValue={settings.currency} maxLength={3} />
                </AdminField>
                <AdminField name="depositPercent" label="Deposit (% of total)">
                  <Input name="depositPercent" inputMode="numeric" defaultValue={settings.depositPercent} />
                </AdminField>
                <AdminField name="depositMinimum" label="Minimum deposit ($)">
                  <Input name="depositMinimum" inputMode="decimal" defaultValue={centsToDollarsInput(settings.depositMinimum)} />
                </AdminField>
              </div>
              <div className="mt-4 grid gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox name="requireDeposit" defaultChecked={settings.requireDeposit} /> Require a deposit to book online
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox name="allowPayInFull" defaultChecked={settings.allowPayInFull} /> Allow paying in full online
                </label>
              </div>
            </Panel>
            <Panel title="Policies" description="Shown at booking, checkout and in emails.">
              <div className="grid gap-4">
                <AdminField name="cancellationPolicy" label="Cancellation policy" required>
                  <Textarea name="cancellationPolicy" rows={5} defaultValue={settings.cancellationPolicy} />
                </AdminField>
                <AdminField name="warrantyInfo" label="Warranty information" required>
                  <Textarea name="warrantyInfo" rows={5} defaultValue={settings.warrantyInfo} />
                </AdminField>
              </div>
            </Panel>
            <SubmitButton size="lg" className="justify-self-start">
              Save payment settings
            </SubmitButton>
          </ActionForm>
        ) : (
          <SuperAdminOnly />
        ))}

      {tab === "legal" &&
        (critical ? (
          <div className="grid gap-6">
            {LEGAL_SLUGS.map((l) => {
              const page = legal.find((p) => p.slug === l.slug);
              return (
                <Panel key={l.slug} title={l.title} description={<Link href={`/legal/${l.slug}`} className="text-primary hover:underline">View page</Link>}>
                  <ActionForm action={saveLegalPageAction}>
                    <input type="hidden" name="slug" value={l.slug} />
                    <AdminField name="title" label="Title" required>
                      <Input name="title" defaultValue={page?.title ?? l.title} />
                    </AdminField>
                    <AdminField name="content" label="Content" required hint="Use “## ” for headings and “- ” for bullet points">
                      <Textarea name="content" rows={10} defaultValue={page?.content ?? ""} className="font-mono text-sm" />
                    </AdminField>
                    <SubmitButton size="sm" className="justify-self-start">
                      Publish
                    </SubmitButton>
                  </ActionForm>
                </Panel>
              );
            })}
          </div>
        ) : (
          <SuperAdminOnly />
        ))}

      {tab === "integrations" && (
        <Panel title="Integrations" description="Configured with environment variables (see README). Secrets are never shown here.">
          <ul className="grid gap-3 text-sm">
            {[
              ["Payments", getPaymentMode() === "stripe" ? "Stripe (live keys detected)" : getPaymentMode() === "demo" ? "Demo checkout (development only)" : "Offline — pay at shop", getPaymentMode() === "stripe"],
              ["Stripe webhook", env.stripe.webhookSecret ? "Signing secret set" : "Not configured", Boolean(env.stripe.webhookSecret)],
              ["Email (Resend)", env.email.enabled ? `Sending as ${env.email.from}` : "Not configured — emails are logged only", env.email.enabled],
              ["SMS (Twilio)", env.sms.provider ? `Provider: ${env.sms.provider}` : "Disabled", Boolean(env.sms.provider)],
              ["Image storage", env.storage.provider, env.storage.provider !== "local"],
              ["Google sign-in", env.google.enabled ? "Enabled" : "Disabled", env.google.enabled],
              ["Analytics", process.env.NEXT_PUBLIC_ANALYTICS_ID ? `GA4 ${process.env.NEXT_PUBLIC_ANALYTICS_ID}` : "Not configured", Boolean(process.env.NEXT_PUBLIC_ANALYTICS_ID)],
              ["Cron secret", env.cronSecret ? "Set" : "Not set", Boolean(env.cronSecret)],
            ].map(([label, value, ok]) => (
              <li key={String(label)} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] px-4 py-3">
                <span className="font-medium">{label}</span>
                <span className={ok ? "text-emerald-400" : "text-muted-foreground"}>{value}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

function SuperAdminOnly() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-card p-6 text-sm text-muted-foreground">
      <Lock className="size-5" aria-hidden /> Only a super admin can change tax, deposit, policy and legal settings.
    </div>
  );
}

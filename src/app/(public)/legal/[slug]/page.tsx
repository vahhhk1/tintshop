import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/layout/page-hero";
import { SimpleMarkdown } from "@/components/ui/simple-markdown";
import { pageMetadata } from "@/lib/seo";
import { formatLongDate } from "@/lib/time";
import { LEGAL_SLUGS, getLegalPage } from "@/server/catalog";
import { getSettings } from "@/server/settings";

export const revalidate = 3600;

export function generateStaticParams() {
  return LEGAL_SLUGS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const meta = LEGAL_SLUGS.find((l) => l.slug === slug);
  if (!meta) return { title: "Not found" };
  return pageMetadata({ title: meta.title, description: `${meta.title} for our automotive tint services.`, path: `/legal/${slug}` });
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = LEGAL_SLUGS.find((l) => l.slug === slug);
  if (!meta) notFound();
  const [page, settings] = await Promise.all([getLegalPage(slug), getSettings()]);

  // Policies stored in settings act as a fallback before legal pages are written.
  const fallback = slug === "cancellation" ? settings.cancellationPolicy : slug === "warranty" ? settings.warrantyInfo : null;
  const content = page?.content ?? fallback;

  return (
    <>
      <PageHero
        eyebrow="Legal"
        title={page?.title ?? meta.title}
        description={page ? `Last updated ${formatLongDate(page.updatedAt, settings.timezone)}` : undefined}
        crumbs={[{ name: meta.title, path: `/legal/${slug}` }]}
      />
      <div className="container-page grid gap-12 py-16 lg:grid-cols-[1fr_3fr]">
        <nav aria-label="Legal pages">
          <ul className="grid gap-1 text-sm lg:sticky lg:top-28">
            {LEGAL_SLUGS.map((l) => (
              <li key={l.slug}>
                <Link
                  href={`/legal/${l.slug}`}
                  aria-current={l.slug === slug ? "page" : undefined}
                  className="block rounded-lg px-3 py-2 text-foreground/70 hover:bg-white/[0.04] hover:text-foreground aria-[current=page]:bg-white/[0.06] aria-[current=page]:text-foreground"
                >
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="max-w-3xl">
          {content ? <SimpleMarkdown content={content} /> : <p className="text-muted-foreground">This policy is being updated. Please contact us with any questions.</p>}
        </article>
      </div>
    </>
  );
}

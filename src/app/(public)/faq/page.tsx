import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { PageHero } from "@/components/layout/page-hero";
import { FaqAccordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { JsonLd, faqSchema } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo";
import { telHref } from "@/lib/utils";
import { getGeneralFaqs } from "@/server/catalog";
import { getSettings } from "@/server/settings";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Frequently Asked Questions",
  description: "How long tint takes, when you can roll windows down, choosing a tint percentage, ceramic tint, UV and heat, warranties, tint laws and more.",
  path: "/faq",
});

export default async function FaqPage() {
  const [faqs, settings, serviceFaqs] = await Promise.all([
    getGeneralFaqs(),
    getSettings(),
    prisma.service.findMany({
      where: { active: true, faqs: { some: { active: true } } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true, faqs: { where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, question: true, answer: true } } },
    }),
  ]);
  return (
    <>
      <PageHero eyebrow="FAQ" title="Questions, answered." description="Can’t find what you’re looking for? Call or message us — we’re happy to help." crumbs={[{ name: "FAQ", path: "/faq" }]}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/contact">Ask a question</Link>
          </Button>
          <Button asChild variant="outline">
            <a href={telHref(settings.phone)}>Call {settings.phone}</a>
          </Button>
        </div>
      </PageHero>
      <div className="container-page grid gap-16 py-16 lg:grid-cols-[1fr_2.2fr]">
        <nav aria-label="FAQ topics" className="hidden lg:block">
          <ul className="sticky top-28 grid gap-1 text-sm">
            <li>
              <a href="#general" className="block rounded-lg px-3 py-2 text-foreground/80 hover:bg-white/[0.04] hover:text-foreground">
                General
              </a>
            </li>
            {serviceFaqs.map((s) => (
              <li key={s.id}>
                <a href={`#${s.slug}`} className="block rounded-lg px-3 py-2 text-foreground/80 hover:bg-white/[0.04] hover:text-foreground">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-14">
          <section id="general" className="scroll-mt-28" aria-labelledby="general-h">
            <h2 id="general-h" className="mb-6 text-2xl font-semibold">
              General
            </h2>
            {faqs.length ? <FaqAccordion items={faqs} /> : <EmptyState title="No FAQs yet" />}
          </section>
          {serviceFaqs.map((s) => (
            <section key={s.id} id={s.slug} className="scroll-mt-28" aria-labelledby={`${s.slug}-h`}>
              <h2 id={`${s.slug}-h`} className="mb-6 text-2xl font-semibold">
                <Link href={`/services/${s.slug}`} className="hover:text-primary">
                  {s.name}
                </Link>
              </h2>
              <FaqAccordion items={s.faqs} />
            </section>
          ))}
        </div>
      </div>
      <JsonLd data={faqSchema([...faqs, ...serviceFaqs.flatMap((s) => s.faqs)])} />
    </>
  );
}

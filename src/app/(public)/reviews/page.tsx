import { MessageSquareQuote, Star } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { ReviewCard } from "@/components/home/sections";
import { ReviewForm } from "@/components/forms/review-form";
import { EmptyState, Stars } from "@/components/ui/misc";
import { getSessionUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { getApprovedReviews } from "@/server/catalog";
import { getSettings } from "@/server/settings";

export const metadata = pageMetadata({
  title: "Customer Reviews",
  description: "Read verified reviews from drivers who trusted us with their window tint, PPF and ceramic coating — and share your own experience.",
  path: "/reviews",
});

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ appointment?: string; t?: string }> }) {
  const [{ appointment, t }, data, settings, user] = await Promise.all([searchParams, getApprovedReviews(), getSettings(), getSessionUser().catch(() => null)]);
  const distribution = [5, 4, 3, 2, 1].map((n) => ({ n, count: data.reviews.filter((r) => r.rating === n).length }));
  const max = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <>
      <PageHero
        eyebrow="Reviews"
        title="What our customers say."
        description="Every review comes from a real customer and is approved by our team before it’s published."
        crumbs={[{ name: "Reviews", path: "/reviews" }]}
      />
      <div className="container-page grid gap-12 py-16 lg:grid-cols-[1fr_2fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl border border-white/[0.07] bg-card p-6">
            {data.average ? (
              <>
                <p className="font-display text-6xl font-semibold">{data.average.toFixed(1)}</p>
                <Stars rating={data.average} size="md" className="mt-2" />
                <p className="mt-2 text-sm text-muted-foreground">Based on {data.count} reviews</p>
                <ul className="mt-6 grid gap-2" aria-label="Rating distribution">
                  {distribution.map((d) => (
                    <li key={d.n} className="flex items-center gap-3 text-sm">
                      <span className="flex w-8 items-center gap-1 tabular-nums">
                        {d.n} <Star className="size-3 fill-primary text-primary" aria-hidden />
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${(d.count / max) * 100}%` }} />
                      </span>
                      <span className="w-6 text-right text-muted-foreground tabular-nums">{d.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-muted-foreground">No reviews yet.</p>
            )}
            {settings.googleReviewsUrl && (
              <a href={settings.googleReviewsUrl} target="_blank" rel="noopener noreferrer" className="mt-6 block text-sm text-primary underline-offset-4 hover:underline">
                See us on Google →
              </a>
            )}
          </div>
        </aside>
        <div>
          {data.reviews.length ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {data.reviews.map((r) => (
                <li key={r.id}>
                  <ReviewCard review={r} timeZone={settings.timezone} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={MessageSquareQuote} title="No reviews yet" description="Be the first to share your experience below." />
          )}

          <section id="write" className="mt-16 scroll-mt-28 rounded-3xl border border-white/[0.08] bg-card p-6 sm:p-10" aria-labelledby="write-heading">
            <h2 id="write-heading" className="text-2xl font-semibold sm:text-3xl">
              Leave a Review
            </h2>
            <p className="mt-2 mb-8 text-muted-foreground">Tell other drivers about your experience — it means a lot to our small team.</p>
            <ReviewForm defaults={{ name: user?.name, email: user?.email }} appointmentId={appointment} token={t} />
          </section>
        </div>
      </div>
    </>
  );
}

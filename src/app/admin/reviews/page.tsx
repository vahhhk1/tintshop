import Link from "next/link";
import { Check, Pin, PinOff, Star, Trash2, X } from "lucide-react";
import { ActionButton, ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { PageHeader } from "@/components/dashboard/shell";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { EmptyState, Stars } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { deleteReviewAction, setReviewFeaturedAction, setReviewStatusAction, updateReviewAction } from "@/server/admin/content";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Reviews" };

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [sp] = await Promise.all([searchParams, requirePermission("reviews:manage", "/admin/reviews")]);
  const settings = await getSettings();
  const status = (["PENDING", "APPROVED", "REJECTED"] as const).find((s) => s === sp.status);
  const [reviews, counts] = await Promise.all([
    prisma.review.findMany({ where: status ? { status } : {}, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200, include: { appointment: { select: { id: true, reference: true } } } }),
    prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader title="Reviews" description="Only approved reviews appear on the website. Featured reviews show first." />
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          [undefined, "All", counts.reduce((s, c) => s + c._count._all, 0)],
          ["PENDING", "Pending", count("PENDING")],
          ["APPROVED", "Approved", count("APPROVED")],
          ["REJECTED", "Rejected", count("REJECTED")],
        ].map(([value, label, n]) => (
          <Link
            key={String(label)}
            href={value ? `/admin/reviews?status=${value}` : "/admin/reviews"}
            className={cn("rounded-full border px-4 py-1.5 text-sm", status === value ? "border-primary bg-primary text-primary-foreground" : "border-white/10 text-foreground/70")}
          >
            {label} <span className="ml-1 text-xs opacity-70">{n}</span>
          </Link>
        ))}
      </div>
      {reviews.length === 0 ? (
        <EmptyState icon={Star} title="No reviews here" />
      ) : (
        <ul className="grid gap-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-white/[0.07] bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={r.rating} />
                    <p className="font-semibold">{r.title ?? "Untitled"}</p>
                    <StatusBadge kind="review" status={r.status} />
                    {r.featured && <span className="text-xs text-primary">★ Featured</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r.name} {r.email ? `· ${r.email}` : ""} {r.vehicle ? `· ${r.vehicle}` : ""} · {formatDate(r.createdAt, settings.timezone)}
                    {r.appointment && (
                      <>
                        {" · "}
                        <Link href={`/admin/appointments/${r.appointment.id}`} className="text-primary hover:underline">
                          Verified booking {r.appointment.reference}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.status !== "APPROVED" && (
                    <ActionButton size="sm" variant="subtle" action={setReviewStatusAction} args={[r.id, "APPROVED"]}>
                      <Check aria-hidden /> Approve
                    </ActionButton>
                  )}
                  {r.status !== "REJECTED" && (
                    <ActionButton size="sm" variant="ghost" action={setReviewStatusAction} args={[r.id, "REJECTED"]}>
                      <X aria-hidden /> Reject
                    </ActionButton>
                  )}
                  <ActionButton size="sm" variant="ghost" action={setReviewFeaturedAction} args={[r.id, !r.featured]}>
                    {r.featured ? <PinOff aria-hidden /> : <Pin aria-hidden />} {r.featured ? "Unfeature" : "Feature"}
                  </ActionButton>
                  <ActionButton size="sm" variant="ghost" className="text-red-300" action={deleteReviewAction} args={[r.id]} confirm="Delete this review?">
                    <Trash2 aria-hidden /> Delete
                  </ActionButton>
                </div>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-foreground/85">{r.body}</p>
              {r.adminReply && <p className="mt-2 text-sm text-muted-foreground">Reply: {r.adminReply}</p>}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Edit / reply</summary>
                <ActionForm action={updateReviewAction} className="mt-3">
                  <input type="hidden" name="reviewId" value={r.id} />
                  <div className="grid gap-4 sm:grid-cols-[1fr_120px_1fr]">
                    <AdminField name="name" label="Name" required>
                      <Input name="name" defaultValue={r.name} />
                    </AdminField>
                    <AdminField name="rating" label="Rating">
                      <NativeSelect name="rating" defaultValue={r.rating}>
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </NativeSelect>
                    </AdminField>
                    <AdminField name="vehicle" label="Vehicle">
                      <Input name="vehicle" defaultValue={r.vehicle ?? ""} />
                    </AdminField>
                  </div>
                  <AdminField name="title" label="Title">
                    <Input name="title" defaultValue={r.title ?? ""} />
                  </AdminField>
                  <AdminField name="body" label="Review" required>
                    <Textarea name="body" rows={4} defaultValue={r.body} />
                  </AdminField>
                  <AdminField name="adminReply" label="Public reply from the owner">
                    <Textarea name="adminReply" rows={2} defaultValue={r.adminReply ?? ""} />
                  </AdminField>
                  <SubmitButton size="sm" className="justify-self-start">
                    Save review
                  </SubmitButton>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

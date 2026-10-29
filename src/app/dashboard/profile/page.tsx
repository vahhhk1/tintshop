import { PageHeader } from "@/components/dashboard/shell";
import { PasswordForm, ProfileForm } from "@/components/dashboard/profile-forms";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const sessionUser = await requireUser("/dashboard/profile");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id }, include: { profile: true, accounts: { select: { provider: true } } } });
  const p = user.profile;
  return (
    <>
      <PageHeader title="Profile" description="Your contact details and notification preferences." />
      <div className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-3xl border border-white/[0.08] bg-card p-6 sm:p-8" aria-label="Profile details">
          <ProfileForm
            email={user.email}
            defaults={{
              name: user.name ?? "",
              phone: user.phone ?? "",
              addressLine1: p?.addressLine1 ?? "",
              addressLine2: p?.addressLine2 ?? "",
              city: p?.city ?? "",
              state: p?.state ?? "",
              postalCode: p?.postalCode ?? "",
              preferredContact: (p?.preferredContact as "email" | "phone" | "sms" | null) ?? null,
              emailNotifications: p?.emailNotifications ?? true,
              smsOptIn: p?.smsOptIn ?? false,
              marketingOptIn: p?.marketingOptIn ?? false,
            }}
          />
        </section>
        <section className="rounded-3xl border border-white/[0.08] bg-card p-6 sm:p-8 xl:self-start" aria-labelledby="pw-h">
          <h2 id="pw-h" className="mb-1 text-lg font-semibold">
            Password
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {user.passwordHash ? "Update the password you use to sign in." : `You sign in with ${user.accounts.map((a) => a.provider).join(", ") || "a linked account"}. Set a password to also sign in by email.`}
          </p>
          <PasswordForm hasPassword={Boolean(user.passwordHash)} />
        </section>
      </div>
    </>
  );
}

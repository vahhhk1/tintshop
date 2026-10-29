import "server-only";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validation/public";
import { rateLimit } from "@/lib/rate-limit";
import { authConfig } from "./config";
import { verifyPassword } from "./password";

class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}

const providers: Provider[] = [
  Credentials({
    name: "Email",
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    async authorize(raw, request) {
      const parsed = loginSchema.safeParse(raw);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;

      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const [byEmail, byIp] = await Promise.all([
        rateLimit(`login:email:${email}`, 8, 15 * 60),
        rateLimit(`login:ip:${ip}`, 30, 15 * 60),
      ]);
      if (!byEmail.success || !byIp.success) throw new TooManyAttempts();

      const user = await prisma.user.findUnique({ where: { email } });
      // Always run a hash comparison to keep timing consistent for unknown emails.
      const hash = user?.passwordHash ?? "$2b$12$u9P8ARu9eeS7PwXfTrfXpORXRI2tbM6wDmNpNz9iVywL8DSjA0YSS";
      const valid = await verifyPassword(password, hash);
      if (!user || !user.passwordHash || !valid || !user.isActive) return null;

      return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      const email = (profile?.email ?? user.email)?.toLowerCase();
      if (!email || profile?.email_verified === false) return false;

      const dbUser = await prisma.user.upsert({
        where: { email },
        update: { emailVerified: new Date(), image: user.image ?? undefined },
        create: {
          email,
          name: user.name ?? profile?.name ?? null,
          image: user.image ?? null,
          emailVerified: new Date(),
          profile: { create: {} },
        },
      });
      if (!dbUser.isActive) return false;

      await prisma.account.upsert({
        where: { provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId } },
        update: {},
        create: { userId: dbUser.id, type: account.type, provider: account.provider, providerAccountId: account.providerAccountId },
      });

      // Google verified this email, so it is safe to attach earlier guest bookings and quotes.
      await Promise.all([
        prisma.appointment.updateMany({ where: { userId: null, customerEmail: email }, data: { userId: dbUser.id } }),
        prisma.quote.updateMany({ where: { userId: null, email }, data: { userId: dbUser.id } }),
      ]);
      return true;
    },
    async jwt({ token, user, account }) {
      if (user && account) {
        const dbUser =
          account.provider === "credentials"
            ? await prisma.user.findUnique({ where: { id: user.id! } })
            : await prisma.user.findUnique({ where: { email: (user.email ?? "").toLowerCase() } });
        if (dbUser) {
          token.sub = dbUser.id;
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.email = dbUser.email;
          await prisma.user.update({ where: { id: dbUser.id }, data: { lastLoginAt: new Date() } });
        }
      }
      return token;
    },
  },
});

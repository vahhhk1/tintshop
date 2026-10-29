import type { NextAuthConfig } from "next-auth";
import type { RoleName } from "./roles";

/**
 * Edge/proxy-safe Auth.js configuration (no database access).
 * Providers and DB-backed callbacks are added in ./index.ts.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login", error: "/login" },
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        session.user.role = (token.role as RoleName | undefined) ?? "CUSTOMER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

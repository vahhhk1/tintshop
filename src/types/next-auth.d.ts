import type { DefaultSession } from "next-auth";
import type { RoleName } from "@/lib/auth/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: RoleName;
    } & DefaultSession["user"];
  }

  interface User {
    role?: RoleName;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: RoleName;
  }
}

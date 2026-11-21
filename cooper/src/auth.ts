import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { loginGoogle } from "@/lib/identidad";
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/entrar", error: "/entrar" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (
        account?.provider !== "google" ||
        !user.email ||
        profile?.email_verified !== true
      )
        return false;
      try {
        loginGoogle(user.email, user.name ?? "", user.image ?? "");
        return true;
      } catch {
        return false;
      }
    },
  },
});

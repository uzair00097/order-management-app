import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: { email: credentials.email, deletedAt: null },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          distributorId: user.distributorId,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.distributorId = user.distributorId;
        token.tokenVersion = user.tokenVersion;
      }

      // On every request, verify tokenVersion matches DB — invalidates forced logouts
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { tokenVersion: true, deletedAt: true },
        });
        if (!dbUser || dbUser.deletedAt || dbUser.tokenVersion !== token.tokenVersion) {
          // Return token without id — authorized callback will see no session
          return { ...token, id: undefined as unknown as string };
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.distributorId = token.distributorId as string | null;
      session.user.tokenVersion = token.tokenVersion as number;
      return session;
    },
  },
  pages: { signIn: "/login" },
};

export const getSession = () => getServerSession(authOptions);

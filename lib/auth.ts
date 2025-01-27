import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email и пароль обязательны");
        }

        // Ищем пользователя в базе по email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });
        if (!user) {
          throw new Error("Пользователь не найден");
        }

        // Сравниваем пароль (bcrypt)
        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        if (!isValid) {
          throw new Error("Неверный пароль");
        }

        // В Prisma user.id (число), user.role - "ADMIN"|"USER"
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name
        };
      }
    })
  ],

  callbacks: {
    // 1) JWT колбэк, записываем поля из user в токен
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = user.role; // "ADMIN"|"USER"
        token.name = user.name;
      }
      return token;
    },

    // 2) Session колбэк, копируем поля из токена в session
    async session({ session, token }) {
      if (token) {
        // Подставляем в session.user
        session.user.id = token.id as number;
        session.user.email = token.email as string;
        session.user.role = token.role as "ADMIN" | "USER";
        session.user.name = token.name as string | null;
      }
      return session;
    }
  }
};

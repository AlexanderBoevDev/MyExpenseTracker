import { DefaultUser, DefaultSession } from "next-auth";

// Расширяем типы внутри "next-auth"
declare module "next-auth" {
  // 1) Расширяем интерфейс User
  interface User extends DefaultUser {
    // В базе Prisma user.id — число,
    // но если в authorize() возвращаем String(user.id),
    // то можно писать id: string.
    // Ниже для примера оставим число:
    id: number;
    // Роль: "ADMIN" | "USER"
    role: "ADMIN" | "USER";
    // Если используем name: string | null
    name?: string | null;
  }

  // 2) Расширяем интерфейс Session
  interface Session {
    user: {
      id: number;
      role: "ADMIN" | "USER";
      name?: string | null;
    } & DefaultSession["user"];
  }
}

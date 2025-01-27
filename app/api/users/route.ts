import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

/**
 * GET /api/users
 *  - ADMIN: возвращает всех пользователей
 *  - USER: возвращает только самого себя (session.user.id)
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  // Проверяем авторизацию
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (session.user.role === "ADMIN") {
      // Администратор видит всех
      const users = await prisma.user.findMany({
        orderBy: { id: "asc" }
      });
      return NextResponse.json(users, { status: 200 });
    } else {
      // Обычный пользователь видит только себя
      const user = await prisma.user.findUnique({
        where: { id: session.user.id }
      });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      return NextResponse.json(user, { status: 200 });
    }
  } catch (error: unknown) {
    console.error("GET /api/users Error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST /api/users
 * Создать нового пользователя (только для ADMIN)
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Проверяем, что это админ
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden. Admin only." },
      { status: 403 }
    );
  }

  try {
    const { email, password, name, role } = await request.json();

    // Простейшая валидация
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid password" }, { status: 400 });
    }

    // В реальном приложении пароль нужно хешировать
    const newUser = await prisma.user.create({
      data: {
        email,
        password,
        name: typeof name === "string" ? name : null,
        role: role === "ADMIN" ? "ADMIN" : "USER"
      }
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/users Error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

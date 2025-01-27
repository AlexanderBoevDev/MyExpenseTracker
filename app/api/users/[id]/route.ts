import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

/** Извлекаем :id из request.url */
function extractIdFromUrl(request: NextRequest): number | null {
  const { pathname } = new URL(request.url);
  const segments = pathname.split("/");
  const lastSegment = segments[segments.length - 1];
  const parsed = parseInt(lastSegment, 10);
  if (isNaN(parsed)) return null;
  return parsed;
}

/**
 * GET /api/users/:id
 * - ADMIN: может получить любого пользователя
 * - USER: только себя
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = extractIdFromUrl(request);
    if (id === null) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    if (session.user.role === "ADMIN") {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      return NextResponse.json(user, { status: 200 });
    } else {
      if (id !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      return NextResponse.json(user, { status: 200 });
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * PATCH /api/users/:id
 * - ADMIN: может редактировать любого
 * - USER: только себя
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = extractIdFromUrl(request);
    if (id === null) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const body = await request.json();
    const { email, password, name, role } = body;

    if (session.user.role === "ADMIN") {
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          ...(typeof email === "string" && email !== "" && { email }),
          ...(typeof password === "string" && password !== "" && { password }),
          ...(typeof name === "string" && { name }),
          // Роль можно менять только если это админ
          ...(role === "ADMIN" || role === "USER" ? { role } : {})
        }
      });
      return NextResponse.json(updatedUser, { status: 200 });
    } else {
      // Обычный пользователь: только себя
      if (id !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Не даём менять role
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          ...(typeof email === "string" && email !== "" && { email }),
          ...(typeof password === "string" && password !== "" && { password }),
          ...(typeof name === "string" && { name })
        }
      });
      return NextResponse.json(updatedUser, { status: 200 });
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * DELETE /api/users/:id
 * - ADMIN: может удалить любого
 * - USER: только себя
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = extractIdFromUrl(request);
    if (id === null) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    if (session.user.role === "ADMIN") {
      await prisma.user.delete({ where: { id } });
      return NextResponse.json(
        { message: "User deleted by admin" },
        { status: 200 }
      );
    } else {
      if (id !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ message: "User deleted" }, { status: 200 });
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

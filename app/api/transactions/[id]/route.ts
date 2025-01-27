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
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * GET /api/transactions/:id
 * - USER: получает транзакцию только если userId === session.user.id
 * - ADMIN: может видеть любую
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = extractIdFromUrl(request);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        category: true,
        type: true
      }
    });

    if (!transaction) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Если админ => ок, иначе user => проверка
    if (
      session.user.role !== "ADMIN" &&
      transaction.userId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(transaction, { status: 200 });
  } catch (error: unknown) {
    console.error("GET /api/transactions/:id Error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * PATCH /api/transactions/:id
 * Обновить транзакцию
 * - ADMIN: любую
 * - USER: только свою
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = extractIdFromUrl(request);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

    // Находим существующую транзакцию
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // USER: проверяем принадлежность
    if (session.user.role !== "ADMIN" && existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { categoryId, typeId, amount, date, description } = body;

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(typeof categoryId === "number" && { categoryId }),
        ...(typeof typeId === "number" && { typeId }),
        ...(typeof amount === "number" && { amount }),
        ...(date && { date: new Date(date) }),
        ...(typeof description === "string" && { description })
      }
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: unknown) {
    console.error("PATCH /api/transactions/:id Error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * DELETE /api/transactions/:id
 * - ADMIN: может удалить любую
 * - USER: только свою
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = extractIdFromUrl(request);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.findUnique({ where: { id } });
    if (!transaction) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Если админ => ok, иначе user => проверка
    if (
      session.user.role !== "ADMIN" &&
      transaction.userId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json(
      { message: "Transaction deleted" },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("DELETE /api/transactions/:id Error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

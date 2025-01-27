import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

/**
 * GET /api/transactions
 * - USER: возвращает только свои транзакции
 * - ADMIN: может вернуть все транзакции,
 *          или по query ?userId=... (фильтрация по пользователю)
 *
 * Пример: GET /api/transactions?skip=0&take=5&userId=2
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const skip = parseInt(url.searchParams.get("skip") || "0", 10) || 0;
    const take = parseInt(url.searchParams.get("take") || "5", 10) || 5;

    // Если ADMIN — может фильтровать по userId
    // Если USER — всегда берём userId из сессии
    let userIdFilter: number | null = null;
    const queryUserId = url.searchParams.get("userId");

    if (session.user.role === "ADMIN" && queryUserId) {
      // admin может указать ?userId=...
      userIdFilter = parseInt(queryUserId, 10);
      if (isNaN(userIdFilter)) {
        return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
      }
    } else if (session.user.role === "ADMIN") {
      // admin без userId => все
      userIdFilter = null;
    } else {
      // обычный пользователь => только свои
      userIdFilter = session.user.id;
    }

    const whereClause = userIdFilter ? { userId: userIdFilter } : {}; // если null => админ видит все

    // Находим транзакции
    const items = await prisma.transaction.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { id: "desc" },
      include: {
        category: true,
        type: true
      }
    });

    // Подсчитываем общее кол-во
    const total = await prisma.transaction.count({ where: whereClause });

    return NextResponse.json({ items, total }, { status: 200 });
  } catch (error: unknown) {
    console.error("GET /api/transactions Error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST /api/transactions
 * Создать новую транзакцию
 * - USER: создаёт только для себя (userId = session.user.id)
 * - ADMIN: может создавать для любого userId? (опционально)
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId, categoryId, typeId, amount, date, description } = body;

    // Если USER, принудительно userId = session.user.id
    let finalUserId = session.user.id;

    if (session.user.role === "ADMIN" && typeof userId === "number") {
      // admin может указать userId
      finalUserId = userId;
    }

    if (!categoryId || !typeId || !amount) {
      return NextResponse.json(
        { error: "categoryId, typeId, amount are required" },
        { status: 400 }
      );
    }

    // Создаем новую транзакцию
    const created = await prisma.transaction.create({
      data: {
        userId: finalUserId,
        categoryId,
        typeId,
        amount: Number(amount),
        date: date ? new Date(date) : new Date(),
        description: description || ""
      }
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/transactions Error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

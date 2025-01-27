import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

/**
 * GET /api/categories?skip=0&take=5
 * Возвращает категории текущего пользователя с пагинацией.
 * Результат: { items: Category[], total: number }
 */
export async function GET(request: Request) {
  let session: unknown;

  try {
    session = await getServerSession(authOptions);
  } catch {
    return NextResponse.json({ error: "Ошибка сессии" }, { status: 500 });
  }

  // 1) Проверяем, что session — объект и имеет ключ 'user'
  if (!session || typeof session !== "object" || !("user" in session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Преобразуем к типу, где точно есть user.id (number | string)
  const sessObj = session as {
    user: { id: number | string };
  };

  if (!sessObj.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3) Приводим user.id к числу
  const rawId = sessObj.user.id;
  const userId =
    typeof rawId === "number" ? rawId : parseInt(String(rawId), 10);

  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const skip = parseInt(url.searchParams.get("skip") ?? "0", 10) || 0;
    const take = parseInt(url.searchParams.get("take") ?? "5", 10) || 5;

    const items = await prisma.category.findMany({
      where: { userId },
      orderBy: { id: "asc" },
      skip,
      take
    });
    const total = await prisma.category.count({ where: { userId } });

    return NextResponse.json({ items, total }, { status: 200 });
  } catch (error: unknown) {
    console.error("GET (categories) Error:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // если error не является Error, приводим к string
    return NextResponse.json({ error: String(error) }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST /api/categories
 * Создать новую категорию (name, machineName).
 * Привязываем к userId (число).
 * Если такой machineName уже существует у пользователя,
 * то добавляем "-1", "-2" и т. д. пока не найдём уникальный.
 */
export async function POST(request: Request) {
  let session: unknown;
  try {
    session = await getServerSession(authOptions);
  } catch {
    return NextResponse.json({ error: "Ошибка сессии" }, { status: 500 });
  }

  if (!session || typeof session !== "object" || !("user" in session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessObj = session as {
    user: { id: number | string };
  };
  if (!sessObj.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawId = sessObj.user.id;
  const userId =
    typeof rawId === "number" ? rawId : parseInt(String(rawId), 10);

  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid or empty JSON body." },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be a valid JSON object." },
      { status: 400 }
    );
  }

  const { name, machineName } = body as {
    name?: string;
    machineName?: string;
  };

  if (!name || typeof name !== "string") {
    return NextResponse.json(
      { error: "Поле 'name' обязательно и должно быть строкой." },
      { status: 400 }
    );
  }
  if (!machineName || typeof machineName !== "string") {
    return NextResponse.json(
      { error: "Поле 'machineName' обязательно и должно быть строкой." },
      { status: 400 }
    );
  }

  try {
    // Проверяем уникальность machineName среди категорий текущего пользователя
    // Если уже занято, добавляем "-1", "-2", и т. д.
    let finalMachineName = machineName;
    let counter = 1;

    while (true) {
      // Ищем категорию с таким же machineName и userId
      const existing = await prisma.category.findFirst({
        where: {
          userId,
          machineName: finalMachineName
        }
      });
      if (!existing) {
        // свободно
        break;
      }
      finalMachineName = `${machineName}-${counter}`;
      counter++;
    }

    // Создаём
    const newCategory = await prisma.category.create({
      data: {
        name,
        machineName: finalMachineName,
        userId
      }
    });

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error: unknown) {
    console.error("POST (categories) Error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

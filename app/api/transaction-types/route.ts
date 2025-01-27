import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

/**
 * GET /api/transaction-types
 * Получить все типы (публично)
 */
export async function GET() {
  try {
    const types = await prisma.transactionType.findMany({
      orderBy: { id: "asc" }
    });
    return NextResponse.json(types, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET (transaction-types) Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST /api/transaction-types
 * Создать новый тип (только для ADMIN)
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  // Авторизация
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden. Admin only." },
      { status: 403 }
    );
  }

  let body: unknown; // вместо any
  try {
    body = await request.json();
  } catch {
    // parseErr не используем => убираем имя
    return NextResponse.json(
      { error: "Invalid or empty JSON body." },
      { status: 400 }
    );
  }

  // Сужаем тип
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
      { error: "Invalid name. Must be a non-empty string." },
      { status: 400 }
    );
  }
  if (!machineName || typeof machineName !== "string") {
    return NextResponse.json(
      { error: "Invalid machineName. Must be a non-empty string." },
      { status: 400 }
    );
  }

  try {
    const newType = await prisma.transactionType.create({
      data: {
        name,
        machineName
      }
    });

    return NextResponse.json(newType, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("POST (transaction-types) Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

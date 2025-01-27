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
 * GET /api/transaction-types/:id
 * Получить один тип (публично)
 */
export async function GET(request: NextRequest) {
  try {
    const id = extractIdFromUrl(request);
    if (!id) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const typeEntry = await prisma.transactionType.findUnique({
      where: { id }
    });

    if (!typeEntry) {
      return NextResponse.json({ error: "Type not found" }, { status: 404 });
    }

    return NextResponse.json(typeEntry, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET (transaction-type by id) Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * PATCH /api/transaction-types/:id
 * (только ADMIN)
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  // Проверка авторизации
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden. Admin only." },
      { status: 403 }
    );
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

  try {
    const id = extractIdFromUrl(request);
    if (!id) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const updatedType = await prisma.transactionType.update({
      where: { id },
      data: {
        ...(typeof name === "string" && name.trim() !== "" && { name }),
        ...(typeof machineName === "string" &&
          machineName.trim() !== "" && { machineName })
      }
    });

    return NextResponse.json(updatedType, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PATCH (transaction-type) Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * DELETE /api/transaction-types/:id
 * (только ADMIN)
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  // Проверка авторизации
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden. Admin only." },
      { status: 403 }
    );
  }

  try {
    const id = extractIdFromUrl(request);
    if (!id) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await prisma.transactionType.delete({
      where: { id }
    });

    return NextResponse.json(
      { message: "Transaction type deleted" },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("DELETE (transaction-type) Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

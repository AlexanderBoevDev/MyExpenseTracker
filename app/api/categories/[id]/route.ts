import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

/** Извлекаем :id из request.url (пример: /api/categories/123) */
function extractIdFromUrl(request: NextRequest): number | null {
  const { pathname } = new URL(request.url);
  const segments = pathname.split("/");
  const lastSegment = segments[segments.length - 1];
  const parsed = parseInt(lastSegment, 10);
  if (isNaN(parsed)) return null;
  return parsed;
}

/**
 * GET /api/categories/:id
 * Возвращает категорию, если она принадлежит текущему пользователю
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    const idNum = extractIdFromUrl(request);
    if (!idNum) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const category = await prisma.category.findFirst({
      where: { id: idNum, userId }
    });
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category, { status: 200 });
  } catch (error: unknown) {
    console.error("GET (category by id) Error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * PATCH /api/categories/:id
 * Обновить категорию. Если приходит новый machineName, проверяем уникальность
 * (не совпадать с другими категориями того же пользователя) и при конфликте
 * добавляем "-1", "-2" и т. д.
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const idNum = extractIdFromUrl(request);
  if (!idNum) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  // Проверяем, что категория принадлежит пользователю
  const existingCategory = await prisma.category.findFirst({
    where: { id: idNum, userId }
  });
  if (!existingCategory) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
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
    const updateData: Record<string, string> = {};

    // Обновляем 'name', если пришло
    if (typeof name === "string" && name.trim() !== "") {
      updateData.name = name.trim();
    }

    // Обновляем 'machineName', если пришло
    if (typeof machineName === "string" && machineName.trim() !== "") {
      // ИСПРАВЛЕНО: используем "const" вместо "let"
      const baseMachineName = machineName.trim();
      let finalMachineName = baseMachineName;
      let counter = 1;

      // Проверяем конфликт (другие категории, не эта)
      while (true) {
        const conflict = await prisma.category.findFirst({
          where: {
            userId,
            machineName: finalMachineName,
            NOT: { id: idNum }
          }
        });
        if (!conflict) {
          break; // свободно
        }
        finalMachineName = `${baseMachineName}-${counter}`;
        counter++;
      }
      updateData.machineName = finalMachineName;
    }

    // Если нечего обновлять, вернём без изменений
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existingCategory, { status: 200 });
    }

    const updatedCategory = await prisma.category.update({
      where: { id: idNum },
      data: updateData
    });

    return NextResponse.json(updatedCategory, { status: 200 });
  } catch (error: unknown) {
    console.error("PATCH (category) Error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * DELETE /api/categories/:id
 * Удалить категорию, если она не используется в транзакциях
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    const idNum = extractIdFromUrl(request);
    if (!idNum) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Проверяем, что категория существует и принадлежит userId
    const category = await prisma.category.findFirst({
      where: { id: idNum, userId }
    });
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Проверяем, не используется ли эта категория в транзакциях
    const usedCount = await prisma.transaction.count({
      where: { categoryId: idNum }
    });
    if (usedCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete category because it is linked to transactions."
        },
        { status: 400 }
      );
    }

    await prisma.category.delete({ where: { id: idNum } });
    return NextResponse.json({ message: "Category deleted" }, { status: 200 });
  } catch (error: unknown) {
    console.error("DELETE (category) Error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

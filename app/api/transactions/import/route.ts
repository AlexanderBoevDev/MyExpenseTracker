import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { parse } from "papaparse"; // npm install papaparse

const prisma = new PrismaClient();

/** Описываем формат строк CSV */
interface CSVRow {
  category?: string;
  type?: string;
  amount?: string;
  date?: string;
  description?: string;
}

/**
 * POST /api/transactions/import
 * - принимает сырой CSV (text/plain)
 * - парсит через papaparse,
 * - создает транзакции для userId = session.user.id
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1) Считываем тело запроса как текст (CSV)
    const csvText = await request.text();
    if (!csvText || !csvText.trim()) {
      return NextResponse.json({ error: "Empty CSV" }, { status: 400 });
    }

    // 2) Разбираем через papaparse
    const result = parse(csvText, {
      header: true,
      skipEmptyLines: true
    });

    // Проверяем ошибки парсинга
    if (result.errors && result.errors.length > 0) {
      console.error("Papaparse parse errors:", result.errors);
      return NextResponse.json(
        {
          error: "CSV parse error",
          details: result.errors
        },
        { status: 400 }
      );
    }

    // result.data - массив объектов
    // каждый объект = { category, type, amount, date, description }, строковые поля
    const rows = result.data as CSVRow[];

    const userId = session.user.id;
    const createdList = [];

    // 3) Пробегаемся по строкам CSV
    for (const row of rows) {
      // Достаём поля, защищая от undefined
      const categoryStr = (row.category ?? "").trim();
      const typeStr = (row.type ?? "").trim().toUpperCase();
      const amountStr = (row.amount ?? "").trim();
      const dateStr = (row.date ?? "").trim();
      const descStr = (row.description ?? "").trim();

      if (!categoryStr || !typeStr || !amountStr) {
        // пропускаем строку, если не хватает полей
        continue;
      }

      // Пример преобразования categoryStr -> categoryId (hardcode/demo)
      let categoryId = 0;
      if (categoryStr === "Food") categoryId = 2;
      if (categoryStr === "Salary") categoryId = 3;
      // ...и т.д.

      let typeId = 0;
      if (typeStr === "EXPENSE") typeId = 1;
      if (typeStr === "INCOME") typeId = 2;
      // ...и т.д.

      if (!categoryId || !typeId) {
        // пропуск
        continue;
      }

      const parsedAmount = parseFloat(amountStr);
      if (isNaN(parsedAmount)) {
        // пропуск
        continue;
      }

      let finalDate = new Date();
      if (dateStr) {
        const maybeDate = new Date(dateStr);
        if (!isNaN(maybeDate.getTime())) {
          finalDate = maybeDate;
        }
      }

      // Создаём запись в БД
      const created = await prisma.transaction.create({
        data: {
          userId,
          categoryId,
          typeId,
          amount: parsedAmount,
          date: finalDate,
          description: descStr || null
        }
      });
      createdList.push(created);
    }

    return NextResponse.json(
      {
        message: "Import complete via papaparse",
        createdCount: createdList.length
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("POST /api/transactions/import Error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

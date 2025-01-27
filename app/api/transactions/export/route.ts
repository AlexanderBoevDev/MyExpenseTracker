import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { id: "asc" }
    });

    // Превращаем в CSV
    // заголовки: id,categoryId,typeId,amount,date,description
    let csv = "id,categoryId,typeId,amount,date,description\n";
    for (const t of transactions) {
      csv += `${t.id},${t.categoryId},${t.typeId},${t.amount},${t.date.toISOString()},${t.description || ""}\n`;
    }

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="transactions-export.csv"'
      }
    });
  } catch (error) {
    console.error("GET /api/transactions/export Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

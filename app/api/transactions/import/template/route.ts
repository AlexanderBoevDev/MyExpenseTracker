import { PrismaClient } from "@prisma/client";

// Создаём экземпляр Prisma. Важно закрывать соединение, если надо.
const prisma = new PrismaClient();

export async function GET() {
  // 1) Читаем из базы все transaction types
  const types = await prisma.transactionType.findMany({
    orderBy: { id: "asc" }
  });

  // Предположим, у нас в таблице есть поля machineName / name.
  // Например: [{ id:1, machineName:"EXPENSE", name:"Расход" }, { ... }, ...]
  // Собираем список: "EXPENSE,INCOME,..."
  const typeList = types.map((t) => t.machineName).join(", ");

  // 2) Формируем CSV-шаблон.
  // ВАЖНО: CSV не умеет «комментарии» стандартно, но часто используют `#`.
  // или добавляем строку-«подсказку», которую пользователь потом удалит.
  const csvTemplate = `# Допустимые значения для поля "type": ${typeList}
category,type,amount,date,description
Food,EXPENSE,200,2025-01-01,Lunch
Salary,INCOME,5000,2025-01-02,Monthly salary
`;

  // 3) Возвращаем контент как CSV, чтобы браузер скачивал «import-template.csv»
  return new Response(csvTemplate, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="import-template.csv"'
    }
  });
}

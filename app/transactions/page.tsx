"use client";

import React, {
  useEffect,
  useState,
  FormEvent,
  ChangeEvent,
  useCallback
} from "react";
import { useSession } from "next-auth/react";
import {
  Button,
  Card,
  CardBody,
  Input,
  Pagination,
  Alert,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  DatePicker,
  Select,
  SelectItem
} from "@heroui/react";
import {
  DateValue,
  getLocalTimeZone,
  parseDate
} from "@internationalized/date";

// ===== chart.js imports =====
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartData
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement
);

/** Интерфейсы */

// Модель транзакции
interface Transaction {
  id: number;
  categoryId: number;
  typeId: number; // 1 => расход, 2 => доход
  amount: number;
  date: string; // ISO string
  description: string | null;
}

// Расширяем для отображения названий категории/типа
interface TransactionWithLabels extends Transaction {
  categoryName?: string;
  typeName?: string;
}

interface Category {
  id: number;
  name: string;
}

interface TransType {
  id: number;
  name: string;
}

/** Формат суммы "1 234,56 ₽" */
function formatRub(amount: number): string {
  const [intPart, fracPart] = amount.toFixed(2).split(".");
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${withSpaces},${fracPart} ₽`;
}

/** Парсим ISO (YYYY-MM-DD...) в DateValue (без времени) */
function parseDateValue(isoString: string): DateValue | null {
  if (!isoString) return null;
  const ymd = isoString.slice(0, 10);
  try {
    return parseDate(ymd);
  } catch {
    return null;
  }
}

export default function TransactionsPage() {
  const { data: session, status } = useSession();

  // ===== Уведомления
  const [alertMsg, setAlertMsg] = useState<{
    text: string;
    color: "danger" | "success" | "warning";
    visible: boolean;
  }>({ text: "", color: "danger", visible: false });

  // Оборачиваем showAlert в useCallback, чтобы её ссылка была стабильной
  const showAlert = useCallback(
    (text: string, color: "danger" | "success" | "warning" = "danger") => {
      setAlertMsg({ text, color, visible: true });
    },
    []
  );

  function hideAlert() {
    setAlertMsg((prev) => ({ ...prev, visible: false }));
  }

  // ===== Состояние транзакций, пагинация
  const [transactions, setTransactions] = useState<TransactionWithLabels[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 5;

  // ===== Модалки
  const createModal = useDisclosure();
  const [newCategoryId, setNewCategoryId] = useState<number>(0);
  const [newTypeId, setNewTypeId] = useState<number>(0);
  const [newAmount, setNewAmount] = useState<number>(0);
  // DateValue | null для DatePicker
  const [newDateValue, setNewDateValue] = useState<DateValue | null>(null);
  const [newDesc, setNewDesc] = useState("");

  const editModal = useDisclosure();
  const [editId, setEditId] = useState<number | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<number>(0);
  const [editTypeId, setEditTypeId] = useState<number>(0);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDateValue, setEditDateValue] = useState<DateValue | null>(null);
  const [editDesc, setEditDesc] = useState("");

  const deleteModal = useDisclosure();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const importModal = useDisclosure();
  const [importFile, setImportFile] = useState<File | null>(null);

  // ===== Справочники
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<TransType[]>([]);

  // ===== Данные для графиков
  const [doughnutData, setDoughnutData] =
    useState<ChartData<"doughnut"> | null>(null);
  const [expenseLineData, setExpenseLineData] =
    useState<ChartData<"line"> | null>(null);
  const [incomeLineData, setIncomeLineData] =
    useState<ChartData<"line"> | null>(null);

  // ======================
  // ФУНКЦИИ ЗАГРУЗКИ (useCallback)
  // ======================
  const loadTransactions = useCallback(
    async (currentPage: number) => {
      if (!session?.user?.id) return;
      const skip = (currentPage - 1) * pageSize;

      try {
        const res = await fetch(
          `/api/transactions?skip=${skip}&take=${pageSize}`
        );
        if (!res.ok) throw new Error("Не удалось загрузить транзакции.");
        const data = await res.json();

        const rawItems: Transaction[] = data.items || [];
        const total = data.total || 0;
        const totalPagesCalc = Math.ceil(total / pageSize);
        setTotalPages(totalPagesCalc < 1 ? 1 : totalPagesCalc);

        const itemsWithLabels: TransactionWithLabels[] = rawItems.map((t) => ({
          ...t,
          categoryName: "",
          typeName: ""
        }));
        setTransactions(itemsWithLabels);
      } catch (error: unknown) {
        if (error instanceof Error) {
          showAlert(error.message, "danger");
        } else {
          showAlert(String(error), "danger");
        }
      }
    },
    [session, showAlert, pageSize]
  );

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      if (!res.ok) return;
      const data = await res.json();
      setCategories(data.items || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        showAlert(error.message, "danger");
      } else {
        showAlert(String(error), "danger");
      }
    }
  }, [showAlert]);

  const loadTransTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/transaction-types");
      if (!res.ok) return;
      const data = await res.json();
      setTypes(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        showAlert(error.message, "danger");
      } else {
        showAlert(String(error), "danger");
      }
    }
  }, [showAlert]);

  // Запускаем при status==="authenticated" + смене page
  useEffect(() => {
    if (status === "authenticated") {
      loadTransactions(page);
      loadCategories();
      loadTransTypes();
    }
  }, [status, page, loadTransactions, loadCategories, loadTransTypes]);

  // ======================
  // Обогащение + графики
  // ======================
  // Подставим categoryName и typeName
  useEffect(() => {
    setTransactions((prev) =>
      prev.map((tr) => {
        const cat = categories.find((c) => c.id === tr.categoryId);
        const typ = types.find((t) => t.id === tr.typeId);
        return {
          ...tr,
          categoryName: cat?.name || "",
          typeName: typ?.name || ""
        };
      })
    );
  }, [categories, types]);

  // Строим Doughnut + Lines
  useEffect(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const categoryCountMap: Record<number, number> = {};
    const dailyExpenseMap: number[] = Array(31).fill(0);
    const dailyIncomeMap: number[] = Array(31).fill(0);

    transactions.forEach((tr) => {
      const d = new Date(tr.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const dayOfMonth = d.getDate() - 1;
        if (dayOfMonth < 0 || dayOfMonth > 30) return;

        if (tr.typeId === 1) {
          // Расход
          if (!categoryCountMap[tr.categoryId]) {
            categoryCountMap[tr.categoryId] = 0;
          }
          categoryCountMap[tr.categoryId] += 1;
          dailyExpenseMap[dayOfMonth] += tr.amount;
        } else if (tr.typeId === 2) {
          // Доход
          dailyIncomeMap[dayOfMonth] += tr.amount;
        }
      }
    });

    // Doughnut
    const catLabels: string[] = [];
    const catValues: number[] = [];
    for (const catIdStr in categoryCountMap) {
      const catId = Number(catIdStr);
      const catObj = categories.find((c) => c.id === catId);
      catLabels.push(catObj ? catObj.name : `Cat#${catId}`);
      catValues.push(categoryCountMap[catId]);
    }
    const doughnutChart: ChartData<"doughnut"> = {
      labels: catLabels,
      datasets: [
        {
          label: "Кол-во транзакций",
          data: catValues,
          backgroundColor: [
            "#F87171",
            "#FBBF24",
            "#34D399",
            "#60A5FA",
            "#A78BFA",
            "#F472B6",
            "#FCD34D",
            "#C084FC",
            "#A3E635",
            "#FDBA74"
          ],
          borderWidth: 1
        }
      ]
    };
    setDoughnutData(doughnutChart);

    // Labels 1..31
    const dayLabels = Array.from({ length: 31 }, (_, i) => String(i + 1));
    const expenseChart: ChartData<"line"> = {
      labels: dayLabels,
      datasets: [
        {
          label: "Расход, ₽",
          data: dailyExpenseMap,
          borderColor: "#f87171",
          backgroundColor: "#f87171",
          tension: 0.2
        }
      ]
    };
    setExpenseLineData(expenseChart);

    const incomeChart: ChartData<"line"> = {
      labels: dayLabels,
      datasets: [
        {
          label: "Доход, ₽",
          data: dailyIncomeMap,
          borderColor: "#34d399",
          backgroundColor: "#34d399",
          tension: 0.2
        }
      ]
    };
    setIncomeLineData(incomeChart);
  }, [transactions, categories]);

  // ======================
  // Создание
  // ======================
  function openCreateModal() {
    setNewCategoryId(0);
    setNewTypeId(0);
    setNewAmount(0);
    setNewDateValue(null);
    setNewDesc("");
    createModal.onOpen();
  }

  async function handleCreateTransaction(e: FormEvent) {
    e.preventDefault();
    try {
      // Преобразуем DateValue -> ISO
      let isoString: string | null = null;
      if (newDateValue) {
        const dateObj = newDateValue.toDate(getLocalTimeZone());
        isoString = dateObj.toISOString();
      }

      const body = {
        categoryId: newCategoryId,
        typeId: newTypeId,
        amount: newAmount,
        date: isoString,
        description: newDesc
      };

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Не удалось создать транзакцию.");
      }
      showAlert("Транзакция успешно создана!", "success");
      createModal.onClose();
      loadTransactions(page);
    } catch (error: unknown) {
      if (error instanceof Error) {
        showAlert(error.message, "danger");
      } else {
        showAlert(String(error), "danger");
      }
    }
  }

  // ======================
  // Редактирование
  // ======================
  function openEditModal(tr: TransactionWithLabels) {
    setEditId(tr.id);
    setEditCategoryId(tr.categoryId);
    setEditTypeId(tr.typeId);
    setEditAmount(tr.amount);

    if (tr.date) {
      const dv = parseDateValue(tr.date);
      setEditDateValue(dv);
    } else {
      setEditDateValue(null);
    }
    setEditDesc(tr.description || "");
    editModal.onOpen();
  }

  async function handleEditTransaction(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    try {
      let isoString: string | null = null;
      if (editDateValue) {
        const dateObj = editDateValue.toDate(getLocalTimeZone());
        isoString = dateObj.toISOString();
      }

      const body = {
        categoryId: editCategoryId,
        typeId: editTypeId,
        amount: editAmount,
        date: isoString,
        description: editDesc
      };

      const res = await fetch(`/api/transactions/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Ошибка при обновлении транзакции.");
      }
      showAlert("Транзакция обновлена!", "success");
      editModal.onClose();
      loadTransactions(page);
    } catch (error: unknown) {
      if (error instanceof Error) {
        showAlert(error.message, "danger");
      } else {
        showAlert(String(error), "danger");
      }
    }
  }

  // ======================
  // Удаление
  // ======================
  function openDeleteModal(id: number) {
    setDeleteId(id);
    deleteModal.onOpen();
  }

  async function handleDeleteTransaction() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/transactions/${deleteId}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Не удалось удалить транзакцию.");
      }
      showAlert("Транзакция удалена.", "success");
      deleteModal.onClose();
      loadTransactions(page);
    } catch (error: unknown) {
      if (error instanceof Error) {
        showAlert(error.message, "danger");
      } else {
        showAlert(String(error), "danger");
      }
    }
  }

  // ======================
  // Импорт CSV
  // ======================
  function openImportModal() {
    setImportFile(null);
    importModal.onOpen();
  }

  function handleImportFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const file = e.target.files[0];
    setImportFile(file || null);
  }

  async function handleImportCSV() {
    if (!importFile) {
      showAlert("Не выбран файл для импорта", "warning");
      return;
    }
    try {
      const text = await importFile.text();
      const res = await fetch("/api/transactions/import", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: text
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Ошибка при импорте CSV.");
      }
      showAlert("CSV импортирован!", "success");
      importModal.onClose();
      loadTransactions(page);
    } catch (error: unknown) {
      if (error instanceof Error) {
        showAlert(error.message, "danger");
      } else {
        showAlert(String(error), "danger");
      }
    }
  }

  // ======================
  // Экспорт CSV
  // ======================
  function handleExport() {
    window.open("/api/transactions/export", "_blank");
  }

  // ======================
  // Скачивание шаблона CSV
  // ======================
  function handleDownloadTemplate() {
    window.open("/api/transactions/import/template", "_blank");
  }

  // ======================
  // Проверка статуса
  // ======================
  if (status === "loading") {
    return <div className="p-4">Загрузка сессии...</div>;
  }
  if (status === "unauthenticated") {
    return <div className="p-4">Вы не авторизованы.</div>;
  }

  return (
    <div className="p-4">
      {/* Уведомления */}
      {alertMsg.visible && (
        <Alert
          color={alertMsg.color}
          variant="faded"
          description={alertMsg.text}
          isVisible
          onClose={hideAlert}
          title={
            alertMsg.color === "success"
              ? "Успешно!"
              : alertMsg.color === "warning"
                ? "Внимание!"
                : "Ошибка!"
          }
          className="mb-4"
        />
      )}

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <h1 className="text-xl font-bold mr-auto">Мои транзакции</h1>
        <Button
          color="primary"
          variant="bordered"
          onPress={handleDownloadTemplate}
        >
          Скачать шаблон (CSV)
        </Button>
        <Button color="success" variant="bordered" onPress={handleExport}>
          Экспорт
        </Button>
        <Button color="secondary" variant="bordered" onPress={openImportModal}>
          Импорт CSV
        </Button>
        <Button color="success" onPress={openCreateModal}>
          Добавить транзакцию
        </Button>
      </div>

      {/* Список транзакций */}
      <div className="flex flex-col gap-4">
        {transactions.map((tr) => {
          const displayAmount = formatRub(tr.amount);

          return (
            <Card key={tr.id} className="w-full">
              <CardBody>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-lg font-bold">Сумма: {displayAmount}</p>
                    <p className="text-sm text-default-400">
                      Дата: {tr.date?.slice(0, 10)} | Категория:{" "}
                      {tr.categoryName || `ID=${tr.categoryId}`} | Тип:{" "}
                      {tr.typeName || `ID=${tr.typeId}`}
                    </p>
                    {tr.description && (
                      <p className="text-sm text-default-500 mt-1">
                        {tr.description}
                      </p>
                    )}
                  </div>
                  <div>
                    <Button
                      color="primary"
                      size="sm"
                      onPress={() => openEditModal(tr)}
                    >
                      Редактировать
                    </Button>
                    <Button
                      color="danger"
                      size="sm"
                      className="ml-2"
                      onPress={() => openDeleteModal(tr.id)}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
        {transactions.length === 0 && (
          <p className="text-default-400">Нет транзакций</p>
        )}
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            initialPage={page}
            total={totalPages}
            onChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}

      {/* ====== Блок "отчёт в графиках" ====== */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Отчёты за текущий месяц</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Doughnut */}
          <Card>
            <CardBody>
              <p className="text-sm text-default-400 mb-2">
                Количество транзакций по категориям
              </p>
              {doughnutData ? (
                <div style={{ width: "100%", height: "300px" }}>
                  <Doughnut data={doughnutData} />
                </div>
              ) : (
                <p className="text-sm text-default-400">
                  Нет данных для отображения.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Line chart: Расходы */}
          <Card>
            <CardBody>
              <p className="text-sm text-default-400 mb-2">Расходы по дням</p>
              {expenseLineData ? (
                <div style={{ width: "100%", height: "300px" }}>
                  <Line data={expenseLineData} />
                </div>
              ) : (
                <p className="text-sm text-default-400">
                  Нет данных для отображения.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Line chart: Доходы */}
          <Card>
            <CardBody>
              <p className="text-sm text-default-400 mb-2">Доходы по дням</p>
              {incomeLineData ? (
                <div style={{ width: "100%", height: "300px" }}>
                  <Line data={incomeLineData} />
                </div>
              ) : (
                <p className="text-sm text-default-400">
                  Нет данных для отображения.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
      {/* ====== Конец блока отчёта ===== */}

      {/* Модалка Создания */}
      <Modal
        isOpen={createModal.isOpen}
        onOpenChange={createModal.onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Добавить транзакцию</ModalHeader>
              <ModalBody>
                <form id="createTransForm" onSubmit={handleCreateTransaction}>
                  <label className="block mb-1 text-sm font-semibold">
                    Категория
                  </label>
                  <Select
                    isRequired
                    placeholder="Выберите категорию"
                    selectedKeys={newCategoryId ? [String(newCategoryId)] : []}
                    onSelectionChange={(keys) => {
                      const val = Array.from(keys)[0];
                      setNewCategoryId(Number(val));
                    }}
                    className="mb-4"
                  >
                    {categories.map((c) => (
                      <SelectItem key={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </Select>

                  <label className="block mb-1 text-sm font-semibold">
                    Тип
                  </label>
                  <Select
                    isRequired
                    placeholder="Выберите тип"
                    selectedKeys={newTypeId ? [String(newTypeId)] : []}
                    onSelectionChange={(keys) => {
                      const val = Array.from(keys)[0];
                      setNewTypeId(Number(val));
                    }}
                    className="mb-4"
                  >
                    {types.map((t) => (
                      <SelectItem key={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </Select>

                  <label className="text-sm font-semibold mt-4 block">
                    Дата
                  </label>
                  <DatePicker
                    hideTimeZone
                    showMonthAndYearPickers
                    value={newDateValue}
                    onChange={setNewDateValue}
                  />

                  <label className="text-sm font-semibold mt-4 block">
                    Сумма
                  </label>
                  <Input
                    type="number"
                    color="primary"
                    value={String(newAmount)}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                  />

                  <label className="text-sm font-semibold mt-4 block">
                    Описание
                  </label>
                  <Input
                    type="text"
                    color="primary"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </form>
              </ModalBody>
              <ModalFooter>
                <Button color="warning" variant="flat" onPress={onClose}>
                  Отмена
                </Button>
                <Button color="success" form="createTransForm" type="submit">
                  Создать
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Модалка Редактирования */}
      <Modal isOpen={editModal.isOpen} onOpenChange={editModal.onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Редактировать транзакцию</ModalHeader>
              <ModalBody>
                <form id="editTransForm" onSubmit={handleEditTransaction}>
                  <label className="block mb-1 text-sm font-semibold">
                    Категория
                  </label>
                  <Select
                    isRequired
                    placeholder="Выберите категорию"
                    selectedKeys={
                      editCategoryId ? [String(editCategoryId)] : []
                    }
                    onSelectionChange={(keys) => {
                      const val = Array.from(keys)[0];
                      setEditCategoryId(Number(val));
                    }}
                    className="mb-4"
                  >
                    {categories.map((c) => (
                      <SelectItem key={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </Select>

                  <label className="block mb-1 text-sm font-semibold">
                    Тип
                  </label>
                  <Select
                    isRequired
                    placeholder="Выберите тип"
                    selectedKeys={editTypeId ? [String(editTypeId)] : []}
                    onSelectionChange={(keys) => {
                      const val = Array.from(keys)[0];
                      setEditTypeId(Number(val));
                    }}
                    className="mb-4"
                  >
                    {types.map((t) => (
                      <SelectItem key={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </Select>

                  <label className="text-sm font-semibold mt-4 block">
                    Дата
                  </label>
                  <DatePicker
                    hideTimeZone
                    showMonthAndYearPickers
                    value={editDateValue}
                    onChange={setEditDateValue}
                  />

                  <label className="text-sm font-semibold mt-4 block">
                    Сумма
                  </label>
                  <Input
                    type="number"
                    color="primary"
                    value={String(editAmount)}
                    onChange={(e) => setEditAmount(Number(e.target.value))}
                  />

                  <label className="text-sm font-semibold mt-4 block">
                    Описание
                  </label>
                  <Input
                    type="text"
                    color="primary"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                </form>
              </ModalBody>
              <ModalFooter>
                <Button color="warning" variant="flat" onPress={onClose}>
                  Отмена
                </Button>
                <Button color="success" form="editTransForm" type="submit">
                  Сохранить
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Модалка Удаления */}
      <Modal
        isOpen={deleteModal.isOpen}
        onOpenChange={deleteModal.onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Удалить транзакцию</ModalHeader>
              <ModalBody>
                <p>Вы уверены, что хотите удалить эту транзакцию?</p>
              </ModalBody>
              <ModalFooter>
                <Button color="warning" variant="flat" onPress={onClose}>
                  Отмена
                </Button>
                <Button color="danger" onPress={handleDeleteTransaction}>
                  Удалить
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Модалка Импорта CSV */}
      <Modal
        isOpen={importModal.isOpen}
        onOpenChange={importModal.onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Импорт CSV</ModalHeader>
              <ModalBody>
                <p className="text-sm mb-3">
                  Выберите CSV-файл (см. шаблон) и нажмите «Импортировать».
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportFileChange}
                />
              </ModalBody>
              <ModalFooter>
                <Button color="warning" variant="flat" onPress={onClose}>
                  Отмена
                </Button>
                <Button color="success" onPress={handleImportCSV}>
                  Импортировать
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

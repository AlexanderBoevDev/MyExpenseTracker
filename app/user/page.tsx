"use client";

import React, {
  useState,
  useEffect,
  FormEvent,
  ChangeEvent,
  useCallback
} from "react";
import { useSession } from "next-auth/react";
import {
  Input,
  Button,
  Pagination,
  Alert,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Card,
  CardBody
} from "@heroui/react";

/** Простейший транслитератор (slugify) */
function slugify(str: string): string {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ы: "y",
    э: "e",
    ю: "yu",
    я: "ya"
  };

  const lower = str.trim().toLowerCase();
  let converted = "";
  for (const ch of lower) {
    converted += map[ch] ?? ch;
  }
  converted = converted.replace(/[^\p{L}\p{N}]+/gu, "-");
  converted = converted.replace(/-+/g, "-");
  converted = converted.replace(/^[-]+|[-]+$/g, "");
  return converted;
}

// Типы
interface UserData {
  id: number;
  email: string;
  name: string;
  password: string;
  role: "USER" | "ADMIN";
}

interface Category {
  id: number;
  name: string;
  machineName: string;
}

interface TransactionType {
  id: number;
  name: string;
  machineName: string;
}

export default function UserPage() {
  const { data: session, status } = useSession();

  // Уведомления
  const [alertMsg, setAlertMsg] = useState<{
    text: string;
    color: "danger" | "success" | "warning";
    visible: boolean;
  }>({ text: "", color: "danger", visible: false });

  function showAlert(
    text: string,
    color: "danger" | "success" | "warning" = "danger"
  ) {
    setAlertMsg({ text, color, visible: true });
  }
  function hideAlert() {
    setAlertMsg((prev) => ({ ...prev, visible: false }));
  }

  // Данные пользователя
  const [userData, setUserData] = useState<UserData>({
    id: 0,
    email: "",
    name: "",
    password: "",
    role: "USER"
  });

  // Категории
  const [categories, setCategories] = useState<Category[]>([]);
  const [catPage, setCatPage] = useState(1);
  const [catTotalPages, setCatTotalPages] = useState(1);
  const catPageSize = 5;

  // Модалки создания/редактирования/удаления категории
  const createCatModal = useDisclosure();
  const editCatModal = useDisclosure();
  const deleteCatModal = useDisclosure();

  const [newCatName, setNewCatName] = useState("");
  const [newCatMachineName, setNewCatMachineName] = useState("");

  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatMachineName, setEditCatMachineName] = useState("");

  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);

  // Типы транзакций (ADMIN)
  const [types, setTypes] = useState<TransactionType[]>([]);
  const createTypeModal = useDisclosure();
  const editTypeModal = useDisclosure();
  const deleteTypeModal = useDisclosure();

  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeMachine, setNewTypeMachine] = useState("");

  const [editTypeId, setEditTypeId] = useState<number | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [editTypeMachineName, setEditTypeMachineName] = useState("");

  const [deleteTypeId, setDeleteTypeId] = useState<number | null>(null);

  // =======================
  // useCallback: загрузка
  // =======================
  const loadUserData = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch(`/api/users/${session.user.id}`);
      if (!res.ok) {
        throw new Error("Не удалось загрузить данные пользователя.");
      }
      const data = await res.json();
      setUserData({
        id: data.id,
        email: data.email ?? "",
        name: data.name ?? "",
        password: "",
        role: data.role ?? "USER"
      });
    } catch (error: unknown) {
      if (error instanceof Error) showAlert(error.message);
      else showAlert(String(error));
    }
  }, [session?.user?.id]);

  const loadCategories = useCallback(
    async (page: number) => {
      if (!session?.user?.id) return;
      const skip = (page - 1) * catPageSize;
      try {
        const res = await fetch(
          `/api/categories?skip=${skip}&take=${catPageSize}`
        );
        if (!res.ok) {
          throw new Error("Не удалось загрузить категории.");
        }
        const data = await res.json();
        setCategories(data.items || []);
        const total = data.total || 0;
        const totalPages = Math.ceil(total / catPageSize);
        setCatTotalPages(totalPages < 1 ? 1 : totalPages);
      } catch (error: unknown) {
        if (error instanceof Error) showAlert(error.message);
        else showAlert(String(error));
      }
    },
    [session?.user?.id]
  );

  const loadTransactionTypes = useCallback(async () => {
    if (session?.user?.role !== "ADMIN") return;
    try {
      const res = await fetch("/api/transaction-types");
      if (!res.ok) {
        throw new Error("Не удалось загрузить типы транзакций.");
      }
      const data = await res.json();
      setTypes(data);
    } catch (error: unknown) {
      if (error instanceof Error) showAlert(error.message);
      else showAlert(String(error));
    }
  }, [session?.user?.role]);

  // Запуск при авторизации
  useEffect(() => {
    if (status === "authenticated") {
      loadUserData();
      loadCategories(catPage);
      if (session?.user?.role === "ADMIN") {
        loadTransactionTypes();
      }
    }
  }, [
    status,
    catPage,
    session?.user?.role,
    loadUserData,
    loadCategories,
    loadTransactionTypes
  ]);

  // =======================
  // 1) Пользователь
  // =======================
  async function handleUpdateUser(e: FormEvent) {
    e.preventDefault();
    try {
      const userId = userData.id;
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userData.email,
          name: userData.name,
          password: userData.password
        })
      });
      if (!res.ok) {
        throw new Error("Ошибка при сохранении данных пользователя.");
      }
      const updated = await res.json();
      setUserData({
        id: updated.id,
        email: updated.email ?? "",
        name: updated.name ?? "",
        password: "",
        role: updated.role
      });
      showAlert("Данные пользователя успешно обновлены!", "success");
    } catch (error: unknown) {
      if (error instanceof Error) showAlert(error.message, "danger");
      else showAlert(String(error), "danger");
    }
  }

  // =======================
  // 2) Категории
  // =======================
  // --- Создать
  function openCreateCategoryModal() {
    setNewCatName("");
    setNewCatMachineName("");
    createCatModal.onOpen();
  }

  /**
   * При сабмите, проверяем, не занято ли machineName на клиенте,
   * добавляем суффиксы "-1", "-2" ... пока не найдём свободное
   * (только среди уже загруженных categories).
   * Сервер тоже сделает подобную проверку (для надёжности).
   */
  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault();
    try {
      // Предварительная проверка на фронтенде
      let finalMachineName = newCatMachineName;
      let counter = 1;
      while (categories.some((c) => c.machineName === finalMachineName)) {
        finalMachineName = `${newCatMachineName}-${counter}`;
        counter++;
      }

      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCatName,
          machineName: finalMachineName
        })
      });
      if (!res.ok) {
        throw new Error("Не удалось создать категорию.");
      }
      await res.json();
      showAlert("Категория успешно создана!", "success");
      createCatModal.onClose();
      loadCategories(catPage);
    } catch (error: unknown) {
      if (error instanceof Error) {
        showAlert(error.message, "danger");
      } else {
        showAlert(String(error), "danger");
      }
    }
  }

  function handleNewCatNameChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNewCatName(val);
    setNewCatMachineName(slugify(val));
  }

  // --- Редактирование
  function openEditCategoryModal(cat: Category) {
    setEditCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatMachineName(cat.machineName);
    editCatModal.onOpen();
  }
  function handleEditCatNameChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setEditCatName(val);
    setEditCatMachineName(slugify(val));
  }
  async function saveEditCategory(e?: FormEvent) {
    e?.preventDefault();
    if (!editCatId) return;
    try {
      const res = await fetch(`/api/categories/${editCatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editCatName,
          machineName: editCatMachineName
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Ошибка при обновлении категории.");
      }
      showAlert("Изменения сохранены!", "success");
      editCatModal.onClose();
      setEditCatId(null);
      loadCategories(catPage);
    } catch (error: unknown) {
      if (error instanceof Error) {
        showAlert(error.message, "danger");
      } else {
        showAlert(String(error), "danger");
      }
    }
  }

  // --- Удаление
  function openDeleteCategoryModal(id: number) {
    setDeleteCatId(id);
    deleteCatModal.onOpen();
  }
  async function confirmDeleteCategory() {
    if (!deleteCatId) return;
    try {
      const res = await fetch(`/api/categories/${deleteCatId}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Не удалось удалить категорию.");
      }
      showAlert("Категория удалена.", "success");
      deleteCatModal.onClose();
      loadCategories(catPage);
    } catch (error: unknown) {
      if (error instanceof Error) {
        showAlert(error.message, "danger");
      } else {
        showAlert(String(error), "danger");
      }
    }
  }

  // =======================
  // 3) Типы транзакций (ADMIN)
  // =======================
  function openCreateTypeModal() {
    setNewTypeName("");
    setNewTypeMachine("");
    createTypeModal.onOpen();
  }
  function handleNewTypeNameChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNewTypeName(val);
    setNewTypeMachine(slugify(val));
  }
  async function handleCreateType(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/transaction-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTypeName,
          machineName: newTypeMachine
        })
      });
      if (!res.ok) throw new Error("Не удалось создать тип транзакции.");
      await res.json();
      showAlert("Тип транзакции успешно создан!", "success");
      createTypeModal.onClose();
      loadTransactionTypes();
    } catch (error: unknown) {
      if (error instanceof Error) {
        showAlert(error.message, "danger");
      } else {
        showAlert(String(error), "danger");
      }
    }
  }

  function openEditTypeModal(t: TransactionType) {
    setEditTypeId(t.id);
    setEditTypeName(t.name);
    setEditTypeMachineName(t.machineName);
    editTypeModal.onOpen();
  }
  function handleEditTypeNameChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setEditTypeName(val);
    setEditTypeMachineName(slugify(val));
  }
  async function saveEditType(e?: FormEvent) {
    e?.preventDefault();
    if (!editTypeId) return;
    try {
      const res = await fetch(`/api/transaction-types/${editTypeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editTypeName,
          machineName: editTypeMachineName
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(
          errData.error || "Ошибка при обновлении типа транзакции."
        );
      }
      showAlert("Тип транзакции обновлён!", "success");
      editTypeModal.onClose();
      setEditTypeId(null);
      loadTransactionTypes();
    } catch (error: unknown) {
      if (error instanceof Error) {
        showAlert(error.message, "danger");
      } else {
        showAlert(String(error), "danger");
      }
    }
  }

  function openDeleteTypeModal(id: number) {
    setDeleteTypeId(id);
    deleteTypeModal.onOpen();
  }
  async function confirmDeleteType() {
    if (!deleteTypeId) return;
    try {
      const res = await fetch(`/api/transaction-types/${deleteTypeId}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Не удалось удалить тип транзакции.");
      }
      showAlert("Тип транзакции удалён.", "success");
      deleteTypeModal.onClose();
      loadTransactionTypes();
    } catch (error: unknown) {
      if (error instanceof Error) {
        showAlert(error.message, "danger");
      } else {
        showAlert(String(error), "danger");
      }
    }
  }

  // ---------------------------
  // Проверка статуса сессии
  // ---------------------------
  if (status === "loading") {
    return <div className="p-4">Загрузка сессии...</div>;
  }
  if (status === "unauthenticated") {
    return <div className="p-4">Вы не авторизованы.</div>;
  }

  return (
    <div className="p-6">
      {alertMsg.visible && (
        <Alert
          color={alertMsg.color}
          variant="faded"
          className="mb-4"
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
        />
      )}

      <h1 className="text-2xl font-bold mb-4">Личный кабинет</h1>
      <p>
        Роль: <b>{session?.user?.role}</b>
      </p>

      {/* 1) Форма редактирования пользователя */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-3">
          Редактирование пользователя
        </h2>
        <form
          onSubmit={handleUpdateUser}
          className="flex flex-col gap-4 max-w-sm"
        >
          <Input
            label="Ваш Email"
            type="email"
            color="primary"
            value={userData.email}
            onChange={(e) =>
              setUserData((prev) => ({ ...prev, email: e.target.value }))
            }
          />
          <Input
            label="Ваше имя"
            type="text"
            color="primary"
            value={userData.name}
            onChange={(e) =>
              setUserData((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <Input
            label="Новый пароль"
            type="password"
            color="primary"
            placeholder="Введите новый пароль..."
            value={userData.password}
            onChange={(e) =>
              setUserData((prev) => ({ ...prev, password: e.target.value }))
            }
          />
          <Button color="primary" type="submit">
            Сохранить
          </Button>
        </form>
      </section>

      {/* 2) Категории */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-3 flex justify-between items-center">
          <span>Мои категории</span>
          <Button color="success" onPress={openCreateCategoryModal}>
            Создать категорию
          </Button>
        </h2>

        <div className="flex flex-col gap-4">
          {categories.map((cat) => (
            <Card key={cat.id} className="w-full">
              <CardBody>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-lg font-bold">{cat.name}</p>
                    <p className="text-sm text-default-400">
                      {cat.machineName}
                    </p>
                  </div>
                  <div>
                    <Button
                      color="primary"
                      size="sm"
                      onPress={() => openEditCategoryModal(cat)}
                    >
                      Редактировать
                    </Button>
                    <Button
                      color="danger"
                      size="sm"
                      className="ml-2"
                      onPress={() => openDeleteCategoryModal(cat.id)}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
          {categories.length === 0 && (
            <p className="text-default-400">Нет категорий</p>
          )}
        </div>

        {catTotalPages > 1 && (
          <div className="mt-4">
            <Pagination
              initialPage={catPage}
              total={catTotalPages}
              onChange={(newPage) => setCatPage(newPage)}
            />
          </div>
        )}
      </section>

      {/* 3) Типы транзакций (ADMIN) */}
      {session?.user?.role === "ADMIN" && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-3 flex justify-between items-center">
            <span>Типы транзакций (для администратора)</span>
            <Button color="success" onPress={openCreateTypeModal}>
              Создать тип
            </Button>
          </h2>

          <div className="flex flex-col gap-4">
            {types.map((t) => (
              <Card key={t.id} className="w-full">
                <CardBody>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-lg font-bold">{t.name}</p>
                      <p className="text-sm text-default-400">
                        {t.machineName}
                      </p>
                    </div>
                    <div>
                      <Button
                        color="primary"
                        size="sm"
                        onPress={() => openEditTypeModal(t)}
                      >
                        Редактировать
                      </Button>
                      <Button
                        color="danger"
                        size="sm"
                        className="ml-2"
                        onPress={() => openDeleteTypeModal(t.id)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
            {types.length === 0 && (
              <p className="text-default-400">Нет типов транзакций</p>
            )}
          </div>
        </section>
      )}

      {/* Модалки: Создание категории */}
      <Modal
        isOpen={createCatModal.isOpen}
        onOpenChange={createCatModal.onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Создать категорию</ModalHeader>
              <ModalBody>
                <form onSubmit={handleCreateCategory} id="createCatForm">
                  <Input
                    label="Название"
                    type="text"
                    color="primary"
                    value={newCatName}
                    onChange={handleNewCatNameChange}
                  />
                  <Input
                    label="Машинное имя"
                    type="text"
                    color="primary"
                    className="mt-4"
                    value={newCatMachineName}
                    onChange={(e) => setNewCatMachineName(e.target.value)}
                  />
                </form>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="flat" onPress={onClose}>
                  Отмена
                </Button>
                <Button color="success" form="createCatForm" type="submit">
                  Создать
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Модалки: Редактирование категории */}
      <Modal
        isOpen={editCatModal.isOpen}
        onOpenChange={editCatModal.onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Редактировать категорию</ModalHeader>
              <ModalBody>
                <form onSubmit={saveEditCategory} id="editCatForm">
                  <Input
                    label="Название"
                    type="text"
                    color="primary"
                    value={editCatName}
                    onChange={handleEditCatNameChange}
                  />
                  <Input
                    label="Машинное имя"
                    type="text"
                    color="primary"
                    className="mt-4"
                    value={editCatMachineName}
                    onChange={(e) => setEditCatMachineName(e.target.value)}
                  />
                </form>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="flat" onPress={onClose}>
                  Отмена
                </Button>
                <Button color="success" form="editCatForm" type="submit">
                  Сохранить
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Модалки: Удаление категории */}
      <Modal
        isOpen={deleteCatModal.isOpen}
        onOpenChange={deleteCatModal.onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Удалить категорию</ModalHeader>
              <ModalBody>
                <p>Вы уверены, что хотите удалить эту категорию?</p>
              </ModalBody>
              <ModalFooter>
                <Button color="warning" variant="flat" onPress={onClose}>
                  Отмена
                </Button>
                <Button color="danger" onPress={confirmDeleteCategory}>
                  Удалить
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Модалки: Создание типа транзакции */}
      <Modal
        isOpen={createTypeModal.isOpen}
        onOpenChange={createTypeModal.onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Создать тип транзакции</ModalHeader>
              <ModalBody>
                <form onSubmit={handleCreateType} id="createTypeForm">
                  <Input
                    label="Название"
                    type="text"
                    color="primary"
                    value={newTypeName}
                    onChange={handleNewTypeNameChange}
                  />
                  <Input
                    label="Машинное имя"
                    type="text"
                    color="primary"
                    className="mt-4"
                    value={newTypeMachine}
                    onChange={(e) => setNewTypeMachine(e.target.value)}
                  />
                </form>
              </ModalBody>
              <ModalFooter>
                <Button color="warning" variant="flat" onPress={onClose}>
                  Отмена
                </Button>
                <Button color="success" form="createTypeForm" type="submit">
                  Создать
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Модалки: Редактирование типа транзакции */}
      <Modal
        isOpen={editTypeModal.isOpen}
        onOpenChange={editTypeModal.onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Редактировать тип транзакции</ModalHeader>
              <ModalBody>
                <form onSubmit={saveEditType} id="editTypeForm">
                  <Input
                    label="Название"
                    type="text"
                    color="primary"
                    value={editTypeName}
                    onChange={handleEditTypeNameChange}
                  />
                  <Input
                    label="Машинное имя"
                    type="text"
                    color="primary"
                    className="mt-4"
                    value={editTypeMachineName}
                    onChange={(e) => setEditTypeMachineName(e.target.value)}
                  />
                </form>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="flat" onPress={onClose}>
                  Отмена
                </Button>
                <Button color="success" form="editTypeForm" type="submit">
                  Сохранить
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Модалки: Удаление типа транзакции */}
      <Modal
        isOpen={deleteTypeModal.isOpen}
        onOpenChange={deleteTypeModal.onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Удалить тип транзакции</ModalHeader>
              <ModalBody>
                <p>Вы уверены, что хотите удалить этот тип транзакции?</p>
              </ModalBody>
              <ModalFooter>
                <Button color="warning" variant="flat" onPress={onClose}>
                  Отмена
                </Button>
                <Button color="danger" onPress={confirmDeleteType}>
                  Удалить
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

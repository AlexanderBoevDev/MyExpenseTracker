"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input, Button } from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => setIsVisible((prev) => !prev);

  useEffect(() => {
    if (session?.user) {
      router.push("/user");
    }
  }, [session, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false
    });
    if (res?.ok) {
      router.push("/user");
    } else {
      alert(res?.error || "Ошибка входа");
    }
  };

  return (
    <div
      className="
        min-h-screen
        text-gray-900
        dark:text-gray-100
        flex flex-col mt-10
      "
    >
      <div className="mx-auto w-full max-w-md px-6 py-12 sm:max-w-lg sm:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-2xl/9">
          Войдите в свою учётную запись
        </h2>
        <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-6">
          <Input
            type="email"
            label="Email"
            placeholder="Введите ваш email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            variant="bordered"
            radius="sm"
          />
          <Input
            label="Пароль"
            placeholder="Введите ваш пароль"
            type={isVisible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            variant="bordered"
            radius="sm"
            endContent={
              <button
                type="button"
                onClick={toggleVisibility}
                className="focus:outline-none"
                aria-label="toggle password visibility"
              >
                {isVisible ? (
                  <EyeOff className="text-2xl text-default-400 pointer-events-none" />
                ) : (
                  <Eye className="text-2xl text-default-400 pointer-events-none" />
                )}
              </button>
            }
          />
          <Button
            type="submit"
            color="primary"
            radius="sm"
            className="
              w-full
              bg-blue-600
              hover:bg-blue-700
              text-white
              font-semibold
              text-sm
              shadow-sm
              h-14
            "
          >
            Войти
          </Button>
        </form>
        <p className="mt-10 text-center text-sm text-gray-500 dark:text-gray-400">
          Нет учётной записи?{" "}
          <Link
            href="/signup"
            className="
              font-semibold text-blue-600
              hover:text-blue-500
              dark:text-blue-400
            "
          >
            Создать учётную запись
          </Link>
        </p>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Link,
  Button
} from "@heroui/react";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import ThemeSwitcher from "@/app/theme-switcher";

export const AcmeLogo = () => {
  return (
    <svg fill="none" height="36" viewBox="0 0 32 32" width="36">
      <path
        clipRule="evenodd"
        d="M17.6482 10.1305L15.8785 7.02583L7.02979 22.5499H10.5278L17.6482 10.1305ZM19.8798 14.0457L18.11 17.1983L19.394 19.4511H16.8453L15.1056 22.5499H24.7272L19.8798 14.0457Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
};

export default function NavBar() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <Navbar>
      <NavbarContent>
        <NavbarBrand>
          <Link href="/" className="text-black dark:text-white">
            <AcmeLogo />
            <p className="font-bold text-inherit">Учет расходов и доходов</p>
          </Link>
        </NavbarBrand>
      </NavbarContent>
      <NavbarContent justify="end">
        <div className="flex gap-2 items-center">
          {isAuthenticated ? (
            <>
              <NavbarItem className="hidden lg:flex">
                <Link
                  href="/transactions"
                  className="text-black dark:text-white mr-3"
                >
                  Транзакции
                </Link>
              </NavbarItem>
              <NavbarItem className="hidden lg:flex">
                <Link href="/user" className="text-black dark:text-white mr-3">
                  Учётная запись
                </Link>
              </NavbarItem>
              <NavbarItem>
                <Button
                  as={Link}
                  variant="flat"
                  onClick={() => signOut()}
                  className="bg-zinc-200 text-black dark:bg-zinc-700 dark:text-white ml-6"
                >
                  Выход
                </Button>
              </NavbarItem>
            </>
          ) : (
            <>
              <NavbarItem className="hidden lg:flex">
                <Link href="/login" className="text-black dark:text-white ml-6">
                  Вход
                </Link>
              </NavbarItem>
              <NavbarItem className="hidden lg:flex">
                <Link href="/signup" className="text-black dark:text-white">
                  Создать
                </Link>
              </NavbarItem>
            </>
          )}
          <ThemeSwitcher />
        </div>
      </NavbarContent>
    </Navbar>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { HeroUIProvider } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <SessionProvider>
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
      >
        <HeroUIProvider>{children}</HeroUIProvider>
      </NextThemesProvider>
    </SessionProvider>
  );
}

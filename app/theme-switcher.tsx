"use client";

import { useTheme as useNextTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, SunMoon } from "lucide-react";

/**
 * Один переключатель тем:
 * нажимаем — меняем тему: light -> dark -> system -> light -> ...
 */
export default function ThemeSwitcher() {
  const { setTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  // Храним текущий индекс темы (0=light, 1=dark, 2=system)
  const [themeIndex, setThemeIndex] = useState(0);

  // Массив из трёх тем: каждая со своим названием и иконкой
  const themes = [
    { name: "light", icon: <Sun /> },
    { name: "dark", icon: <Moon /> },
    { name: "system", icon: <SunMoon /> }
  ];

  // При клике двигаем индекс по кругу, вызываем setTheme(...)
  const toggleTheme = () => {
    const nextIndex = (themeIndex + 1) % themes.length;
    setThemeIndex(nextIndex);
    setTheme(themes[nextIndex].name); // "light" | "dark" | "system"
  };

  // Пока не смонтируется, theme может быть undefined
  useEffect(() => {
    setMounted(true);
  }, []);

  // Если не смонтировался, ничего не рендерим
  if (!mounted) return null;

  return (
    <button onClick={toggleTheme} className="ml-4">
      {themes[themeIndex].icon}
    </button>
  );
}

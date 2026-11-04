"use client";

import React, { createContext, useContext, useSyncExternalStore, useCallback } from "react";

export type Theme = "light" | "dark" | "system";

export interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const STORAGE_KEY = "straightmoney-theme";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === "light" || val === "dark" || val === "system") {
      return val;
    }
  } catch {
    // localStorage may be inaccessible in sandboxes
  }
  return "system";
}

function subscribeTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    media.removeEventListener("change", callback);
  };
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore<Theme>(
    subscribeTheme,
    getStoredTheme,
    (): Theme => "system"
  );

  const getResolvedTheme = useCallback((): "light" | "dark" => {
    if (typeof window === "undefined") return "light";
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return theme === "dark" ? "dark" : "light";
  }, [theme]);

  const resolvedTheme = getResolvedTheme();

  const applyThemeToDOM = (targetTheme: "light" | "dark") => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-theme", targetTheme);
    if (targetTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // localStorage may fail
    }
    let target: "light" | "dark" = "light";
    if (newTheme === "system") {
      target = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      target = newTheme;
    }
    applyThemeToDOM(target);
    window.dispatchEvent(new Event("storage"));
  };

  const toggleTheme = () => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
        isDark: resolvedTheme === "dark",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

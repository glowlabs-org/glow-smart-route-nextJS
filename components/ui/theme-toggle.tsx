"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

const THEME_TOGGLE_ARIA_LABELS: Record<Lang, (isDark: boolean) => string> = {
  en: (isDark) => `Switch to ${isDark ? "light" : "dark"} mode`,
  ko: (isDark) => `${isDark ? "라이트" : "다크"} 모드로 전환`,
  zh: (isDark) => `切换到${isDark ? "浅色" : "深色"}模式`,
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { lang } = useLang();
  const [mounted, setMounted] = useState(false);

  // Handle mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "relative inline-flex h-8 w-14 lg:h-10 lg:w-20 items-center rounded-full bg-muted border border-border flex-shrink-0",
          className
        )}
      >
        <div className="absolute left-1 lg:left-1.5 h-6 w-6 lg:h-7 lg:w-7 rounded-full bg-background shadow-sm" />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";
  const ariaLabel = THEME_TOGGLE_ARIA_LABELS[lang](isDark);

  return (
    <button
      className={cn(
        "relative inline-flex h-8 w-14 lg:h-10 lg:w-20 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isDark
          ? "bg-muted border border-border"
          : "bg-muted border border-border",
        className
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={ariaLabel}
    >
      {/* Track icons */}
      <span className="absolute inset-0 flex items-center justify-between px-1.5 lg:px-2.5">
        <Sun
          className={cn(
            "h-4 w-4 lg:h-5 lg:w-5 transition-opacity duration-200",
            isDark ? "opacity-50" : "opacity-0"
          )}
        />
        <Moon
          className={cn(
            "h-4 w-4 lg:h-5 lg:w-5 transition-opacity duration-200",
            isDark ? "opacity-0" : "opacity-50"
          )}
        />
      </span>

      {/* Sliding thumb with icon */}
      <span
        className={cn(
          "absolute h-6 w-6 lg:h-7 lg:w-7 rounded-full bg-background shadow-sm transition-transform duration-200 flex items-center justify-center",
          isDark
            ? "translate-x-7 lg:translate-x-[46px]"
            : "translate-x-1 lg:translate-x-1.5"
        )}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-foreground" />
        ) : (
          <Sun className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-foreground" />
        )}
      </span>
    </button>
  );
}

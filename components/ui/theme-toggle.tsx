"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Handle mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "relative inline-flex h-8 w-14 lg:h-10 lg:w-20 items-center rounded-full bg-muted border border-border",
          className
        )}
      >
        <div className="absolute left-1 lg:left-1.5 h-6 w-6 lg:h-7 lg:w-7 rounded-full bg-background shadow-sm" />
      </div>
    );
  }

  const isDark = theme === "dark";

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
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {/* Track icons */}
      <span className="absolute inset-0 flex items-center justify-between px-1.5 lg:px-2.5">
        <Sun
          className={cn(
            "h-4 w-4 lg:h-5 lg:w-5 transition-opacity duration-200",
            isDark ? "opacity-50" : "opacity-100 text-muted-foreground"
          )}
        />
        <Moon
          className={cn(
            "h-4 w-4 lg:h-5 lg:w-5 transition-opacity duration-200",
            isDark ? "opacity-100 text-muted-foreground" : "opacity-50"
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

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
          "relative inline-flex h-8 w-14 items-center rounded-full bg-muted border border-border",
          className
        )}
      >
        <div className="absolute left-1 h-6 w-6 rounded-full bg-background shadow-sm" />
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      className={cn(
        "relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isDark
          ? "bg-muted border border-border"
          : "bg-muted border border-border",
        className
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {/* Track icons */}
      <span className="absolute inset-0 flex items-center justify-between px-1.5">
        <Sun
          className={cn(
            "h-4 w-4 transition-opacity duration-200",
            isDark ? "opacity-50" : "opacity-100 text-muted-foreground"
          )}
        />
        <Moon
          className={cn(
            "h-4 w-4 transition-opacity duration-200",
            isDark ? "opacity-100 text-muted-foreground" : "opacity-50"
          )}
        />
      </span>

      {/* Sliding thumb with icon */}
      <span
        className={cn(
          "absolute h-6 w-6 rounded-full bg-background shadow-sm transition-transform duration-200 flex items-center justify-center",
          isDark ? "translate-x-7" : "translate-x-1"
        )}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-foreground" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-foreground" />
        )}
      </span>
    </button>
  );
}

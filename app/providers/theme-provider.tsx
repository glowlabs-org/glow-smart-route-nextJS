"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: "class" | "data-theme" | "data-mode";
  defaultTheme?: string;
  enableSystem?: boolean;
  storageKey?: string;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute={props.attribute ?? "class"}
      defaultTheme={props.defaultTheme ?? "system"}
      enableSystem={props.enableSystem ?? true}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

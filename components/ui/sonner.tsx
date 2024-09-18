"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            " toast group-[.toaster]:font-light  group-[.toaster]:rounded-none group group-[.toaster]:bg-white group-[.toaster]:bg-opacity-70 group-[.toaster]:text-secondary group-[.toaster]:border-border group-[.toaster]:border-[#E2E2E2] group-[.toaster]:shadow-lg",
          description: "",
          actionButton:
            "group-[.toast]:bg-secondary group-[.toast]:text-white group-[.toast]:rounded-none",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-none",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

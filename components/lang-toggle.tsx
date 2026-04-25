"use client";

import * as React from "react";
import { Check, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  LANGUAGE_META,
  SUPPORTED_LANGS,
  useLang,
  type Lang,
} from "@/lib/i18n";

interface LangToggleProps {
  className?: string;
  triggerClassName?: string;
}

export function LangToggle({ className, triggerClassName }: LangToggleProps) {
  const { lang, setLang, t } = useLang();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const current = LANGUAGE_META[lang];

  return (
    <div className={cn("inline-flex", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={t.common.switchLanguage}
            title={t.common.switchLanguage}
            className={cn(
              "border-border/20 dark:border-border/40 gap-1.5 px-2.5",
              triggerClassName,
            )}
          >
            <Languages className="h-4 w-4 opacity-70" aria-hidden="true" />
            <span className="text-xs font-mono uppercase">
              {mounted ? lang : "en"}
            </span>
            <span className="sr-only">{current.label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[10rem]">
          {SUPPORTED_LANGS.map((code) => {
            const meta = LANGUAGE_META[code];
            const isActive = code === lang;
            return (
              <DropdownMenuItem
                key={code}
                onSelect={() => setLang(code as Lang)}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2">
                  <span className="text-base leading-none" aria-hidden="true">
                    {meta.flag}
                  </span>
                  <span>{meta.label}</span>
                </span>
                {isActive ? (
                  <Check className="h-4 w-4 opacity-70" aria-hidden="true" />
                ) : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

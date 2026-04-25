"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/telemetry";
import { useAccount } from "wagmi";
import { useLang } from "@/lib/i18n";

export default function GlowFaqWidget({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "minimal";
}) {
  const { t } = useLang();
  const { address, isConnected } = useAccount();
  const walletAddress = address?.toLowerCase() ?? null;
  const source = "glow_faq_widget";
  const faqItems = t.widgets.faq.items;
  const [activeId, setActiveId] = useState<string>(faqItems[0]?.id ?? "");
  const isMinimal = variant === "minimal";

  const activeItem = faqItems.find((item) => item.id === activeId);

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden h-full min-h-[350px]",
        isMinimal
          ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl"
          : "bg-card dark:bg-card border-border/20 dark:border-border/40",
        className
      )}
    >
      <CardHeader
        className={cn(
          "pb-4 shrink-0",
          isMinimal ? "border-b-0 px-4" : "border-b border-border/20 dark:border-border/40"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 font-semibold">{t.widgets.faq.widgetTitle}</CardTitle>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 bg-muted/30 dark:bg-muted/50 px-2 py-1 rounded-lg">
            {t.widgets.faq.widgetTag}
          </span>
        </div>
      </CardHeader>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Left Side: Questions List */}
        <div className="w-full md:w-[40%] border-b md:border-b-0 md:border-r border-border/20 dark:border-border/40 bg-muted/10 dark:bg-muted/20">
          <ScrollArea className="h-full">
            <div className="flex flex-col p-2 gap-1">
              {faqItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    trackEvent("dashboard_faq_item_select", {
                      source,
                      wallet_connected: isConnected,
                      wallet_address: walletAddress,
                      faq_id: item.id,
                    });
                    setActiveId(item.id);
                  }}
                  className={cn(
                    "relative text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 group flex items-center justify-between",
                    activeId === item.id
                      ? "bg-muted/50 dark:bg-muted/60 text-foreground font-medium"
                      : "text-muted-foreground/60 dark:text-muted-foreground/80 hover:bg-muted/30 dark:hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  <span className="line-clamp-2 pr-2">{item.q}</span>
                  {activeId === item.id && (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 dark:text-muted-foreground/80" />
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right Side: Answer Display */}
        <div className="flex-1 relative">
          <ScrollArea className="h-full">
            <div className="p-6 md:p-8 pt-4 md:pt-4">
              {activeItem ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <h3 className="text-lg font-semibold mb-4 text-foreground tracking-tight">
                    {activeItem.q}
                  </h3>
                  <div className="text-sm leading-relaxed text-muted-foreground/80 dark:text-muted-foreground space-y-4">
                    {activeItem.paragraphs.map((paragraph, i) => (
                      <p key={`p-${i}`}>{paragraph}</p>
                    ))}
                    {activeItem.bullets && activeItem.bullets.length > 0 && (
                      <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                        {activeItem.bullets.map((bullet, i) => (
                          <li key={`b-${i}`}>
                            <strong className="text-foreground">{bullet.label}</strong>{" "}
                            {bullet.text}
                          </li>
                        ))}
                      </ul>
                    )}
                    {activeItem.callout && (
                      <div className="p-4 rounded-xl bg-background/50 border text-sm">
                        {activeItem.callout}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground/60 dark:text-muted-foreground/80 text-xs font-mono uppercase tracking-widest">
                  {t.widgets.faq.selectQuestion}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </Card>
  );
}

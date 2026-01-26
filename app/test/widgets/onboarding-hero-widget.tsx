"use client";

import * as React from "react";
import { CreditCard } from "lucide-react";
import { useAccount } from "wagmi";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GlowSymbol } from "@/components/glow-symbol";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/telemetry";

interface OnboardingHeroWidgetProps {
  className?: string;
  variant?: "default" | "minimal";
  onBuyGlowClick?: () => void;
}

export default function OnboardingHeroWidget({
  className,
  variant = "default",
  onBuyGlowClick,
}: OnboardingHeroWidgetProps) {
  const { isConnected, address } = useAccount();
  const walletAddress = address?.toLowerCase() ?? null;
  const source = "onboarding_hero_widget";
  const isMinimal = variant === "minimal";

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col gap-4 overflow-hidden pt-6 pb-0",
        isMinimal
          ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl"
          : "bg-card dark:bg-card border-border/20",
        className
      )}
    >
      {/* Background Decor: Glow Logo Watermark - Repositioned to not block text */}
      <div className="absolute -right-20 -top-40 opacity-[0.04] dark:opacity-[0.06] pointer-events-none select-none">
        <GlowSymbol className="h-[500px] w-[500px] text-foreground rotate-12" />
      </div>

      <CardHeader className="py-0 px-6">
        <div className="flex items-center justify-center md:justify-start gap-2">
          <div className="h-2 w-2 rounded-full bg-[color:var(--color-glow-green)] animate-pulse shadow-[0_0_8px_var(--color-glow-green)]" />
          <span className="text-xs font-mono font-semibold tracking-widest uppercase text-muted-foreground/60 dark:text-muted-foreground/80">
            New to Glow? Start Here
          </span>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 flex flex-1 flex-col gap-4 px-6 pb-6">
        <div className="flex flex-1 items-center">
          <div className="max-w-4xl relative w-full">
            <h2
              className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.5rem] leading-[1.2] tracking-tight text-foreground text-center md:text-left"
              style={{ fontFamily: "Duplicate Slab, serif" }}
            >
              <span className="italic">"If everyone in the world owned</span>{" "}
              <span className="text-[color:var(--color-glow-orange)] underline decoration-[color:var(--color-glow-orange)]/40 underline-offset-4 decoration-2 font-semibold not-italic whitespace-nowrap">
                $20 of GLW
              </span>
              <span className="italic">
                , we could eliminate fossil fuels by 2030."
              </span>
            </h2>

            <div className="mt-4 flex items-center justify-center md:justify-start gap-3">
              <div className="h-px w-8 bg-border/40 dark:bg-border/60" />
              <p className="text-sm font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                David Vorick, CEO
              </p>
            </div>
          </div>
        </div>

        <div className="shrink-0 mt-auto">
          {isConnected ? (
            <Button
              onClick={() => {
                trackEvent("dashboard_buy_glw_click", {
                  source,
                  wallet_connected: true,
                  wallet_address: walletAddress,
                });
                onBuyGlowClick?.();
              }}
              className="group w-full h-11 font-mono font-bold text-xs"
            >
              Buy GLW
            </Button>
          ) : (
            <Button
              onClick={() => {
                trackEvent("dashboard_buy_glw_click", {
                  source,
                  wallet_connected: false,
                  wallet_address: walletAddress,
                });
                onBuyGlowClick?.();
              }}
              className="group w-full h-11 font-mono font-bold text-xs"
            >
              <CreditCard className="mr-2 h-4 w-4 opacity-70 group-hover:opacity-100" />
              Buy GLW
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

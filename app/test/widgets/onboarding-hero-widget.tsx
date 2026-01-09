"use client";

import * as React from "react";
import { ConnectKitButton } from "connectkit";
import { Wallet, CreditCard } from "lucide-react";
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
        "relative flex h-full flex-col gap-4 overflow-hidden",
        isMinimal
          ? "bg/muted dark:bg-muted/20 p-6 dark:border-border"
          : "bg-card dark:bg-muted/20 border-foreground/10 dark:border-border",
        className
      )}
    >
      {/* Background Decor: Glow Logo Watermark - Repositioned to not block text */}
      <div className="absolute -right-20 -top-40 opacity-[0.03] dark:opacity-[0.03] pointer-events-none select-none">
        <GlowSymbol className="h-[500px] w-[500px] text-foreground dark:text-white rotate-12" />
      </div>

      <CardHeader className={cn("pb-0", isMinimal && "px-0 pt-0")}>
        <div className="text-muted-foreground dark:text-white/60">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-glow-green)] animate-pulse shadow-[0_0_8px_var(--color-glow-green)]" />
            <span className="text-xs md:text-sm font-mono font-bold tracking-[0.2em] uppercase text-foreground dark:text-white/90">
              New to Glow? Start Here
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent
        className={cn(
          "relative z-10 flex flex-1 min-h-0 flex-col gap-4 pt-0",
          isMinimal && "px-0 pb-0"
        )}
      >
        <div className="flex flex-1 min-h-0 items-center">
          <div className="max-w-4xl relative w-full">
            <h2
              className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.5rem] leading-[1.2] tracking-tight text-foreground/95 dark:text-white/95 text-center md:text-left"
              style={{ fontFamily: "Duplicate Slab, serif" }}
            >
              <span className="italic">“If everyone in the world owned</span>{" "}
              <span className="text-[color:var(--color-glow-orange)] underline decoration-[color:var(--color-glow-orange)]/30 underline-offset-4 decoration-1 font-normal not-italic whitespace-nowrap">
                $20 of GLW
              </span>
              <span className="italic">
                , we could eliminate fossil fuels by 2030.”
              </span>
            </h2>

            <div className="mt-3 flex items-center justify-center md:justify-start gap-3">
              <div className="h-px w-6 bg-border dark:bg-white/20" />
              <p className="text-sm sm:text-base text-muted-foreground dark:text-white/50 font-sans tracking-wide">
                David Vorick, CEO
              </p>
            </div>
          </div>
        </div>

        <div className="shrink-0">
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
              className="group w-full h-12 font-mono font-bold text-base"
            >
              Buy GLW
            </Button>
          ) : (
            <div className="grid grid-cols-1  gap-3">
              <Button
                onClick={() => {
                  trackEvent("dashboard_buy_glw_click", {
                    source,
                    wallet_connected: false,
                    wallet_address: walletAddress,
                  });
                  onBuyGlowClick?.();
                }}
                className="group w-full h-12 font-mono font-bold text-base"
              >
                <CreditCard className="mr-2 h-4 w-4 sm:h-5 sm:w-5 opacity-70 group-hover:opacity-100" />
                Buy GLW
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

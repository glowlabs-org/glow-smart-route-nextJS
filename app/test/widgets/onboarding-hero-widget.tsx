"use client";

import * as React from "react";
import { ConnectKitButton } from "connectkit";
import { Wallet, CreditCard, ArrowRight } from "lucide-react";
import { useAccount } from "wagmi";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BuyGlowDialog } from "@/components/dialogs/buy-glow-dialog";
import { GlowSymbol } from "@/components/glow-symbol";
import { cn } from "@/lib/utils";
import { useGlowSpotPrice } from "@/hooks/useGlowSpotPrice";

interface OnboardingHeroWidgetProps {
  className?: string;
}

export default function OnboardingHeroWidget({
  className,
}: OnboardingHeroWidgetProps) {
  const [isBuyOpen, setIsBuyOpen] = React.useState(false);
  const { spotPrice: glwSpotPrice } = useGlowSpotPrice();
  const { isConnected } = useAccount();

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col overflow-hidden bg-card dark:bg-muted/20 border-foreground/10 dark:border-border",
        className
      )}
    >
      {/* Background Decor: Glow Logo Watermark - Repositioned to not block text */}
      <div className="absolute -right-20 -top-40 opacity-[0.05] dark:opacity-[0.03] pointer-events-none select-none mix-blend-screen">
        <GlowSymbol className="h-[500px] w-[500px] text-foreground dark:text-white rotate-12" />
      </div>

      {/* Main Content Container - Reduced vertical padding to fit buttons */}
      <CardContent className="relative z-10 flex flex-col h-full p-6 sm:p-7 md:p-8">
        {/* Header Labels - Reduced margin-bottom */}
        <div className="mb-4 sm:mb-6 text-muted-foreground dark:text-white/60">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-glow-green)] animate-pulse shadow-[0_0_8px_var(--color-glow-green)]" />
              <span className="text-[10px] md:text-xs font-mono font-bold tracking-[0.2em] uppercase text-foreground dark:text-white/90">
                Start Here
              </span>
            </div>
            <span className="text-[10px] md:text-xs font-mono tracking-[0.2em] uppercase">
              Mission
            </span>
          </div>
        </div>

        {/* The Quote - Adjusted size to fit within 340px container */}
        <div className="max-w-4xl relative">
          <h2
            className="text-xl sm:text-2xl md:text-3xl lg:text-[2rem] leading-[1.2] tracking-tight text-foreground/95 dark:text-white/95"
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

          <div className="mt-3 sm:mt-4 flex items-center gap-3">
            <div className="h-px w-6 bg-border dark:bg-white/20" />
            <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/50 font-sans tracking-wide">
              David Vorick, CEO
            </p>
          </div>
        </div>

        {/* Action Buttons Area - Pushed to bottom with mt-auto */}
        <div className="mt-auto pt-6">
          {isConnected ? (
            <Button
              onClick={() => setIsBuyOpen(true)}
              className="group w-full h-11 sm:h-12"
            >
              Buy GLW
            </Button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <ConnectKitButton.Custom>
                {({ show }) => (
                  <Button
                    onClick={show}
                    className="group relative w-full h-11 sm:h-12"
                  >
                    <Wallet className="mr-2 h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:-rotate-12" />
                    Connect Wallet
                  </Button>
                )}
              </ConnectKitButton.Custom>

              <Button
                onClick={() => setIsBuyOpen(true)}
                variant="outline"
                className="group w-full h-11 sm:h-12"
              >
                <CreditCard className="mr-2 h-4 w-4 sm:h-5 sm:w-5 opacity-70 group-hover:opacity-100" />
                Buy GLW
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      <BuyGlowDialog
        key={isBuyOpen ? "buy-glow-open" : "buy-glow-closed"}
        open={isBuyOpen}
        onOpenChange={setIsBuyOpen}
        usdcBalance={null}
        glowSpotPrice={glwSpotPrice || 0}
        defaultUsdcAmount="20"
      />
    </Card>
  );
}

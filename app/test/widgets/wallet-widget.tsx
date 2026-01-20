"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Send } from "lucide-react";
import { useAccount, useChainId } from "wagmi";

import { Button } from "@/components/ui/button";
import { SwapDialog } from "@/components/dialogs/swap-dialog";
import { SendDialog } from "@/components/send-dialog";
import { cn } from "@/lib/utils";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { trackEvent } from "@/lib/telemetry";
import { GlowSymbol } from "@/components/glow-symbol";
import { useWalletPortfolio } from "./use-wallet-portfolio";

const TOKEN_ICON_SRC_BY_SYMBOL = {
  ETH: "/images/tokens/eth.svg",
  USDC: "/images/tokens/usdc.svg",
} as const;

const HOLDING_FALLBACK_BY_SYMBOL = {
  GLW: {
    letter: "G",
    bgClassName: "bg-emerald-500/20",
    ringClassName: "ring-emerald-500/30",
    textClassName: "text-emerald-500",
  },
  USDG: {
    letter: "U",
    bgClassName: "bg-muted-foreground/10",
    ringClassName: "ring-muted-foreground/30",
    textClassName: "text-muted-foreground",
  },
} as const;

function HoldingIcon(props: { symbol: "ETH" | "GLW" | "USDC" | "USDG" }) {
  const { symbol } = props;

  if (symbol === "GLW") {
    return (
      <div className="h-6 w-6 rounded-full bg-muted border border-foreground/10 flex items-center justify-center">
        <GlowSymbol className="h-4 w-4" />
      </div>
    );
  }

  const iconSrc =
    symbol === "ETH" || symbol === "USDC"
      ? TOKEN_ICON_SRC_BY_SYMBOL[symbol]
      : null;

  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt={`${symbol} token`}
        className="h-6 w-6 rounded-full"
        draggable={false}
      />
    );
  }

  const fallback =
    symbol === "USDG" ? HOLDING_FALLBACK_BY_SYMBOL[symbol] : null;
  const letter = fallback?.letter ?? symbol.slice(0, 1);

  return (
    <div
      className={cn(
        "h-6 w-6 rounded-full ring-1 flex items-center justify-center",
        fallback?.bgClassName ?? "bg-muted/30",
        fallback?.ringClassName ?? "ring-foreground/15"
      )}
    >
      <span
        className={cn(
          "text-[11px] font-mono font-bold leading-none",
          fallback?.textClassName ?? "text-foreground/90"
        )}
      >
        {letter}
      </span>
    </div>
  );
}

function formatHoldingAmount(
  symbol: "ETH" | "GLW" | "USDC" | "USDG",
  value: number
) {
  if (!Number.isFinite(value) || value <= 0) return "0";

  if (symbol === "ETH") {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: value < 1 ? 0 : 2,
      maximumFractionDigits: value < 1 ? 4 : 2,
    });
  }

  if (symbol === "GLW") {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: value < 100 ? 2 : 0,
      maximumFractionDigits: value < 100 ? 2 : 0,
    });
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface WalletWidgetProps {
  walletAddress?: string | null;
  variant?: "default" | "minimal";
}

export default function WalletWidget({
  walletAddress,
  variant = "default",
}: WalletWidgetProps) {
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const isMinimal = variant === "minimal";
  const [isSwapOpen, setIsSwapOpen] = React.useState(false);
  const [isSendOpen, setIsSendOpen] = React.useState(false);
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "wallet_widget";

  const { hasWallet, glowPriceUsd, marketCapUsd, ethPriceInUSD, holdings } =
    useWalletPortfolio({ walletAddress });

  const holdingsRows = React.useMemo(() => {
    const bySymbol = new Map(
      holdings.map((h) => [h.symbol, h.amount] as const)
    );
    return (["GLW", "ETH", "USDC", "USDG"] as const).map((symbol) => ({
      symbol,
      amount: bySymbol.get(symbol) ?? 0,
    }));
  }, [holdings]);

  const handleSwapOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setIsSwapOpen(nextOpen);
      if (nextOpen) return;
      if (!walletAddress) return;

      void (async () => {
        try {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.balances.tokens(chainId, walletAddress),
            }),
            queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.impact.glowWorth(walletAddress),
            }),
            queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.impact.scoreBreakdown(walletAddress),
            }),
          ]);
        } catch {}
      })();
    },
    [chainId, queryClient, walletAddress]
  );

  if (!hasWallet) return null;

  return (
    <>
      <div className={cn("flex flex-col h-full w-full", !isMinimal && "p-4")}>
        <div className="text-sm md:text-lg text-center font-semibold tracking-tight text-foreground mb-4">
          Your Wallet
        </div>

        <div className="flex-1 flex flex-col justify-center gap-2">
          {holdingsRows.map((row) => {
            const displayValue = formatHoldingAmount(row.symbol, row.amount);

            return (
              <div
                key={row.symbol}
                className="flex items-center justify-between gap-3 group cursor-default py-1.5 px-2 rounded-xl hover:bg-muted/20 transition-colors w-full overflow-hidden"
              >
                <div className="flex items-center gap-3 shrink-0">
                  <HoldingIcon symbol={row.symbol} />
                  <span className="text-sm font-mono text-muted-foreground group-hover:text-foreground/80 transition-colors">
                    {row.symbol}
                  </span>
                </div>
                <span
                  className="text-sm font-mono font-medium tabular-nums text-foreground truncate ml-auto"
                  title={displayValue}
                >
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-auto pt-4 grid gap-2">
          <Button
            className="flex-1 gap-2"
            onClick={() => {
              trackEvent("dashboard_swap_open_click", {
                source,
                wallet_connected: Boolean(normalizedWalletAddress),
                wallet_address: normalizedWalletAddress,
                chain_id: chainId,
                cta: "swap",
              });
              setIsSwapOpen(true);
            }}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Swap</span>
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => {
              trackEvent("dashboard_send_open_click", {
                source,
                wallet_connected: Boolean(normalizedWalletAddress),
                wallet_address: normalizedWalletAddress,
                chain_id: chainId,
              });
              setIsSendOpen(true);
            }}
          >
            <Send className="h-3.5 w-3.5" />
            <span>Send</span>
          </Button>
        </div>
      </div>

      <SwapDialog
        open={isSwapOpen}
        onOpenChange={handleSwapOpenChange}
        glowPriceUsd={glowPriceUsd}
        marketCapUsd={marketCapUsd}
        ethPriceInUSD={ethPriceInUSD}
      />
      <SendDialog open={isSendOpen} onOpenChange={setIsSendOpen} />
    </>
  );
}

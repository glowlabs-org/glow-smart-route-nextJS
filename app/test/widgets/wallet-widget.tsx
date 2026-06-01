"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useChainId } from "wagmi";
import { formatUnits } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SwapDialog } from "@/components/dialogs/swap-dialog";
import { SendDialog } from "@/components/send-dialog";
import { cn } from "@/lib/utils";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { trackEvent } from "@/lib/telemetry";
import { GlowSymbol } from "@/components/glow-symbol";
import { useWallets, useWalletRegionAvailableStakeMap } from "@/hooks";
import { useWalletPortfolio } from "./use-wallet-portfolio";
import { useLang } from "@/lib/i18n";

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
  const { t } = useLang();
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const isMinimal = variant === "minimal";
  const [isSwapOpen, setIsSwapOpen] = React.useState(false);
  const [isSendOpen, setIsSendOpen] = React.useState(false);
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "wallet_widget";

  const { hasWallet, glowPriceUsd, marketCapUsd, ethPriceInUSD, holdings } =
    useWalletPortfolio({ walletAddress });

  // sGCTL free to delegate = staked GCTL not locked in any vault, summed across
  // the wallet's regions (mirrors the gctl-heatmap "available" figure).
  const { walletDetails } = useWallets({
    walletAddress: walletAddress ?? undefined,
    enabled: hasWallet,
    includeMintedEvents: false,
    includeStakeEvents: false,
    includeMigrationAmount: false,
  });
  const regionIds = React.useMemo(
    () => (walletDetails?.regions ?? []).map((region) => region.regionId),
    [walletDetails?.regions]
  );
  const { availableStakedGctlByRegion } = useWalletRegionAvailableStakeMap({
    walletAddress: walletAddress ?? undefined,
    regionIds,
    enabled: hasWallet,
  });
  const freeSgctl = React.useMemo(() => {
    let totalWei = 0n;
    availableStakedGctlByRegion.forEach((wei) => {
      totalWei += wei;
    });
    return Number(formatUnits(totalWei, DECIMALS_BY_TOKEN.GCTL));
  }, [availableStakedGctlByRegion]);

  const sgctlDisplay =
    freeSgctl > 0
      ? freeSgctl.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0";

  const holdingsRows = React.useMemo(() => {
    const bySymbol = new Map(
      holdings.map((h) => [h.symbol, h.amount] as const)
    );
    return (["GLW", "ETH", "USDC", "USDG"] as const)
      .map((symbol) => ({
        symbol,
        amount: bySymbol.get(symbol) ?? 0,
      }))
      .filter((row) => row.amount > 0);
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
      <Card
        className={cn(
          "flex flex-col w-full h-full overflow-hidden pt-6 pb-0",
          isMinimal
            ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl"
            : "bg-card dark:bg-card border-border/20"
        )}
      >
        <CardHeader className="py-0 px-6">
          <div className="flex items-center justify-center">
            <div className="text-sm md:text-lg font-semibold tracking-tight text-foreground">
              {t.widgets.walletWidget.title}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col flex-1 gap-3 px-6 py-0 pb-6">
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

          {freeSgctl > 0 && (
            <div
              className="flex items-center justify-between gap-3 group cursor-default py-1.5 px-2 rounded-xl hover:bg-muted/20 transition-colors w-full overflow-hidden"
              title="sGCTL free to delegate (staked GCTL not locked in a vault)"
            >
              <div className="flex items-center gap-3 shrink-0">
                <div className="h-6 w-6 rounded-full ring-1 ring-amber-500/30 bg-amber-500/20 flex items-center justify-center">
                  <Shield className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <span className="text-sm font-mono text-muted-foreground group-hover:text-foreground/80 transition-colors">
                  sGCTL
                </span>
              </div>
              <span
                className="text-sm font-mono font-medium tabular-nums text-foreground truncate ml-auto"
                title={sgctlDisplay}
              >
                {sgctlDisplay}
              </span>
            </div>
          )}

        <div className="pt-4 grid grid-cols-2 gap-2 mt-auto">
          <Button
            className="h-11"
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
            {t.widgets.walletWidget.swap}
          </Button>
          <Button
            variant="outline"
            className="h-11"
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
            {t.widgets.walletWidget.send}
          </Button>
        </div>
      </CardContent>
      </Card>

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

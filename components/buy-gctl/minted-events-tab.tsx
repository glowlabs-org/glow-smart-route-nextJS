import React from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { formatUnits } from "viem";
import { getCurrencyDecimals, getDisplayDecimals } from "@/lib/currency";
import { MintedEvent } from "@glowlabs-org/utils/browser";
import { useLang } from "@/lib/i18n";

interface MintedEventsTabProps {
  mintedEvents: MintedEvent[];
  dataLoading: boolean;
  maxItems?: number;
}

export function MintedEventsTab({
  mintedEvents,
  dataLoading,
  maxItems,
}: MintedEventsTabProps) {
  const { t } = useLang();
  const et = t.routes.eventTabs;
  const displayedEvents = maxItems ? mintedEvents.slice(0, maxItems) : mintedEvents;

  if (dataLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-4 animate-pulse"
          >
            <div className="h-9 w-9 rounded-lg bg-muted/50 dark:bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-muted/50 dark:bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted/50 dark:bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (mintedEvents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 bg-muted/50 dark:bg-muted/30 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-6 h-6 text-muted-foreground/60" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {et.noMintedEventsTitle}
        </h3>
        <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">
          {et.noMintedEventsDesc}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayedEvents.map((event) => {
        const gctlAmount = parseFloat(
          formatUnits(BigInt(event.gctlMinted), 6)
        ).toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });

        const originalAmount = parseFloat(
          formatUnits(
            BigInt(event.amountRaw),
            getCurrencyDecimals(event.currency)
          )
        ).toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: getDisplayDecimals(event.currency),
        });

        const displayCurrency = event.currency === "USDG" ? "USDC" : event.currency;
        const walletShort = `${event.wallet.slice(0, 6)}...${event.wallet.slice(-4)}`;
        const etherscanWalletUrl = `https://etherscan.io/address/${event.wallet}`;
        const etherscanTxUrl = `https://etherscan.io/tx/${event.txId}`;

        return (
          <div
            key={event.txId}
            className="group p-4 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 hover:bg-muted/40 dark:hover:bg-muted/60 transition-colors"
          >
            {/* Top row: Amount + From */}
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {gctlAmount}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  GCTL
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-mono tabular-nums text-muted-foreground">
                  {et.fromAmount(originalAmount, displayCurrency)}
                </span>
              </div>
            </div>

            {/* Bottom row: Wallet + Date + Tx link */}
            <div className="flex items-center justify-between text-xs">
              <a
                href={etherscanWalletUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                {walletShort}
                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <div className="flex items-center gap-3 text-muted-foreground/60">
                <span>
                  {new Date(event.ts).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  {" · "}
                  {new Date(event.ts).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <a
                  href={etherscanTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Clock, ArrowUpRight, Zap } from "lucide-react";
import { formatUnits } from "viem";
import { Region, StakedEvent } from "@glowlabs-org/utils/browser";
import { cn } from "@/lib/utils";
import { useLang, type Strings } from "@/lib/i18n";

type EventTabsLabels = Strings["routes"]["eventTabs"];

interface StakedEventsTabProps {
  stakedEvents: StakedEvent[];
  dataLoading: boolean;
  regions: Region[];
  isRegionsLoading: boolean;
  maxItems?: number;
}

// Timer component for staked events
const StakedTimer = ({
  stakedAt,
  labels,
}: {
  stakedAt: string;
  labels: EventTabsLabels;
}) => {
  const [elapsed, setElapsed] = useState<string>("");

  useEffect(() => {
    const updateElapsed = () => {
      const now = new Date();
      const stakeTime = new Date(stakedAt);
      const diffMs = now.getTime() - stakeTime.getTime();

      const minutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        setElapsed(labels.daysHoursAgo(String(days), String(hours % 24)));
      } else if (hours > 0) {
        setElapsed(labels.hoursMinutesAgo(String(hours), String(minutes % 60)));
      } else if (minutes > 0) {
        setElapsed(labels.minutesAgo(String(minutes)));
      } else {
        setElapsed(labels.justNow);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [stakedAt, labels]);

  return (
    <div className="flex items-center space-x-1 text-xs text-muted-foreground">
      <Clock className="w-3 h-3" />
      <span>{elapsed}</span>
    </div>
  );
};

export function StakedEventsTab({
  stakedEvents,
  dataLoading,
  regions,
  isRegionsLoading,
  maxItems,
}: StakedEventsTabProps) {
  const { t } = useLang();
  const et = t.routes.eventTabs;
  const displayedEvents = maxItems ? stakedEvents.slice(0, maxItems) : stakedEvents;

  if (dataLoading || isRegionsLoading) {
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

  if (stakedEvents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 bg-muted/50 dark:bg-muted/30 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Zap className="w-6 h-6 text-muted-foreground/60" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {et.noStakingEventsTitle}
        </h3>
        <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">
          {et.noStakingEventsDesc}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayedEvents.map((event) => {
        const region = regions.find((r) => r.id === event.regionId);
        const eventDirection = event.direction || "unknown";
        const isStake = eventDirection === "stake";
        const isUnstake = eventDirection === "unstake";

        const amount = event.amount
          ? parseFloat(formatUnits(BigInt(event.amount), 6)).toLocaleString(
              undefined,
              { minimumFractionDigits: 0, maximumFractionDigits: 2 }
            )
          : "—";

        const regionName =
          region?.name || et.regionFallback(String(event.regionId || "?"));
        const walletShort = event.wallet
          ? `${event.wallet.slice(0, 6)}...${event.wallet.slice(-4)}`
          : "—";
        const etherscanWalletUrl = event.wallet
          ? `https://etherscan.io/address/${event.wallet}`
          : "#";

        return (
          <div
            key={event.id || "unknown"}
            className="group p-4 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 hover:bg-muted/40 dark:hover:bg-muted/60 transition-colors"
          >
            {/* Top row: Action + Amount + Region */}
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    isStake && "text-[#4ADE80]",
                    isUnstake && "text-[color:var(--color-glow-orange)]",
                    !isStake && !isUnstake && "text-muted-foreground"
                  )}
                >
                  {isStake ? et.staked : isUnstake ? et.unstaked : et.event}
                </span>
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {amount}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  GCTL
                </span>
              </div>
              <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">
                {regionName}
              </span>
            </div>

            {/* Bottom row: Wallet + Date + Time ago */}
            <div className="flex items-center justify-between text-xs">
              {event.wallet ? (
                <a
                  href={etherscanWalletUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  {walletShort}
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ) : (
                <span className="font-mono text-muted-foreground">—</span>
              )}
              <div className="flex items-center gap-3 text-muted-foreground/60">
                {event.ts && (
                  <>
                    <span>
                      {new Date(event.ts).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <StakedTimer stakedAt={event.ts} labels={et} />
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/telemetry";
import { useEnsNames } from "@/hooks/useEnsNames";
import { useV2ImpactLeaderboard } from "@/hooks/v2-impact";
import { shortAddress } from "@/utils/impact";
import { useLang } from "@/lib/i18n";

interface GlobalLeaderboardWidgetProps {
  className?: string;
  limit?: number;
}

const fmtWatts = (s: string) =>
  Number(s).toLocaleString(undefined, { maximumFractionDigits: 0 });
const fmtCarbon = (s: string) =>
  Number(s).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function GlobalLeaderboardWidget({
  className,
  limit = 3,
  variant = "default",
}: GlobalLeaderboardWidgetProps & { variant?: "default" | "minimal" }) {
  const { t } = useLang();
  const source = "global_leaderboard_widget";
  const topN = Math.max(3, Math.min(5, limit));
  // V2 impact leaderboard ranks by watts (server-sorted desc).
  const leaderboardQuery = useV2ImpactLeaderboard({
    sort: "totalWatts",
    dir: "desc",
    limit: topN,
  });
  const topRows = React.useMemo(
    () => leaderboardQuery.data?.rows ?? [],
    [leaderboardQuery.data?.rows],
  );
  const isMinimal = variant === "minimal";

  const addresses = React.useMemo(
    () => topRows.map((r) => r.wallet),
    [topRows],
  );
  const { ensNames } = useEnsNames({
    addresses: addresses.slice(),
    enabled: addresses.length > 0,
  });

  return (
    <>
      <Card
        className={cn(
          "relative flex h-full flex-col overflow-hidden",
          isMinimal
            ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl"
            : "bg-card dark:bg-card border-border/20",
          className
        )}
      >
        <CardHeader className={cn("pb-3", isMinimal && "px-6 pt-0")}>
          <div className="flex items-center justify-between">
            <CardTitle className="tracking-tight text-lg">
              {t.widgets.globalLeaderboard.title}
            </CardTitle>
            <span className="text-[10px] font-mono uppercase text-muted-foreground bg-muted px-2 py-1 rounded">
              {t.widgets.globalLeaderboard.topBadge}
            </span>
          </div>
        </CardHeader>

        <CardContent
          className={cn(
            "min-h-0 flex-1 flex flex-col gap-4 pt-0",
            isMinimal && "px-6"
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {leaderboardQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/10 px-4 py-4"
                  >
                    <Skeleton className="h-5 w-24 rounded-xl" />
                    <Skeleton className="h-5 w-16 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : leaderboardQuery.isError ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                {t.widgets.globalLeaderboard.unableToLoad}
              </div>
            ) : topRows.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                {t.widgets.globalLeaderboard.noData}
              </div>
            ) : (
              <div className="space-y-3">
                {topRows.map((row, idx) => {
                  const rank = idx + 1;
                  const name =
                    ensNames[row.wallet] || shortAddress(row.wallet);

                  return (
                    <div
                      key={row.wallet}
                      className={cn(
                        "flex flex-col gap-2 rounded-2xl border px-4 py-4 transition-colors",
                        rank === 1
                          ? "bg-[color:var(--color-glow-orange)]/10 border-[color:var(--color-glow-orange)]/20"
                          : "bg-muted/40 border-border/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex items-center justify-center w-6 h-6 rounded-full font-mono text-xs font-bold shrink-0",
                              rank === 1
                                ? "bg-[color:var(--color-glow-orange)] text-white"
                                : "bg-muted-foreground/20 text-muted-foreground"
                            )}
                          >
                            {rank}
                          </div>
                          <div className="text-sm font-semibold text-foreground truncate max-w-[120px] sm:max-w-[200px]">
                            {name}
                          </div>
                        </div>
                        {rank === 1 && (
                          <div className="text-[10px] font-bold text-[color:var(--color-glow-orange)] uppercase tracking-wider">
                            {t.widgets.globalLeaderboard.firstPlace}
                          </div>
                        )}
                      </div>

                      <div className="flex items-end justify-between pt-1">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-muted-foreground font-mono tracking-wider">
                            Watts
                          </span>
                          <span className="text-xl font-bold font-mono text-foreground tabular-nums">
                            {fmtWatts(row.totalWatts)}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] uppercase text-muted-foreground font-mono tracking-wider">
                            Carbon
                          </span>
                          <span className="text-sm font-medium font-mono text-foreground/80 tabular-nums">
                            {fmtCarbon(row.totalCarbonCredits)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 pt-2">
            <Button
              asChild
              className="w-full h-12 font-mono font-bold text-base"
            >
              <Link
                href="/leaderboard"
                target="_blank"
                onClick={() => {
                  trackEvent("dashboard_leaderboard_open_click", {
                    source,
                    wallet_connected: false,
                    wallet_address: null,
                  });
                }}
              >
                {t.widgets.globalLeaderboard.seeFullLeaderboard}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

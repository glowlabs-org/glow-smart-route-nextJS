"use client";

import React from "react";
import { useAccount } from "wagmi";
import { Cpu, Zap, Layers, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Dialog } from "@/components/ui/dialog";
import { useRewardsBreakdown } from "@/hooks";
import { useWalletPortfolio } from "./use-wallet-portfolio";
import { cn } from "@/lib/utils";
import { GlowSymbol } from "@/components/glow-symbol";
import {
  FarmsPerformanceDialogContent,
  type FilterValue,
} from "./farms-performance-dialog";

interface PortfolioSummaryWidgetProps {
  walletAddress?: string | null;
  variant?: "default" | "minimal";
}

function formatGlwCompact(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

export default function PortfolioSummaryWidget({
  walletAddress,
  variant = "default",
}: PortfolioSummaryWidgetProps) {
  const { isConnecting, isReconnecting } = useAccount();
  const hasWallet = Boolean(walletAddress);
  const isWalletConnecting = isConnecting || isReconnecting;
  const isMinimal = variant === "minimal";

  const {
    chartData: glowWorthChartData,
    shouldShowSkeleton: isPortfolioLoading,
  } = useWalletPortfolio({
    walletAddress: walletAddress ?? null,
  });

  const { data: rewardsData, isLoading: isRewardsLoading } =
    useRewardsBreakdown({
      walletAddress: walletAddress ?? null,
      enabled: hasWallet,
    });

  const delegatedActiveGlw = React.useMemo(() => {
    if (!hasWallet) return 0;
    const last = glowWorthChartData.at(-1);
    const value = last?.delegatedActiveGlw ?? 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [glowWorthChartData, hasWallet]);

  const stats = React.useMemo(() => {
    const activeMiners = rewardsData
      ? rewardsData.farmStatistics.minerOnlyFarms +
        rewardsData.farmStatistics.bothTypesFarms
      : 0;
    const activeDelegations = rewardsData
      ? rewardsData.farmStatistics.delegatorOnlyFarms +
        rewardsData.farmStatistics.bothTypesFarms
      : 0;
    return { activeMiners, activeDelegations };
  }, [rewardsData]);

  const isLoading = hasWallet && (isPortfolioLoading || isRewardsLoading);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogFilter, setDialogFilter] = React.useState<FilterValue>("all");

  const handleRowClick = (filter: FilterValue) => {
    if (!hasWallet) return;
    setDialogFilter(filter);
    setDialogOpen(true);
  };

  if (!hasWallet && isWalletConnecting) {
    return (
      <Card className="h-full bg-card dark:bg-muted/30 border-foreground/10 dark:border-border">
        <CardHeader className="pb-0">
          <CardTitle className="text-center">Mining Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-6">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden w-full flex flex-col",
        isMinimal
          ? "bg-transparent border-transparent h-full"
          : "h-full bg-card dark:bg-muted/30 border-foreground/10 dark:border-border"
      )}
    >
      <CardHeader className="pb-0">
        <CardTitle className="text-center">Mining Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center p-4 gap-3">
        {/* Row 1: Actively Delegated */}
        <div
          className={cn(
            "flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors",
            hasWallet && "cursor-pointer active:scale-[0.98]"
          )}
          onClick={() => handleRowClick("delegations")}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#C084FC]/10 text-[#C084FC] border border-[#C084FC]/20">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                Delegated GLW
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold font-mono text-foreground">
                  {formatGlwCompact(delegatedActiveGlw)}
                </span>
                <span className="text-xs font-bold text-muted-foreground font-mono">
                  GLW
                </span>
              </div>
            </div>
          </div>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="p-1 hover:bg-muted rounded-full transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Info className="w-4 h-4 text-muted-foreground/50 cursor-pointer hover:text-foreground transition-colors" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px] text-[11px] font-mono">
                Actively delegated GLW minus protocol deposit recovery.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Row 2: Active Miners */}
        <div
          className={cn(
            "flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors",
            hasWallet && "cursor-pointer active:scale-[0.98]"
          )}
          onClick={() => handleRowClick("miners")}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[color:var(--color-miner-yellow)]/10 text-[color:var(--color-miner-yellow)] border border-[color:var(--color-miner-yellow)]/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                Active Miners
              </span>
              <span className="text-lg font-bold font-mono text-foreground">
                {stats.activeMiners}
              </span>
            </div>
          </div>
        </div>

        {/* Row 3: Active Delegations */}
        <div
          className={cn(
            "flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors",
            hasWallet && "cursor-pointer active:scale-[0.98]"
          )}
          onClick={() => handleRowClick("delegations")}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#C084FC]/10 text-[#C084FC] border border-[#C084FC]/20">
              <GlowSymbol className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                Active Delegations
              </span>
              <span className="text-lg font-bold font-mono text-foreground">
                {stats.activeDelegations}
              </span>
            </div>
          </div>
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <FarmsPerformanceDialogContent
          walletAddress={walletAddress ?? undefined}
          initialFilter={dialogFilter}
        />
      </Dialog>
    </Card>
  );
}

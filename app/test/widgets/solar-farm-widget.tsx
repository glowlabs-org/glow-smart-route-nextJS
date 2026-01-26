"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Zap, LayoutGrid, Sun, Rocket, Gift, Info } from "lucide-react";
import { CashMinerIcon, DelegationIcon } from "@/components/impact-icons";
import Link from "next/link";
import {
  useGlowLaunchpad,
  useMiningCenter,
  useMiningScore,
  useRewardsBreakdown,
  useRewardScore,
  useSponsorListings,
  useSplitsActivity,
  useWalletFarms,
} from "@/hooks";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";

// --- Shadcn UI Components ---
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip as ShadTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { FarmsPerformanceDialogContent } from "./farms-performance-dialog";
import { cn } from "@/lib/utils";
import { LaunchpadDialog } from "@/components/dialogs/launchpad-dialog";
import { getNextTuesdayAt1pmET } from "@/utils/nextTuesdayET";
import { countActiveListings } from "@/utils/launchpad";
import {
  AnimatedCountdownDhms,
  useCountdownTo,
} from "@/app/components/animated-countdown";
import {
  attachEstimatedWeeklyLaunchpadRewards,
  attachEstimatedWeeklyMiningCenterRewards,
  deriveLaunchpadSponsorshipsInProgress,
  deriveMiningCenterSponsorshipsInProgress,
  getAggregatedEstimatedWeeklyGlw,
} from "@/utils/sponsorships-in-progress";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { trackEvent } from "@/lib/telemetry";

interface HistoryDataPoint {
  weekNumber: number;
  week: string;
  minerReward: number;
  delegationReward: number;
  otherReward: number;
  protocolDepositUsd: number;
  total: number;
}

// Static placeholder data hoisted to module scope to avoid recreation on every render
const PLACEHOLDER_HISTORY_DATA: HistoryDataPoint[] = [
  {
    weekNumber: 1,
    week: "Wk 1",
    minerReward: 1200,
    delegationReward: 800,
    otherReward: 250,
    protocolDepositUsd: 125,
    total: 2250,
  },
  {
    weekNumber: 2,
    week: "Wk 2",
    minerReward: 900,
    delegationReward: 1000,
    otherReward: 200,
    protocolDepositUsd: 80,
    total: 2100,
  },
  {
    weekNumber: 3,
    week: "Wk 3",
    minerReward: 1400,
    delegationReward: 700,
    otherReward: 300,
    protocolDepositUsd: 140,
    total: 2400,
  },
  {
    weekNumber: 4,
    week: "Wk 4",
    minerReward: 800,
    delegationReward: 900,
    otherReward: 150,
    protocolDepositUsd: 60,
    total: 1850,
  },
  {
    weekNumber: 5,
    week: "Wk 5",
    minerReward: 1500,
    delegationReward: 1100,
    otherReward: 400,
    protocolDepositUsd: 160,
    total: 3000,
  },
  {
    weekNumber: 6,
    week: "Wk 6",
    minerReward: 1100,
    delegationReward: 950,
    otherReward: 225,
    protocolDepositUsd: 95,
    total: 2275,
  },
  {
    weekNumber: 7,
    week: "Wk 7",
    minerReward: 1300,
    delegationReward: 900,
    otherReward: 275,
    protocolDepositUsd: 110,
    total: 2475,
  },
  {
    weekNumber: 8,
    week: "Wk 8",
    minerReward: 1000,
    delegationReward: 850,
    otherReward: 180,
    protocolDepositUsd: 75,
    total: 2030,
  },
  {
    weekNumber: 9,
    week: "Wk 9",
    minerReward: 1600,
    delegationReward: 900,
    otherReward: 420,
    protocolDepositUsd: 190,
    total: 2920,
  },
  {
    weekNumber: 10,
    week: "Wk 10",
    minerReward: 1250,
    delegationReward: 1050,
    otherReward: 260,
    protocolDepositUsd: 105,
    total: 2560,
  },
];

function formatGlwCompact(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatGlwPrecise(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTrendPercent(params: { current: number; previous: number }) {
  const { current, previous } = params;
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous <= 0
  ) {
    return "—";
  }
  const percent = ((current - previous) / previous) * 100;
  if (!Number.isFinite(percent)) return "—";
  const prefix = percent >= 0 ? "+" : "";
  return `${prefix}${percent.toFixed(1)}%`;
}

function parseGlwFromWei(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num / 1e18;
}

function parseUsdFromBaseUnits(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num / 1e6;
}

function formatUsdPrecise(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function SolarFarmSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-10 w-56" />
        </div>
        <Skeleton className="h-12 w-40 rounded-xl" />
      </div>
      <Skeleton className="h-[180px] w-full rounded-xl" />
    </div>
  );
}

// --- SUB-COMPONENTS ---

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    const minerVal =
      payload.find((p) => p.dataKey === "minerReward")?.value ?? 0;
    const delVal =
      payload.find((p) => p.dataKey === "delegationReward")?.value ?? 0;
    const otherVal =
      payload.find((p) => p.dataKey === "otherReward")?.value ?? 0;
    const pdUsd =
      payload.find((p) => p.dataKey === "protocolDepositUsd")?.value ?? 0;
    const total = minerVal + delVal + otherVal;
    return (
      <div className="bg-popover text-popover-foreground border border-border p-3 rounded-xl shadow-xl min-w-[160px]">
        <p className="text-muted-foreground text-[10px] font-mono uppercase mb-2">
          {label}
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--color-miner)" }}
              />
              <span className="text-xs text-muted-foreground font-mono">
                Miners
              </span>
            </div>
            <span className="text-xs font-bold text-foreground font-mono">
              {formatGlwPrecise(minerVal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--color-glow-purple)" }}
              />
              <span className="text-xs text-muted-foreground font-mono">
                Delegation
              </span>
            </div>
            <span className="text-xs font-bold text-foreground font-mono">
              {formatGlwPrecise(delVal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--color-glow-green)" }}
              />
              <span className="text-xs text-muted-foreground font-mono">
                Other
              </span>
            </div>
            <span className="text-xs font-bold text-foreground font-mono">
              {formatGlwPrecise(otherVal)}
            </span>
          </div>
          {pdUsd > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--color-glow-orange)" }}
                />
                <span className="text-xs text-muted-foreground font-mono">
                  PD Rewards (USDG)
                </span>
              </div>
              <span className="text-xs font-bold text-foreground font-mono">
                {formatUsdPrecise(pdUsd)}
              </span>
            </div>
          ) : null}
          <div className="h-px bg-border my-1" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono uppercase">
              Total
            </span>
            <div className="flex flex-col items-end ml-1">
              <span className="text-sm font-bold text-foreground font-mono">
                {formatGlwPrecise(total)} GLW
              </span>
              {pdUsd > 0 ? (
                <span className="text-[11px] font-bold text-muted-foreground font-mono">
                  {formatUsdPrecise(pdUsd)} USDG
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface PendingFarmData {
  farmId: string;
  farmName: string;
  fractionType: "launchpad" | "mining-center";
  totalAmount: bigint;
  estimatedWeeklyGlw?: number;
  estimatedUserWeeklyGlw?: number;
  progressPercent?: number;
}

interface InProgressFarmData {
  applicationId: string;
  farmName: string;
  fractionType: "launchpad" | "mining-center";
  estimatedUserWeeklyGlw?: number;
  progressPercent?: number;
  totalAmount?: bigint;
}

const PendingFarmRow = ({
  data,
  isPending,
  onOpenDialog,
}: {
  data: PendingFarmData | InProgressFarmData;
  isPending: boolean;
  onOpenDialog?: () => void;
}) => {
  const isMiningCenter = data.fractionType === "mining-center";

  const fmtGlw = (n: number) =>
    new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(n);

  const fmtUsd = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const amountValue = React.useMemo(() => {
    if (!("totalAmount" in data) || !data.totalAmount) return null;

    const amount = Number(data.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    if (isMiningCenter) {
      return amount / 1e6;
    } else {
      return amount / 1e18;
    }
  }, [data, isMiningCenter]);

  const estimatedGlw = React.useMemo(() => {
    if (
      "estimatedUserWeeklyGlw" in data &&
      typeof data.estimatedUserWeeklyGlw === "number" &&
      data.estimatedUserWeeklyGlw > 0
    ) {
      return data.estimatedUserWeeklyGlw;
    }
    if (
      "estimatedWeeklyGlw" in data &&
      typeof data.estimatedWeeklyGlw === "number" &&
      data.estimatedWeeklyGlw > 0
    ) {
      return data.estimatedWeeklyGlw;
    }
    return null;
  }, [data]);

  const getIconContainerClass = () => {
    if (isMiningCenter) {
      return "bg-[color:var(--color-miner)]/12 border-[color:var(--color-miner)] text-[color:var(--color-miner-contrast)]";
    }
    return "bg-delegation-purple/12 border-delegation-purple text-delegation-purple dark:text-delegation-purple";
  };

  const ProgressDisplay = ({ className }: { className?: string }) => {
    if (isPending) {
      return (
        <div
          className={cn(
            "text-xs font-bold font-mono text-muted-foreground",
            className
          )}
        >
          STARTS SOON
        </div>
      );
    }
    return (
      <div
        className={cn(
          "text-xs font-bold font-mono text-muted-foreground",
          className
        )}
      >
        IN PROGRESS
      </div>
    );
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-muted/30 transition-colors cursor-pointer hover:bg-muted/40"
      )}
      onClick={() => onOpenDialog?.()}
    >
      {/* MOBILE CARD */}
      <div className="sm:hidden p-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center border",
              getIconContainerClass()
            )}
          >
            {isMiningCenter ? (
              <CashMinerIcon className="w-5 h-5" />
            ) : (
              <DelegationIcon className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-foreground leading-tight truncate">
              {data.farmName}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground mt-0.5">
              <span className="uppercase tracking-wider">
                {isPending ? "Pending" : "In Progress"}
              </span>
              {!isPending && typeof data.progressPercent === "number" && (
                <>
                  <span>•</span>
                  <span className="tabular-nums">
                    {Math.round(data.progressPercent)}% filled
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
              {isMiningCenter ? "Cost" : "Delegated"}
            </span>
            {amountValue ? (
              <span
                className={cn(
                  "font-bold tabular-nums",
                  isMiningCenter
                    ? "text-[color:var(--color-miner-contrast)]"
                    : "text-delegation-purple"
                )}
              >
                {isMiningCenter
                  ? fmtUsd(amountValue)
                  : `${fmtGlw(amountValue)} GLW`}
              </span>
            ) : (
              <span className="font-bold text-muted-foreground">—</span>
            )}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
              Est. Weekly
            </span>
            {estimatedGlw ? (
              <span
                className={cn(
                  "font-bold tabular-nums",
                  isMiningCenter
                    ? "text-[color:var(--color-miner-contrast)]"
                    : "text-delegation-purple"
                )}
              >
                {fmtGlw(estimatedGlw)} GLW
              </span>
            ) : (
              <span className="font-bold text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </div>

      {/* DESKTOP ROW */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-12 items-center p-4 gap-4">
          {/* COLUMN 1: IDENTITY */}
          <div className="col-span-3 flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border",
                getIconContainerClass()
              )}
            >
              {isMiningCenter ? (
                <CashMinerIcon className="w-6 h-6" />
              ) : (
                <DelegationIcon className="w-6 h-6" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-base text-foreground leading-tight truncate">
                {data.farmName}
              </span>
              <span className="text-sm font-mono text-muted-foreground truncate">
                {isPending ? "Pending" : "In Progress"}
              </span>
            </div>
          </div>

          {/* COLUMN 2: LIFECYCLE BAR */}
          <div className="col-span-3 px-2">
            {!isPending && typeof data.progressPercent === "number" ? (
              <div className="text-xs font-mono text-muted-foreground">
                {Math.round(data.progressPercent ?? 0)}% filled
              </div>
            ) : null}
          </div>

          {/* COLUMN 3: KEY METRICS */}
          <div className="col-span-4 flex items-center justify-center gap-6">
            {!isPending && typeof data.progressPercent === "number" ? (
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    Funding
                  </div>
                  <Progress
                    value={Math.max(
                      0,
                      Math.min(100, data.progressPercent ?? 0)
                    )}
                  />
                </div>
                {estimatedGlw && (
                  <div className="text-right">
                    <div
                      className={cn(
                        "text-lg font-bold font-mono tabular-nums",
                        isMiningCenter
                          ? "text-[color:var(--color-miner-contrast)]"
                          : "text-delegation-purple dark:text-delegation-purple"
                      )}
                    >
                      {formatGlwPrecise(estimatedGlw)}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      GLW/wk est.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="text-center min-w-[70px]">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                    {isMiningCenter ? "Cost" : "Delegated"}
                  </div>
                  <div className="flex items-baseline justify-center gap-1">
                    {amountValue ? (
                      <>
                        <span className="text-lg font-bold font-mono text-foreground tabular-nums leading-tight">
                          {isMiningCenter
                            ? fmtUsd(amountValue)
                            : fmtGlw(amountValue)}
                        </span>
                        {!isMiningCenter && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            GLW
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-lg font-bold font-mono text-muted-foreground tabular-nums leading-tight">
                        —
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-center min-w-[70px]">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                    Est. Weekly
                  </div>
                  <div className="flex items-baseline justify-center gap-1">
                    {estimatedGlw ? (
                      <>
                        <span
                          className={cn(
                            "text-lg font-bold font-mono tabular-nums leading-tight",
                            isMiningCenter
                              ? "text-[color:var(--color-miner-contrast)]"
                              : "text-delegation-purple dark:text-delegation-purple"
                          )}
                        >
                          {fmtGlw(estimatedGlw)}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          GLW
                        </span>
                      </>
                    ) : (
                      <span className="text-lg font-bold font-mono text-muted-foreground tabular-nums leading-tight">
                        —
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* COLUMN 4: PROGRESS */}
          <div className="col-span-2 flex items-center justify-end gap-2">
            <ProgressDisplay />
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

interface SolarFarmWidgetProps {
  walletAddress?: string | null;
  variant?: "default" | "minimal";
}

export default function SolarFarmWidget({
  walletAddress,
  variant = "default",
}: SolarFarmWidgetProps) {
  const queryClient = useQueryClient();
  const { isConnecting, isReconnecting } = useAccount();
  const hasWallet = Boolean(walletAddress);
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "solar_farm_widget";
  const isWalletConnecting = isConnecting || isReconnecting;
  const isMinimal = variant === "minimal";
  const [isLaunchpadOpen, setIsLaunchpadOpen] = React.useState(false);
  const [nextBatchAtMs, setNextBatchAtMs] = React.useState(() =>
    getNextTuesdayAt1pmET().getTime()
  );

  const { data, isLoading, isError, refetch } = useRewardsBreakdown({
    walletAddress: walletAddress ?? null,
    enabled: hasWallet,
  });

  const {
    farms: purchasedFarms,
    isLoading: isFarmsLoading,
    isError: isFarmsError,
  } = useWalletFarms({
    walletAddress: walletAddress ?? undefined,
    enabled: hasWallet,
  });

  const { applications: launchpadApplications } = useGlowLaunchpad({
    filters: { paymentCurrency: "GLW" },
  });
  const { applications: minersApplications } = useSponsorListings({
    filters: { paymentCurrency: "USDC", type: "mining-center" },
  });

  const {
    activity: splitsActivity,
    isLoading: isSplitsActivityLoading,
    isError: isSplitsActivityError,
  } = useSplitsActivity({
    walletAddress: walletAddress ?? undefined,
    enabled: hasWallet,
    limit: 200,
  });

  const sponsorshipsInProgress = React.useMemo(() => {
    return deriveLaunchpadSponsorshipsInProgress({
      splitsActivity,
      sponsorListings: launchpadApplications,
    });
  }, [launchpadApplications, splitsActivity]);

  const applicationsForRewards = React.useMemo(() => {
    return sponsorshipsInProgress
      .map((item) => item.application)
      .filter((app): app is NonNullable<typeof app> => app !== null);
  }, [sponsorshipsInProgress]);

  const { rewardScoreMap, isLoading: isRewardScoresLoading } = useRewardScore({
    applications: applicationsForRewards,
    paymentCurrency: "GLW",
    enabled: hasWallet && applicationsForRewards.length > 0,
    walletAddress: walletAddress ?? null,
  });

  const sponsorshipsInProgressWithEstimates = React.useMemo(() => {
    return attachEstimatedWeeklyLaunchpadRewards({
      sponsorshipsInProgress,
      rewardScoreMap,
    });
  }, [rewardScoreMap, sponsorshipsInProgress]);

  const aggregatedEstimatedWeeklyGlwLaunchpad = React.useMemo(() => {
    return getAggregatedEstimatedWeeklyGlw(sponsorshipsInProgressWithEstimates);
  }, [sponsorshipsInProgressWithEstimates]);

  const hasMiningCenterSplits = React.useMemo(() => {
    return splitsActivity.some((s) => s.fractionType === "mining-center");
  }, [splitsActivity]);

  const { applications: miningCenterApplications } = useMiningCenter({
    filters: { paymentCurrency: "USDC" },
    enabled: hasWallet && hasMiningCenterSplits,
  });

  const miningCenterInProgress = React.useMemo(() => {
    return deriveMiningCenterSponsorshipsInProgress({
      splitsActivity,
      sponsorListings: miningCenterApplications,
    });
  }, [miningCenterApplications, splitsActivity]);

  const miningCenterAppsForMiningScore = React.useMemo(() => {
    return miningCenterInProgress
      .map((item) => item.application)
      .filter((app): app is NonNullable<typeof app> => app !== null);
  }, [miningCenterInProgress]);

  const { miningScoreMap, isLoading: isMiningScoreLoading } = useMiningScore({
    applications: miningCenterAppsForMiningScore,
    enabled: hasWallet && miningCenterAppsForMiningScore.length > 0,
  });

  const miningCenterInProgressWithEstimates = React.useMemo(() => {
    return attachEstimatedWeeklyMiningCenterRewards({
      sponsorshipsInProgress: miningCenterInProgress,
      miningScoreMap,
    });
  }, [miningCenterInProgress, miningScoreMap]);

  const aggregatedEstimatedWeeklyGlwMiningCenter = React.useMemo(() => {
    return getAggregatedEstimatedWeeklyGlw(miningCenterInProgressWithEstimates);
  }, [miningCenterInProgressWithEstimates]);

  const rewardedFarmTypeKeys = React.useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(
      data.farmDetails.map(
        (f) =>
          `${f.farmId}:${
            f.type === "launchpad" ? "launchpad" : "mining-center"
          }`
      )
    );
  }, [data]);

  const pendingStartRows = React.useMemo(() => {
    if (!splitsActivity.length) return [];

    const byFarm = new Map<
      string,
      {
        farmId: string;
        farmName: string;
        fractionType: "launchpad" | "mining-center";
        totalAmount: bigint;
      }
    >();

    for (const evt of splitsActivity) {
      const fractionType = evt.fractionType;
      if (!fractionType) continue;
      const status = (evt.fractionStatus ?? "").toLowerCase();

      const isPendingStart =
        (fractionType === "launchpad" && status === "filled") ||
        (fractionType === "mining-center" &&
          (status === "filled" || status === "expired"));
      if (!isPendingStart) continue;

      const farmId = evt.farmId ?? evt.applicationId;
      if (!farmId) continue;
      const farmTypeKey = `${farmId}:${fractionType}`;
      if (rewardedFarmTypeKeys.has(farmTypeKey)) continue;

      let amount = BigInt(0);
      try {
        amount = BigInt(evt.amount);
      } catch {
        amount = BigInt(0);
      }

      const existing = byFarm.get(farmTypeKey) ?? {
        farmId,
        farmName: evt.farmName || `Farm ${farmId.substring(0, 8)}`,
        fractionType,
        totalAmount: BigInt(0),
      };
      existing.totalAmount += amount;
      byFarm.set(farmTypeKey, existing);
    }

    return Array.from(byFarm.values()).map((item) => {
      const farmData = purchasedFarms.find((f) => f.farmId === item.farmId);

      let estimatedUserWeeklyGlw: number | undefined = undefined;
      if (farmData?.userWeeklyRewards) {
        // Use source-specific breakdown if available (prevents double-counting for farms with both delegation + miner)
        const isMiningCenter = item.fractionType === "mining-center";

        if (
          isMiningCenter &&
          farmData.userWeeklyRewards.glwInflationRewardsFromMiner
        ) {
          // Miner: only inflation from mining-center splits (no PD recovery)
          estimatedUserWeeklyGlw = parseGlwFromWei(
            farmData.userWeeklyRewards.glwInflationRewardsFromMiner
          );
        } else if (
          !isMiningCenter &&
          farmData.userWeeklyRewards.glwInflationRewardsFromDelegation
        ) {
          // Delegation: inflation from delegation splits + PD recovery
          const delegationInflationGlw = parseGlwFromWei(
            farmData.userWeeklyRewards.glwInflationRewardsFromDelegation
          );
          const pdGlw = parseGlwFromWei(
            farmData.userWeeklyRewards.protocolDepositRewards
          );
          estimatedUserWeeklyGlw = delegationInflationGlw + pdGlw;
        } else {
          // Fallback for old API response (no breakdown fields)
          const inflationGlw = parseGlwFromWei(
            farmData.userWeeklyRewards.glwInflationRewards
          );
          const pdAsset = farmData.userWeeklyRewards.protocolDepositAsset;
          const isPdGlw = pdAsset === "GLW";
          const pdGlw = isPdGlw
            ? parseGlwFromWei(farmData.userWeeklyRewards.protocolDepositRewards)
            : 0;
          estimatedUserWeeklyGlw = inflationGlw + pdGlw;
        }
      }

      return {
        ...item,
        estimatedUserWeeklyGlw,
      };
    });
  }, [purchasedFarms, rewardedFarmTypeKeys, splitsActivity]);

  const inProgressAmountsByAppId = React.useMemo(() => {
    const map = new Map<string, bigint>();

    for (const evt of splitsActivity) {
      const status = (evt.fractionStatus ?? "").toLowerCase();
      if (status !== "committed") continue;

      const appId = evt.applicationId;
      if (!appId) continue;

      let amount = BigInt(0);
      try {
        amount = BigInt(evt.amount);
      } catch {
        continue;
      }

      const existing = map.get(appId) ?? BigInt(0);
      map.set(appId, existing + amount);
    }

    return map;
  }, [splitsActivity]);

  const isWidgetLoading =
    isLoading || isSplitsActivityLoading || isFarmsLoading;
  const isWidgetError = isError || isSplitsActivityError || isFarmsError;

  const activeDelegationsListingsCount = React.useMemo(() => {
    return countActiveListings(launchpadApplications);
  }, [launchpadApplications]);
  const activeMinersListingsCount = React.useMemo(() => {
    return countActiveListings(minersApplications);
  }, [minersApplications]);
  const activeListingsCount =
    activeDelegationsListingsCount + activeMinersListingsCount;

  const rewardsHistoryData = React.useMemo<HistoryDataPoint[]>(() => {
    if (!data) return [];

    const buckets = new Map<
      number,
      {
        minerReward: number;
        delegationReward: number;
        otherReward: number;
        protocolDepositUsd: number;
      }
    >();

    for (const farm of data.farmDetails) {
      const isMiner = farm.type === "mining-center";
      for (const week of farm.weeklyBreakdown) {
        const prev = buckets.get(week.weekNumber) ?? {
          minerReward: 0,
          delegationReward: 0,
          otherReward: 0,
          protocolDepositUsd: 0,
        };

        const totalGlw = parseGlwFromWei(week.totalRewards);
        buckets.set(week.weekNumber, {
          minerReward: prev.minerReward + (isMiner ? totalGlw : 0),
          delegationReward: prev.delegationReward + (isMiner ? 0 : totalGlw),
          otherReward: prev.otherReward,
          protocolDepositUsd: prev.protocolDepositUsd,
        });
      }
    }

    for (const farm of data.otherFarmsWithRewards?.farms ?? []) {
      const asset = farm.asset;
      const isPdUsdAsset = asset === "USDG";
      for (const week of farm.weeklyBreakdown) {
        const prev = buckets.get(week.weekNumber) ?? {
          minerReward: 0,
          delegationReward: 0,
          otherReward: 0,
          protocolDepositUsd: 0,
        };

        const inflationGlw = parseGlwFromWei(week.inflationRewards);
        const pdUsd = isPdUsdAsset
          ? parseUsdFromBaseUnits(week.protocolDepositRewards)
          : 0;
        const pdGlw = !isPdUsdAsset
          ? parseGlwFromWei(week.protocolDepositRewards)
          : 0;
        buckets.set(week.weekNumber, {
          minerReward: prev.minerReward,
          delegationReward: prev.delegationReward,
          otherReward: prev.otherReward + inflationGlw + pdGlw,
          protocolDepositUsd: prev.protocolDepositUsd + pdUsd,
        });
      }
    }

    const points = Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNumber, value]) => {
        const total =
          value.minerReward + value.delegationReward + value.otherReward;
        return {
          weekNumber,
          week: `Wk ${weekNumber}`,
          minerReward: value.minerReward,
          delegationReward: value.delegationReward,
          otherReward: value.otherReward,
          protocolDepositUsd: value.protocolDepositUsd,
          total,
        };
      });

    return points.slice(-10);
  }, [data]);

  const chartData = React.useMemo<HistoryDataPoint[]>(() => {
    const base = [...rewardsHistoryData];

    // Only show estimated bar if user has NO historical rewards yet
    if (base.length > 0) {
      // Mark the last week as "Current"
      base[base.length - 1] = {
        ...base[base.length - 1],
        week: "Current",
      };
      return base;
    }

    // Aggregate pending farms estimated rewards
    const totalPendingEstimated = pendingStartRows.reduce((sum, row) => {
      return sum + (row.estimatedUserWeeklyGlw ?? 0);
    }, 0);

    const pendingMinerEstimated = pendingStartRows
      .filter((row) => row.fractionType === "mining-center")
      .reduce((sum, row) => sum + (row.estimatedUserWeeklyGlw ?? 0), 0);

    const pendingDelegationEstimated = pendingStartRows
      .filter((row) => row.fractionType === "launchpad")
      .reduce((sum, row) => sum + (row.estimatedUserWeeklyGlw ?? 0), 0);

    const totalInProgress =
      aggregatedEstimatedWeeklyGlwLaunchpad +
      aggregatedEstimatedWeeklyGlwMiningCenter +
      totalPendingEstimated;

    if (totalInProgress <= 0) return base;

    const nextWeekNumber = (base.at(-1)?.weekNumber ?? 0) + 1;
    base.push({
      weekNumber: nextWeekNumber,
      week: "Estimated",
      minerReward:
        aggregatedEstimatedWeeklyGlwMiningCenter + pendingMinerEstimated,
      delegationReward:
        aggregatedEstimatedWeeklyGlwLaunchpad + pendingDelegationEstimated,
      otherReward: 0,
      protocolDepositUsd: 0,
      total: totalInProgress,
    });
    return base;
  }, [
    aggregatedEstimatedWeeklyGlwLaunchpad,
    aggregatedEstimatedWeeklyGlwMiningCenter,
    pendingStartRows,
    rewardsHistoryData,
  ]);

  const stats = React.useMemo(() => {
    const last = rewardsHistoryData.at(-1)?.total ?? 0;
    const prev = rewardsHistoryData.at(-2)?.total ?? 0;
    const lastPdUsd = rewardsHistoryData.at(-1)?.protocolDepositUsd ?? 0;
    const trendPercent =
      Number.isFinite(last) && Number.isFinite(prev) && prev > 0
        ? ((last - prev) / prev) * 100
        : null;

    const activeMiners = data
      ? data.farmStatistics.minerOnlyFarms + data.farmStatistics.bothTypesFarms
      : 0;
    const activeDelegations = data
      ? data.farmStatistics.delegatorOnlyFarms +
        data.farmStatistics.bothTypesFarms
      : 0;

    return {
      weeklyPayout: last,
      trend: formatTrendPercent({ current: last, previous: prev }),
      trendPercent,
      weeklyProtocolDepositUsd: lastPdUsd,
      activeMiners,
      activeDelegations,
      activeOtherRewards:
        data?.otherFarmsWithRewards?.count ??
        data?.otherFarmsWithRewards?.farms.length ??
        0,
    };
  }, [data, rewardsHistoryData]);

  const visibleStatsItems = React.useMemo(() => {
    const items = [
      {
        key: "miners" as const,
        count: stats.activeMiners,
        label: "Miners",
        iconSrc: "/images/icons/cash-miner.svg",
        iconClassName: "text-miner",
      },
      {
        key: "delegations" as const,
        count: stats.activeDelegations,
        label: "Delegations",
        iconSrc: "/images/icons/vault.svg",
        iconClassName: "text-glow-purple",
      },
      {
        key: "other" as const,
        count: stats.activeOtherRewards,
        label: "Other",
        Icon: Gift,
        iconClassName: "text-[color:var(--color-glow-green)]",
      },
    ].filter((i) => i.count > 0);

    return items.length ? items : [];
  }, [stats.activeDelegations, stats.activeMiners, stats.activeOtherRewards]);

  const statsGridColsClass = React.useMemo(() => {
    const n = visibleStatsItems.length;
    if (n <= 1) return "grid-cols-1";
    if (n === 2) return "grid-cols-2";
    return "grid-cols-3";
  }, [visibleStatsItems.length]);

  const hasAnyRewardsOrActivity = React.useMemo(() => {
    if (!data) return false;

    const hasMiners =
      data.farmStatistics.minerOnlyFarms + data.farmStatistics.bothTypesFarms >
      0;
    const hasDelegations =
      data.farmStatistics.delegatorOnlyFarms +
        data.farmStatistics.bothTypesFarms >
      0;

    const hasPendingPurchases =
      (data.recentPurchasesWithoutRewards?.length ?? 0) > 0;

    const hasOtherRewards = (data.otherFarmsWithRewards?.count ?? 0) > 0;

    const totalGlwDelegatedAfter = Number(
      data.delegatedAfterWeekRange?.totalGlwDelegatedAfter ?? 0
    );
    const totalUsdcSpentAfter = Number(
      data.delegatedAfterWeekRange?.totalUsdcSpentAfter ?? 0
    );

    return (
      hasMiners ||
      hasDelegations ||
      hasOtherRewards ||
      hasPendingPurchases ||
      totalGlwDelegatedAfter > 0 ||
      totalUsdcSpentAfter > 0
    );
  }, [data]);

  const hasInProgressSponsorships =
    sponsorshipsInProgressWithEstimates.length > 0 ||
    miningCenterInProgressWithEstimates.length > 0 ||
    (isRewardScoresLoading && sponsorshipsInProgress.length > 0) ||
    (isMiningScoreLoading && miningCenterInProgress.length > 0);

  const isEmptyButConnected =
    hasWallet &&
    !isWidgetLoading &&
    !isWidgetError &&
    rewardsHistoryData.length === 0 &&
    !hasAnyRewardsOrActivity &&
    !hasInProgressSponsorships;

  const handleBatchCountdownComplete = React.useCallback(() => {
    setNextBatchAtMs(getNextTuesdayAt1pmET().getTime());
    void (async () => {
      try {
        await queryClient.refetchQueries({
          queryKey: QUERY_KEYS.listings.allSponsors,
        });
      } catch {}
    })();
  }, [queryClient]);
  const remainingMs = useCountdownTo({
    targetAtMs: nextBatchAtMs,
    onComplete: handleBatchCountdownComplete,
  });

  return (
    <Dialog>
      {/* --- DASHBOARD CARD --- */}
      <Card
        className={cn(
          "flex flex-col overflow-hidden pt-0 gap-3 w-full",
          isMinimal
            ? "bg-transparent border-transparent h-full"
            : "h-full lg:max-h-[380px] bg-card dark:bg-card border-border/20"
        )}
      >
        {!isEmptyButConnected && (
          <CardHeader className="pb-0 pt-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
                Glow Mining
              </CardTitle>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasWallet || isEmptyButConnected}
                  className="h-8 rounded-full px-3 text-[11px] font-mono tracking-wider gap-2"
                  onClick={() => {
                    trackEvent("dashboard_mining_details_open_click", {
                      source,
                      wallet_connected: hasWallet,
                      wallet_address: normalizedWalletAddress,
                      cta: "view_details",
                    });
                  }}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>View Details</span>
                </Button>
              </DialogTrigger>
            </div>
          </CardHeader>
        )}

        <CardContent
          className={cn(
            "flex-1 min-h-0 flex flex-col gap-6",
            !isEmptyButConnected ? "px-4 py-0 pt-2 sm:px-6" : "p-0"
          )}
        >
          {!hasWallet ? (
            isWalletConnecting ? (
              <SolarFarmSkeleton />
            ) : (
              <div className="relative flex-1 min-h-0">
                <div
                  aria-hidden
                  className="pointer-events-none select-none blur-[10px] opacity-60"
                >
                  {/* Dashboard Stats (placeholder) */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-[10px] uppercase text-muted-foreground font-mono tracking-wider">
                        Current Weekly Payout
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Sun className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                          <span className="text-3xl font-bold text-foreground tracking-tight font-mono">
                            2,300
                          </span>
                          <span className="text-sm font-bold text-muted-foreground font-mono">
                            GLW
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 font-mono border border-emerald-500/20">
                          +8.2%
                        </span>
                      </div>
                    </div>

                    <div className="w-full sm:w-auto bg-muted/30 px-3 py-2 sm:px-4 rounded-xl border border-border">
                      <div className="grid grid-cols-3 divide-x divide-border">
                        <div className="flex flex-col items-center sm:items-end px-2 sm:px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg font-bold text-foreground font-mono">
                              3
                            </span>
                            <CashMinerIcon className="w-6 h-6" />
                          </div>
                          <span className="text-[9px] uppercase text-muted-foreground font-mono tracking-wider">
                            Miners
                          </span>
                        </div>
                        <div className="flex flex-col items-center sm:items-end px-2 sm:px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg font-bold text-foreground font-mono">
                              2
                            </span>
                            <Zap className="w-4 h-4 text-glow-purple" />
                          </div>
                          <span className="text-[9px] uppercase text-muted-foreground font-mono tracking-wider">
                            Delegations
                          </span>
                        </div>
                        <div className="flex flex-col items-center sm:items-end px-2 sm:px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg font-bold text-foreground font-mono">
                              1
                            </span>
                            <Gift className="w-4 h-4 text-[color:var(--color-glow-green)]" />
                          </div>
                          <span className="text-[9px] uppercase text-muted-foreground font-mono tracking-wider">
                            Other
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chart (placeholder) */}
                  <div className="mt-6 h-[190px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={PLACEHOLDER_HISTORY_DATA} barSize={24}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="var(--border)"
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="week"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: "var(--muted-foreground)",
                            fontSize: 10,
                            fontFamily: "monospace",
                          }}
                          dy={10}
                        />
                        <Bar
                          dataKey="minerReward"
                          stackId="a"
                          fill="var(--color-miner)"
                          radius={[0, 0, 4, 4]}
                          animationDuration={1500}
                        />
                        <Bar
                          dataKey="delegationReward"
                          stackId="a"
                          fill="var(--color-glow-purple)"
                          radius={[0, 0, 0, 0]}
                          animationDuration={1500}
                        />
                        <Bar
                          dataKey="otherReward"
                          stackId="a"
                          fill="var(--color-glow-green)"
                          radius={[4, 4, 0, 0]}
                          animationDuration={1500}
                        />
                        <Bar
                          dataKey="protocolDepositUsd"
                          fill="var(--color-glow-orange)"
                          radius={[4, 4, 0, 0]}
                          animationDuration={1500}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Connect your wallet
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Connect your wallet to view mining performance.
                  </div>
                </div>
              </div>
            )
          ) : isWidgetLoading ? (
            <SolarFarmSkeleton />
          ) : isWidgetError ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-center">
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Unable to load rewards breakdown
              </div>
              <Button
                variant="outline"
                size="sm"
                className="font-mono"
                onClick={() => {
                  trackEvent("dashboard_mining_retry_click", {
                    source,
                    wallet_connected: hasWallet,
                    wallet_address: normalizedWalletAddress,
                  });
                  refetch();
                }}
              >
                Retry
              </Button>
            </div>
          ) : isEmptyButConnected ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden p-6 flex flex-col pb-0">
                <div className="relative flex flex-col items-center justify-center text-center flex-1 gap-6">
                  <div className="space-y-2">
                    <div className="text-lg font-bold text-foreground">
                      No Active Solar Streams
                    </div>
                    <div className="mx-auto max-w-[400px] text-sm text-zinc-400">
                      Your portfolio is currently dormant. Delegate GLW to
                      generate weekly GLW rewards.
                    </div>
                  </div>

                  <div className="w-full max-w-md space-y-3">
                    {activeListingsCount > 0 ? (
                      <Button
                        className="h-12 w-full bg-foreground text-background hover:bg-foreground/90 font-mono dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                        onClick={() => {
                          trackEvent("dashboard_mining_launchpad_open_click", {
                            source,
                            wallet_connected: hasWallet,
                            wallet_address: normalizedWalletAddress,
                          });
                          setIsLaunchpadOpen(true);
                        }}
                      >
                        {activeMinersListingsCount > 0 &&
                        activeDelegationsListingsCount === 0 ? (
                          <>
                            <CashMinerIcon className="mr-2 h-6 w-6" />
                            Buy Miners
                          </>
                        ) : activeDelegationsListingsCount > 0 &&
                          activeMinersListingsCount === 0 ? (
                          <>
                            <Zap className="mr-2 h-4 w-4" />
                            Delegate GLW
                          </>
                        ) : (
                          <>
                            <Rocket className="mr-2 h-4 w-4" />
                            Browse Launchpad
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          Next batch in
                        </div>
                        <div className="solar-farm-next-batch-countdown">
                          <AnimatedCountdownDhms
                            remainingMs={remainingMs}
                            size="xl"
                            showLabels
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full max-w-lg">
                    <div className="h-px w-full bg-border/60 mb-4" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Link
                        href="https://glow.org/blog/guide-to-glow-mining"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-2xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-[color:var(--color-miner)]/50"
                        onClick={() => {
                          trackEvent("dashboard_education_click", {
                            source,
                            wallet_connected: hasWallet,
                            wallet_address: normalizedWalletAddress,
                            topic: "mining",
                            url: "https://glow.org/blog/guide-to-glow-mining",
                          });
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/50">
                            <CashMinerIcon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground transition-colors group-hover:text-[color:var(--color-miner-contrast)]">
                              How Mining Works
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              Learn about cash incentives & yield.
                            </div>
                          </div>
                        </div>
                      </Link>

                      <Link
                        href="https://glow.org/blog/guide-to-delegating-glow"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-2xl border border-border bg-muted/10 p-4 text-left transition-colors hover:bg-muted/20 hover:border-delegation-purple/50"
                        onClick={() => {
                          trackEvent("dashboard_education_click", {
                            source,
                            wallet_connected: hasWallet,
                            wallet_address: normalizedWalletAddress,
                            topic: "delegation",
                            url: "https://glow.org/blog/guide-to-delegating-glow",
                          });
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/50">
                            <DelegationIcon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground transition-colors group-hover:text-delegation-purple">
                              Guide to Delegation
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              Learn about deposit recovery & surplus.
                            </div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>

                <LaunchpadDialog
                  key={isLaunchpadOpen ? "launchpad-open" : "launchpad-closed"}
                  open={isLaunchpadOpen}
                  onOpenChange={setIsLaunchpadOpen}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Dashboard Stats */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-10 min-w-0">
                  {/* KPI: Current weekly payout */}
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <span className="text-[9px] uppercase text-muted-foreground/50 font-mono tracking-widest">
                      Current Weekly Payout
                    </span>
                    <div className="flex items-center gap-3 min-w-0">
                      <Sun className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                      <div className="flex flex-col leading-none">
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-semibold text-foreground tracking-tight font-mono">
                            {formatGlwCompact(stats.weeklyPayout)}
                          </span>
                          <span className="text-sm font-medium text-muted-foreground/50 font-mono">
                            GLW
                          </span>
                        </div>
                        {stats.weeklyProtocolDepositUsd > 0 ? (
                          <div className="text-[11px] font-bold text-muted-foreground font-mono">
                            + {formatUsdPrecise(stats.weeklyProtocolDepositUsd)}{" "}
                            USDG
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <DialogTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open farm performance details"
                    onClick={() => {
                      trackEvent("dashboard_mining_details_open_click", {
                        source,
                        wallet_connected: hasWallet,
                        wallet_address: normalizedWalletAddress,
                        cta: "stats_block",
                      });
                    }}
                    className={cn(
                      "w-full sm:w-auto bg-muted/30 px-2 py-2 sm:px-3 rounded-xl border border-border transition-colors cursor-pointer",
                      "hover:bg-muted/40 hover:border-border/80",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    )}
                  >
                    <div
                      className={cn(
                        "grid",
                        statsGridColsClass,
                        visibleStatsItems.length > 1
                          ? "divide-x divide-border"
                          : ""
                      )}
                    >
                      {visibleStatsItems.map(
                        ({ key, count, label, iconSrc, iconClassName }) => {
                          const Icon =
                            iconSrc === "/images/icons/cash-miner.svg"
                              ? CashMinerIcon
                              : iconSrc === "/images/icons/vault.svg"
                              ? DelegationIcon
                              : null;
                          return (
                            <div
                              key={key}
                              className="flex flex-col items-center sm:items-end px-2 sm:px-3"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-lg font-bold text-foreground font-mono">
                                  {count}
                                </span>
                                {Icon && (
                                  <Icon
                                    className={cn("w-4 h-4", iconClassName)}
                                  />
                                )}
                              </div>
                              <span className="text-[9px] uppercase text-muted-foreground font-mono tracking-wider">
                                {label}
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </button>
                </DialogTrigger>
              </div>

              {/* Chart */}
              <div className="flex-1 w-full min-h-[160px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={24}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                      opacity={0.5}
                    />
                    <XAxis
                      dataKey="week"
                      axisLine={false}
                      tickLine={false}
                      tick={(props: {
                        x: number;
                        y: number;
                        payload: { value: string };
                      }) => {
                        const isCurrent = props.payload.value === "Current";
                        return (
                          <text
                            x={props.x}
                            y={props.y + 10}
                            textAnchor="middle"
                            fill={
                              isCurrent
                                ? "var(--color-glow-orange)"
                                : "var(--muted-foreground)"
                            }
                            fontSize={10}
                            fontFamily="monospace"
                            fontWeight={isCurrent ? 600 : 400}
                          >
                            {props.payload.value}
                          </text>
                        );
                      }}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    />
                    <Bar
                      dataKey="minerReward"
                      stackId="a"
                      fill="var(--color-miner)"
                      radius={[0, 0, 4, 4]}
                      animationDuration={1500}
                    />
                    <Bar
                      dataKey="delegationReward"
                      stackId="a"
                      fill="var(--color-glow-purple)"
                      radius={[0, 0, 0, 0]}
                      animationDuration={1500}
                    />
                    <Bar
                      dataKey="otherReward"
                      stackId="a"
                      fill="var(--color-glow-green)"
                      radius={[4, 4, 0, 0]}
                      animationDuration={1500}
                    />
                    <Bar
                      dataKey="protocolDepositUsd"
                      fill="var(--color-glow-orange)"
                      radius={[4, 4, 0, 0]}
                      animationDuration={1500}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <FarmsPerformanceDialogContent
        walletAddress={walletAddress ?? undefined}
      />
    </Dialog>
  );
}

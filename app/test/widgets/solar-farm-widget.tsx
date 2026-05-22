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
import { Zap, LayoutGrid, Sun, Rocket, Gift } from "lucide-react";
import { CashMinerIcon, DelegationIcon } from "@/components/impact-icons";
import Link from "next/link";
import {
  useGlowLaunchpad,
  useMiningCenter,
  useMiningScore,
  useRewardsBreakdown,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { getNextSponsorListingsBatchAtET } from "@/utils/nextTuesdayET";
import {
  countActiveListings,
  filterPublicLaunchpadApplications,
} from "@/utils/launchpad";
import {
  AnimatedCountdownDhms,
  useCountdownTo,
} from "@/app/components/animated-countdown";
import {
  attachEstimatedWeeklyMiningCenterRewards,
  deriveMiningCenterSponsorshipsInProgress,
  estimateMiningCenterWeeklyGlw,
} from "@/utils/sponsorships-in-progress";
import { useWalletLaunchpadInProgress } from "@/hooks/use-wallet-launchpad-in-progress";
import {
  isSplitActivityStillActive,
  resolveLaunchpadActivityFarmId,
} from "@/utils/wallet-launchpad";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { trackEvent } from "@/lib/telemetry";
import { GENESIS_TIMESTAMP, getCurrentEpoch } from "@/utils/getCurrentEpoch";
import { isPendingStartStatus } from "@/utils/pending-start-cards";
import {
  formatProtocolDepositAsset,
  normalizeDashboardAsset,
  parseProtocolDepositTokenAmount,
} from "@/app/test/widgets/rewards-widget-utils";
import { useLang, type Strings } from "@/lib/i18n";

interface AssetHistoryPoint {
  weekNumber: number;
  dateLabel: string;
  tooltipDate: string;
  amount: number;
}

const FIRST_V2_WEEK = 97;
const WEEK_SECONDS = 7 * 86_400;

// Static placeholder data hoisted to module scope to avoid recreation on every render.
const PLACEHOLDER_ASSET_HISTORY: AssetHistoryPoint[] = [
  {
    weekNumber: 108,
    dateLabel: "Jan 3",
    tooltipDate: "Jan 3, 2026",
    amount: 1830,
  },
  {
    weekNumber: 109,
    dateLabel: "Jan 10",
    tooltipDate: "Jan 10, 2026",
    amount: 1950,
  },
  {
    weekNumber: 110,
    dateLabel: "Jan 17",
    tooltipDate: "Jan 17, 2026",
    amount: 2060,
  },
  {
    weekNumber: 111,
    dateLabel: "Jan 24",
    tooltipDate: "Jan 24, 2026",
    amount: 1885,
  },
  {
    weekNumber: 112,
    dateLabel: "Jan 31",
    tooltipDate: "Jan 31, 2026",
    amount: 2140,
  },
  {
    weekNumber: 113,
    dateLabel: "Feb 7",
    tooltipDate: "Feb 7, 2026",
    amount: 2080,
  },
  {
    weekNumber: 114,
    dateLabel: "Feb 14",
    tooltipDate: "Feb 14, 2026",
    amount: 2210,
  },
  {
    weekNumber: 115,
    dateLabel: "Feb 21",
    tooltipDate: "Feb 21, 2026",
    amount: 2305,
  },
  {
    weekNumber: 116,
    dateLabel: "Feb 28",
    tooltipDate: "Feb 28, 2026",
    amount: 2415,
  },
  {
    weekNumber: 117,
    dateLabel: "Mar 7",
    tooltipDate: "Mar 7, 2026",
    amount: 2490,
  },
];

function weekToDate(weekNumber: number) {
  const weekTimestamp = GENESIS_TIMESTAMP + (weekNumber + 1) * WEEK_SECONDS;
  return new Date(weekTimestamp * 1000);
}

function formatWeekAxisDate(weekNumber: number) {
  return weekToDate(weekNumber).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatWeekTooltipDate(weekNumber: number) {
  return weekToDate(weekNumber).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTokenCompact(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatTokenPrecise(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatGlwPrecise(value: number) {
  return formatTokenPrecise(value);
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

function getAssetBarColor(asset: string) {
  const normalized = asset.toUpperCase();
  switch (normalized) {
    case "GLW":
      return "var(--color-glow-purple)";
    case "USDG":
      return "var(--color-glow-green)";
    case "SGCTL":
      return "#22d3ee";
    case "USDC":
      return "#2081e2";
    case "GCTL":
      return "#22d3ee";
    default:
      return "var(--color-glow-green)";
  }
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

const AssetHistoryTooltip = ({
  active,
  payload,
  label,
  asset,
  earnedLabel,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number | string }>;
  label?: string;
  asset: string;
  earnedLabel: string;
}) => {
  if (active && payload && payload.length) {
    const amountRaw = payload.find((p) => p.dataKey === "amount")?.value ?? 0;
    const amount =
      typeof amountRaw === "number" ? amountRaw : Number(amountRaw ?? 0);

    return (
      <div className="min-w-[160px] rounded-xl border border-border/20 bg-card p-3 text-foreground">
        <p className="text-muted-foreground text-[10px] font-mono uppercase mb-2">
          {label}
        </p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-mono text-muted-foreground">{earnedLabel}</span>
          <span className="text-sm font-semibold text-foreground font-mono">
            {formatTokenPrecise(amount)} {asset}
          </span>
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
  labels,
}: {
  data: PendingFarmData | InProgressFarmData;
  isPending: boolean;
  onOpenDialog?: () => void;
  labels: Strings["widgets"]["solarFarm"];
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
          {labels.pendingBadge}
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
        {labels.inProgressBadge}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 transition-colors cursor-pointer hover:bg-muted/40 dark:hover:bg-muted/60"
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
                {isPending ? labels.pendingLabel : labels.inProgressLabel}
              </span>
              {!isPending && typeof data.progressPercent === "number" && (
                <>
                  <span>•</span>
                  <span className="tabular-nums">
                    {labels.percentFilled(Math.round(data.progressPercent))}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
              {isMiningCenter ? labels.costLabel : labels.delegatedLabel}
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
              {labels.estWeeklyCol}
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
                {isPending ? labels.pendingLabel : labels.inProgressLabel}
              </span>
            </div>
          </div>

          {/* COLUMN 2: LIFECYCLE BAR */}
          <div className="col-span-3 px-2">
            {!isPending && typeof data.progressPercent === "number" ? (
              <div className="text-xs font-mono text-muted-foreground">
                {labels.percentFilled(Math.round(data.progressPercent ?? 0))}
              </div>
            ) : null}
          </div>

          {/* COLUMN 3: KEY METRICS */}
          <div className="col-span-4 flex items-center justify-center gap-6">
            {!isPending && typeof data.progressPercent === "number" ? (
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    {labels.fundingLabel}
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
                      {labels.glwPerWeekEst}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="text-center min-w-[70px]">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                    {isMiningCenter ? labels.costLabel : labels.delegatedLabel}
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
                    {labels.estWeeklyCol}
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
  const { t } = useLang();
  const queryClient = useQueryClient();
  const { isConnecting, isReconnecting } = useAccount();
  const hasWallet = Boolean(walletAddress);
  const normalizedWalletAddress = walletAddress?.toLowerCase() ?? null;
  const source = "solar_farm_widget";
  const isWalletConnecting = isConnecting || isReconnecting;
  const isMinimal = variant === "minimal";
  const [isLaunchpadOpen, setIsLaunchpadOpen] = React.useState(false);
  const [selectedAsset, setSelectedAsset] = React.useState<string>("GLW");
  const [nextBatchAtMs, setNextBatchAtMs] = React.useState(() =>
    getNextSponsorListingsBatchAtET().getTime()
  );

  const { data, isLoading, isError, refetch } = useRewardsBreakdown({
    walletAddress: walletAddress ?? null,
    startWeek: FIRST_V2_WEEK,
    enabled: hasWallet,
  });
  const { farms: purchasedFarms = [] } = useWalletFarms({
    walletAddress: walletAddress ?? undefined,
    enabled: hasWallet,
  });

  const { applications: launchpadApplications } = useGlowLaunchpad();
  const extraLiveLaunchpadApplications = React.useMemo(
    () => filterPublicLaunchpadApplications(launchpadApplications),
    [launchpadApplications],
  );
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
  const {
    sponsorListingById,
    sponsorshipsInProgress,
    sponsorshipsInProgressWithEstimates,
    isRewardScoresLoading,
    isSgctlRewardScoresLoading,
  } = useWalletLaunchpadInProgress({
    splitsActivity,
    walletAddress: walletAddress ?? null,
    enabled: hasWallet,
  });

  const recentPendingMiningFarmIds = React.useMemo(() => {
    return new Set(
      (data?.recentPurchasesWithoutRewards || [])
        .filter((purchase) => purchase.types.includes("mining-center"))
        .map((purchase) => purchase.farmId)
    );
  }, [data?.recentPurchasesWithoutRewards]);

  const pendingMiningPurchasesByApplication = React.useMemo(() => {
    const map = new Map<
      string,
      { applicationId: string; farmId: string; userSteps: number }
    >();
    if (!data) return map;

    for (const evt of splitsActivity) {
      if (evt.fractionType !== "mining-center") continue;
      if (
        !isPendingStartStatus({
          fractionType: "mining-center",
          status: evt.fractionStatus ?? "",
        })
      ) {
        continue;
      }

      const farmId = evt.farmId ?? evt.applicationId;
      if (!farmId || !recentPendingMiningFarmIds.has(farmId)) continue;

      const eventEpoch = getCurrentEpoch(Number(evt.timestamp ?? 0));
      if (eventEpoch <= data.weekRange.endWeek) continue;

      const existing = map.get(evt.applicationId) ?? {
        applicationId: evt.applicationId,
        farmId,
        userSteps: 0,
      };
      existing.userSteps += evt.stepsPurchased ?? 0;
      map.set(evt.applicationId, existing);
    }

    return map;
  }, [data, recentPendingMiningFarmIds, splitsActivity]);

  const hasMiningCenterSplits = React.useMemo(() => {
    return splitsActivity.some((s) => s.fractionType === "mining-center");
  }, [splitsActivity]);

  const { applications: miningCenterApplications } = useMiningCenter({
    filters: { paymentCurrency: "USDC" },
    enabled: hasWallet && hasMiningCenterSplits,
  });
  const { applications: pendingMiningCenterListings = [] } = useMiningCenter({
    filters: { paymentCurrency: "USDC", includeFilled: true },
    enabled: hasWallet && pendingMiningPurchasesByApplication.size > 0,
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

  const pendingMiningCenterListingById = React.useMemo(() => {
    const map = new Map<string, (typeof pendingMiningCenterListings)[number]>();
    for (const app of pendingMiningCenterListings) {
      map.set(app.id, app);
    }
    return map;
  }, [pendingMiningCenterListings]);

  const pendingMiningAppsForMiningScore = React.useMemo(() => {
    return Array.from(pendingMiningPurchasesByApplication.values())
      .map((entry) => pendingMiningCenterListingById.get(entry.applicationId))
      .filter((app): app is (typeof pendingMiningCenterListings)[number] =>
        Boolean(app)
      );
  }, [pendingMiningCenterListingById, pendingMiningPurchasesByApplication]);

  const miningScoreApplications = React.useMemo(() => {
    const byId = new Map<string, (typeof miningCenterAppsForMiningScore)[number]>();
    for (const app of miningCenterAppsForMiningScore) {
      byId.set(app.id, app);
    }
    for (const app of pendingMiningAppsForMiningScore) {
      byId.set(app.id, app);
    }
    return Array.from(byId.values());
  }, [miningCenterAppsForMiningScore, pendingMiningAppsForMiningScore]);

  const { miningScoreMap, isLoading: isMiningScoreLoading } = useMiningScore({
    applications: miningScoreApplications,
    extraLiveApplications: extraLiveLaunchpadApplications,
    enabled: hasWallet && miningScoreApplications.length > 0,
  });

  const miningCenterInProgressWithEstimates = React.useMemo(() => {
    return attachEstimatedWeeklyMiningCenterRewards({
      sponsorshipsInProgress: miningCenterInProgress,
      miningScoreMap,
    });
  }, [miningCenterInProgress, miningScoreMap]);

  const pendingMiningWeeklyGlwByFarmId = React.useMemo(() => {
    const map = new Map<string, number>();

    for (const entry of pendingMiningPurchasesByApplication.values()) {
      const estimatedWeeklyGlw = estimateMiningCenterWeeklyGlw({
        miningScore: miningScoreMap.get(entry.applicationId),
        userSteps: entry.userSteps,
      });
      if (estimatedWeeklyGlw <= 0) continue;

      map.set(
        entry.farmId,
        (map.get(entry.farmId) ?? 0) + estimatedWeeklyGlw
      );
    }

    return map;
  }, [miningScoreMap, pendingMiningPurchasesByApplication]);

  const isWidgetLoading = isLoading || isSplitsActivityLoading;
  const isWidgetError = isError || isSplitsActivityError;

  const activeDelegationsListingsCount = React.useMemo(() => {
    return countActiveListings(launchpadApplications);
  }, [launchpadApplications]);
  const activeMinersListingsCount = React.useMemo(() => {
    return countActiveListings(minersApplications);
  }, [minersApplications]);
  const activeListingsCount =
    activeDelegationsListingsCount + activeMinersListingsCount;

  const pendingStartLaunchpadStats = React.useMemo(() => {
    const byFarm = new Map<
      string,
      {
        farmId: string;
        estimatedUserWeeklyGlw: number;
        estimatedUserWeeklyPd: number;
        pdAsset: string | null;
      }
    >();

    for (const evt of splitsActivity) {
      if (evt.fractionType !== "launchpad") continue;
      const status = (evt.fractionStatus ?? "").toLowerCase();
      if (status !== "filled") continue;

      const listing = sponsorListingById.get(evt.applicationId);
      const farmId = resolveLaunchpadActivityFarmId({
        applicationId: evt.applicationId,
        activityFarmId: evt.farmId,
        listingFarmId: listing?.farmId,
      });
      if (!farmId) continue;

      const farmMetadata = purchasedFarms.find((farm) => farm.farmId === farmId);
      const rewards = farmMetadata?.userWeeklyRewards;
      if (!rewards) continue;

      const pdAsset = formatProtocolDepositAsset(rewards.protocolDepositAsset);
      const delegationInflationGlw = rewards.glwInflationRewardsFromDelegation
        ? parseGlwFromWei(rewards.glwInflationRewardsFromDelegation)
        : parseGlwFromWei(rewards.glwInflationRewards);
      const pdAmount = parseProtocolDepositTokenAmount(
        rewards.protocolDepositRewards,
        pdAsset
      );
      const pdGlw = pdAsset === "GLW" ? pdAmount : 0;

      const existing = byFarm.get(farmId) ?? {
        farmId,
        estimatedUserWeeklyGlw: 0,
        estimatedUserWeeklyPd: 0,
        pdAsset: pdAsset === "GLW" ? null : pdAsset,
      };

      existing.estimatedUserWeeklyGlw += delegationInflationGlw + pdGlw;
      if (pdAsset !== "GLW" && pdAmount > 0) {
        existing.estimatedUserWeeklyPd += pdAmount;
        existing.pdAsset = pdAsset;
      }
      byFarm.set(farmId, existing);
    }

    return Array.from(byFarm.values());
  }, [purchasedFarms, splitsActivity, sponsorListingById]);

  const inProgressEstimatedByAsset = React.useMemo(() => {
    const totals = new Map<string, number>();

    const add = (assetInput: string, amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      const asset = assetInput.toUpperCase();
      totals.set(asset, (totals.get(asset) ?? 0) + amount);
    };

    for (const item of sponsorshipsInProgressWithEstimates) {
      add("GLW", item.estimatedUserWeeklyGlw ?? 0);
      if (item.estimatedUserWeeklyPdAsset) {
        add(item.estimatedUserWeeklyPdAsset, item.estimatedUserWeeklyPd ?? 0);
      }
    }
    for (const item of miningCenterInProgressWithEstimates) {
      add("GLW", item.estimatedUserWeeklyGlw ?? 0);
    }
    for (const item of pendingStartLaunchpadStats) {
      add("GLW", item.estimatedUserWeeklyGlw ?? 0);
      if (item.pdAsset) {
        add(item.pdAsset, item.estimatedUserWeeklyPd ?? 0);
      }
    }
    for (const amount of pendingMiningWeeklyGlwByFarmId.values()) {
      add("GLW", amount);
    }

    return totals;
  }, [
    pendingMiningWeeklyGlwByFarmId,
    pendingStartLaunchpadStats,
    miningCenterInProgressWithEstimates,
    sponsorshipsInProgressWithEstimates,
  ]);

  const {
    availableAssets,
    filledHistoryByAsset,
    rawHistoryByAsset,
    hasHistoricalRewards,
  } = React.useMemo(() => {
    const amountsByAsset = new Map<string, Map<number, number>>();
    const currentWeek = Math.max(FIRST_V2_WEEK, getCurrentEpoch() - 1);

    const addAmount = (
      assetInput: string | null | undefined,
      week: number,
      amount: number,
    ) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      if (!Number.isFinite(week) || week < FIRST_V2_WEEK || week > currentWeek) {
        return;
      }

      const asset = normalizeDashboardAsset(assetInput);
      const byWeek = amountsByAsset.get(asset) ?? new Map<number, number>();
      byWeek.set(week, (byWeek.get(week) ?? 0) + amount);
      amountsByAsset.set(asset, byWeek);
    };

    if (data) {
      for (const farm of data.farmDetails) {
        for (const week of farm.weeklyBreakdown) {
          addAmount("GLW", week.weekNumber, parseGlwFromWei(week.totalRewards));
        }
      }

      for (const farm of data.otherFarmsWithRewards?.farms ?? []) {
        const pdAsset = normalizeDashboardAsset(farm.asset);
        for (const week of farm.weeklyBreakdown) {
          addAmount("GLW", week.weekNumber, parseGlwFromWei(week.inflationRewards));
          addAmount(
            pdAsset,
            week.weekNumber,
            parseProtocolDepositTokenAmount(week.protocolDepositRewards, pdAsset)
          );
        }
      }
    }

    const assets = Array.from(
      new Set([...amountsByAsset.keys(), ...inProgressEstimatedByAsset.keys()])
    ).sort((a, b) => {
      if (a === "GLW") return -1;
      if (b === "GLW") return 1;
      return a.localeCompare(b);
    });
    const availableAssets = assets.length > 0 ? assets : ["GLW"];

    const filledHistoryByAsset = new Map<string, AssetHistoryPoint[]>();
    const rawHistoryByAsset = new Map<string, AssetHistoryPoint[]>();

    for (const asset of availableAssets) {
      const byWeek = amountsByAsset.get(asset) ?? new Map<number, number>();
      const rawPoints = Array.from(byWeek.entries())
        .sort(([a], [b]) => a - b)
        .map(([weekNumber, amount]) => ({
          weekNumber,
          dateLabel: formatWeekAxisDate(weekNumber),
          tooltipDate: formatWeekTooltipDate(weekNumber),
          amount,
        }));
      rawHistoryByAsset.set(asset, rawPoints);

      const filledPoints: AssetHistoryPoint[] = [];
      if (rawPoints.length > 0) {
        const firstWeek = rawPoints[0]?.weekNumber ?? FIRST_V2_WEEK;
        const lastWeek = rawPoints.at(-1)?.weekNumber ?? firstWeek;

        for (let week = firstWeek; week <= lastWeek; week += 1) {
          filledPoints.push({
            weekNumber: week,
            dateLabel: formatWeekAxisDate(week),
            tooltipDate: formatWeekTooltipDate(week),
            amount: byWeek.get(week) ?? 0,
          });
        }
      }
      filledHistoryByAsset.set(asset, filledPoints);
    }

    const hasHistoricalRewards = Array.from(rawHistoryByAsset.values()).some(
      (points) => points.length > 0
    );

    return {
      availableAssets,
      filledHistoryByAsset,
      rawHistoryByAsset,
      hasHistoricalRewards,
    };
  }, [data, inProgressEstimatedByAsset]);

  React.useEffect(() => {
    if (!availableAssets.includes(selectedAsset)) {
      setSelectedAsset(availableAssets[0] ?? "GLW");
    }
  }, [availableAssets, selectedAsset]);

  const selectedAssetRawHistory = React.useMemo<AssetHistoryPoint[]>(() => {
    return rawHistoryByAsset.get(selectedAsset) ?? [];
  }, [rawHistoryByAsset, selectedAsset]);

  const selectedAssetEstimatedInProgress = React.useMemo(() => {
    return inProgressEstimatedByAsset.get(selectedAsset) ?? 0;
  }, [inProgressEstimatedByAsset, selectedAsset]);

  const estimatedOnlyChartData = React.useMemo<AssetHistoryPoint[]>(() => {
    if (selectedAssetRawHistory.length > 0) return [];
    if (selectedAssetEstimatedInProgress <= 0) return [];

    const estimateWeek = Math.max(FIRST_V2_WEEK, getCurrentEpoch());
    return [
      {
        weekNumber: estimateWeek,
        dateLabel: t.widgets.solarFarm.estAbbrev,
        tooltipDate: t.widgets.solarFarm.estInProgressRewardsTooltip,
        amount: selectedAssetEstimatedInProgress,
      },
    ];
  }, [selectedAssetEstimatedInProgress, selectedAssetRawHistory]);

  const chartData = React.useMemo<AssetHistoryPoint[]>(() => {
    const historical = filledHistoryByAsset.get(selectedAsset) ?? [];
    if (historical.length > 0) return historical;
    return estimatedOnlyChartData;
  }, [estimatedOnlyChartData, filledHistoryByAsset, selectedAsset]);

  const chartBarColor = React.useMemo(
    () => getAssetBarColor(selectedAsset),
    [selectedAsset]
  );

  const chartMinWidth = React.useMemo(
    () => Math.max(720, chartData.length * 18),
    [chartData.length]
  );

  const xAxisInterval = React.useMemo(
    () => Math.max(0, Math.floor(chartData.length / 8) - 1),
    [chartData.length]
  );

  const stats = React.useMemo(() => {
    const historicalLast = selectedAssetRawHistory.at(-1)?.amount ?? 0;
    const isEstimatedWeeklyPayout =
      historicalLast <= 0 && selectedAssetEstimatedInProgress > 0;
    const weeklyPayout = isEstimatedWeeklyPayout
      ? selectedAssetEstimatedInProgress
      : historicalLast;

    // Count each farm once across rewarded + still-active splits, regardless
    // of how many delegation legs (e.g. GLW + sGCTL) it has. Mirrors
    // portfolio-summary-widget so the two panels stay in sync.
    const delegationFarmIds = new Set<string>();
    const minerFarmIds = new Set<string>();

    if (data) {
      for (const farm of data.farmDetails) {
        if (farm.type === "launchpad") {
          delegationFarmIds.add(farm.farmId);
        } else if (farm.type === "mining-center") {
          minerFarmIds.add(farm.farmId);
        }
      }
    }

    for (const split of splitsActivity) {
      if (!isSplitActivityStillActive({ split })) continue;
      const farmId = split.farmId ?? split.applicationId;
      if (!farmId) continue;
      if (split.fractionType === "launchpad") {
        delegationFarmIds.add(farmId);
      } else if (split.fractionType === "mining-center") {
        minerFarmIds.add(farmId);
      }
    }

    return {
      weeklyPayout,
      isEstimatedWeeklyPayout,
      activeMiners: minerFarmIds.size,
      activeDelegations: delegationFarmIds.size,
      activeOtherRewards:
        data?.otherFarmsWithRewards?.count ??
        data?.otherFarmsWithRewards?.farms.length ??
        0,
    };
  }, [
    data,
    selectedAssetEstimatedInProgress,
    selectedAssetRawHistory,
    splitsActivity,
  ]);

  const visibleStatsItems = React.useMemo(() => {
    const items = [
      {
        key: "miners" as const,
        count: stats.activeMiners,
        label: t.widgets.solarFarm.miners,
        iconSrc: "/images/icons/cash-miner.svg",
        iconClassName: "text-miner",
      },
      {
        key: "delegations" as const,
        count: stats.activeDelegations,
        label: t.widgets.solarFarm.delegations,
        iconSrc: "/images/icons/vault.svg",
        iconClassName: "text-glow-purple",
      },
      {
        key: "other" as const,
        count: stats.activeOtherRewards,
        label: t.widgets.solarFarm.other,
        Icon: Gift,
        iconClassName: "text-[color:var(--color-glow-green)]",
      },
    ].filter((i) => i.count > 0);

    return items.length ? items : [];
  }, [stats.activeDelegations, stats.activeMiners, stats.activeOtherRewards, t.widgets.solarFarm]);

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
    pendingStartLaunchpadStats.length > 0 ||
    pendingMiningPurchasesByApplication.size > 0 ||
    ((isRewardScoresLoading || isSgctlRewardScoresLoading) &&
      sponsorshipsInProgress.length > 0) ||
    (isMiningScoreLoading && miningCenterInProgress.length > 0);

  const isEmptyButConnected =
    hasWallet &&
    !isWidgetLoading &&
    !isWidgetError &&
    !hasHistoricalRewards &&
    !hasAnyRewardsOrActivity &&
    !hasInProgressSponsorships;

  const handleBatchCountdownComplete = React.useCallback(() => {
    setNextBatchAtMs(getNextSponsorListingsBatchAtET().getTime());
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
            ? "bg-muted/20 dark:bg-muted/30 border border-border/10 dark:border-border/20 rounded-2xl h-full"
            : "h-full lg:max-h-[380px] bg-card dark:bg-card border-border/20"
        )}
      >
        {!isEmptyButConnected && (
          <CardHeader className="pb-0 pt-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
                {t.widgets.solarFarm.title}
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
                  <span>{t.widgets.solarFarm.viewDetails}</span>
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
                        {t.widgets.solarFarm.currentWeeklyPayout}
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

                    <div className="w-full sm:w-auto bg-muted/30 dark:bg-muted/50 px-3 py-2 sm:px-4 rounded-xl border border-border/20 dark:border-border/40">
                      <div className="grid grid-cols-3 divide-x divide-border">
                        <div className="flex flex-col items-center sm:items-end px-2 sm:px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg font-bold text-foreground font-mono">
                              3
                            </span>
                            <CashMinerIcon className="w-6 h-6" />
                          </div>
                          <span className="text-[9px] uppercase text-muted-foreground font-mono tracking-wider">
                            {t.widgets.solarFarm.miners}
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
                            {t.widgets.solarFarm.delegations}
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
                            {t.widgets.solarFarm.other}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chart (placeholder) */}
                  <div className="mt-6 h-[190px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={PLACEHOLDER_ASSET_HISTORY} barSize={22}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="var(--border)"
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="dateLabel"
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
                          dataKey="amount"
                          fill="var(--color-miner)"
                          radius={[4, 4, 0, 0]}
                          animationDuration={1200}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    {t.widgets.solarFarm.connectWalletKicker}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t.widgets.solarFarm.connectWalletBody}
                  </div>
                </div>
              </div>
            )
          ) : isWidgetLoading ? (
            <SolarFarmSkeleton />
          ) : isWidgetError ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-center">
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {t.widgets.solarFarm.errorUnableToLoad}
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
                {t.widgets.solarFarm.retry}
              </Button>
            </div>
          ) : isEmptyButConnected ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden p-6 flex flex-col pb-0">
                <div className="relative flex flex-col items-center justify-center text-center flex-1 gap-6">
                  <div className="space-y-2">
                    <div className="text-lg font-bold text-foreground">
                      {t.widgets.solarFarm.noActiveStreamsTitle}
                    </div>
                    <div className="mx-auto max-w-[400px] text-sm text-zinc-400">
                      {t.widgets.solarFarm.noActiveStreamsBody}
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
                            {t.widgets.solarFarm.buyMiners}
                          </>
                        ) : activeDelegationsListingsCount > 0 &&
                          activeMinersListingsCount === 0 ? (
                          <>
                            <Zap className="mr-2 h-4 w-4" />
                            {t.widgets.solarFarm.delegateGlw}
                          </>
                        ) : (
                          <>
                            <Rocket className="mr-2 h-4 w-4" />
                            {t.widgets.solarFarm.browseLaunchpad}
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          {t.widgets.solarFarm.nextBatchIn}
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
                        className="group rounded-2xl border border-border/20 dark:border-border/40 bg-muted/10 dark:bg-muted/20 p-4 text-left transition-colors hover:bg-muted/20 dark:hover:bg-muted/30 hover:border-[color:var(--color-miner)]/50"
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
                              {t.widgets.solarFarm.howMiningWorks}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {t.widgets.solarFarm.howMiningWorksBody}
                            </div>
                          </div>
                        </div>
                      </Link>

                      <Link
                        href="https://glow.org/blog/guide-to-delegating-glow"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-2xl border border-border/20 dark:border-border/40 bg-muted/10 dark:bg-muted/20 p-4 text-left transition-colors hover:bg-muted/20 dark:hover:bg-muted/30 hover:border-delegation-purple/50"
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
                              {t.widgets.solarFarm.guideDelegation}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {t.widgets.solarFarm.guideDelegationBody}
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
                  {/* KPI: Latest weekly earnings */}
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <span className="text-[9px] uppercase text-muted-foreground/50 font-mono tracking-widest">
                      {stats.isEstimatedWeeklyPayout
                        ? t.widgets.solarFarm.estWeeklyRewards
                        : t.widgets.solarFarm.latestWeeklyEarnings}
                    </span>
                    <div className="flex items-center gap-3 min-w-0">
                      <Sun className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                      <div className="flex flex-col leading-none">
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-semibold text-foreground tracking-tight font-mono">
                            {stats.isEstimatedWeeklyPayout ? "~" : ""}
                            {formatTokenCompact(stats.weeklyPayout)}
                          </span>
                          <span className="text-sm font-medium text-muted-foreground/50 font-mono">
                            {selectedAsset}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {availableAssets.length > 1 ? (
                    <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                      <span className="text-[9px] uppercase text-muted-foreground/50 font-mono tracking-widest">
                        {t.widgets.solarFarm.assetLabel}
                      </span>
                      <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                        <SelectTrigger className="h-9 w-full sm:w-[132px] rounded-full border-border/20 bg-muted/30 text-xs font-mono">
                          <SelectValue placeholder={t.widgets.solarFarm.assetLabel} />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {availableAssets.map((asset) => (
                            <SelectItem key={asset} value={asset}>
                              {asset}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>

                <DialogTrigger asChild>
                  <button
                    type="button"
                    aria-label={t.widgets.solarFarm.farmDetailsAria}
                    onClick={() => {
                      trackEvent("dashboard_mining_details_open_click", {
                        source,
                        wallet_connected: hasWallet,
                        wallet_address: normalizedWalletAddress,
                        cta: "stats_block",
                      });
                    }}
                    className={cn(
                      "w-full sm:w-auto bg-muted/30 dark:bg-muted/50 px-2 py-2 sm:px-3 rounded-xl border border-border/20 dark:border-border/40 transition-colors cursor-pointer",
                      "hover:bg-muted/40 dark:hover:bg-muted/60 hover:border-border/40 dark:hover:border-border/60",
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
                <div className="h-full overflow-x-auto overflow-y-hidden">
                  <div
                    className="h-full"
                    style={{ minWidth: `${chartMinWidth}px` }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} barSize={14}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="var(--border)"
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="dateLabel"
                          interval={xAxisInterval}
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: "var(--muted-foreground)",
                            fontSize: 10,
                            fontFamily: "monospace",
                          }}
                          dy={10}
                        />
                        <Tooltip
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.tooltipDate ?? ""
                          }
                          content={
                            <AssetHistoryTooltip
                              asset={selectedAsset}
                              earnedLabel={t.widgets.solarFarm.earned}
                            />
                          }
                          cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                        />
                        <Bar
                          dataKey="amount"
                          fill={chartBarColor}
                          radius={[4, 4, 0, 0]}
                          animationDuration={900}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
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

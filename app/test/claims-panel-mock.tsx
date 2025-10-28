"use client";

import React from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Gift,
  Coins,
  Sparkles,
  AlertCircle,
  ChevronRight,
  Clock,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ClaimableReward,
  WeeklyClaimableRewards,
} from "@/hooks/useClaimableRewards";
import type {
  ClaimStage,
  ClaimStageStatus,
} from "@/hooks/useRewardsKernelWrapper";
import {
  TransactionDialog,
  type TransactionDetail,
} from "@/components/dialogs/transaction-dialog";
import { getCurrentEpoch, GENESIS_TIMESTAMP } from "@/utils/getCurrentEpoch";

// Currency configurations
const CURRENCY_CONFIG = {
  GLW: {
    icon: <Sparkles className="w-4 h-4" />,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    label: "GLOW",
  },
  USDC: {
    icon: <Coins className="w-4 h-4" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    label: "USDC",
  },
  USDG: {
    icon: <Coins className="w-4 h-4" />,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    label: "USDG",
  },
} as const;

type CurrencyKey = keyof typeof CURRENCY_CONFIG;

type ClaimStageState = {
  status: ClaimStageStatus;
  txHash?: string | null;
  message?: string;
};

type ClaimStageMap = Record<ClaimStage, ClaimStageState>;

interface ClaimInitiationPayload {
  weekData: WeeklyClaimableRewards;
  claimType: "both" | "v2Only";
  rewardsToClaim: ClaimableReward[];
}

const CLAIM_STAGE_ORDER: ClaimStage[] = ["inflation", "protocolDeposits"];

const CLAIM_STAGE_META: Record<
  ClaimStage,
  { label: string; icon: React.ReactNode }
> = {
  inflation: {
    label: "Inflation Rewards",
    icon: <Sparkles className="w-4 h-4" />,
  },
  protocolDeposits: {
    label: "Protocol Deposit Rewards",
    icon: <Coins className="w-4 h-4" />,
  },
};

const CLAIM_STATUS_LABELS: Record<ClaimStageStatus, string> = {
  pending: "Pending",
  inProgress: "In progress",
  success: "Completed",
  skipped: "Skipped",
  error: "Failed",
};

const CLAIM_STATUS_STYLES: Record<ClaimStageStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  inProgress: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600",
  skipped: "bg-muted text-muted-foreground",
  error: "bg-destructive/10 text-destructive",
};

// Helper to format week number to date
function formatWeekDate(week: number): string {
  const weekTimestamp = GENESIS_TIMESTAMP + week * 7 * 86400;
  const date = new Date(weekTimestamp * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Generate mock data
function generateMockData() {
  const currentEpoch = getCurrentEpoch();

  const mockWeeklyBreakdown: WeeklyClaimableRewards[] = [
    {
      week: currentEpoch - 2,
      rewards: [
        {
          week: currentEpoch - 2,
          currency: "GLW",
          amount: "89.1234",
          amountRaw: "89123400000000000000",
          type: "glowInflation" as const,
        },
        {
          week: currentEpoch - 2,
          currency: "USDC",
          amount: "32.45",
          amountRaw: "32450000",
          type: "protocolDeposit" as const,
        },
      ],
      totalGlw: "89.1234",
      totalProtocolDeposit: new Map([["USDC", "32.45"]]),
      isFinalized: false,
      weeksUntilClaimable: 2,
    },
    {
      week: currentEpoch - 4,
      rewards: [
        {
          week: currentEpoch - 4,
          currency: "GLW",
          amount: "125.5432",
          amountRaw: "125543200000000000000",
          type: "glowInflation" as const,
        },
        {
          week: currentEpoch - 4,
          currency: "GLW",
          amount: "23.45",
          amountRaw: "23450000000000000000",
          type: "protocolDeposit" as const,
        },
      ],
      totalGlw: "125.5432",
      totalProtocolDeposit: new Map([["GLW", "23.45"]]),
      isFinalized: true,
      weeksUntilClaimable: 0,
    },
    {
      week: currentEpoch - 5,
      rewards: [
        {
          week: currentEpoch - 5,
          currency: "GLW",
          amount: "156.8901",
          amountRaw: "156890100000000000000",
          type: "glowInflation" as const,
        },
        {
          week: currentEpoch - 5,
          currency: "USDG",
          amount: "67.89",
          amountRaw: "67890000",
          type: "protocolDeposit" as const,
        },
      ],
      totalGlw: "156.8901",
      totalProtocolDeposit: new Map([["USDG", "67.89"]]),
      isFinalized: true,
      weeksUntilClaimable: 0,
    },
    {
      week: currentEpoch - 6,
      rewards: [
        {
          week: currentEpoch - 6,
          currency: "GLW",
          amount: "203.4567",
          amountRaw: "203456700000000000000",
          type: "glowInflation" as const,
        },
        {
          week: currentEpoch - 6,
          currency: "USDC",
          amount: "89.12",
          amountRaw: "89120000",
          type: "protocolDeposit" as const,
        },
      ],
      totalGlw: "203.4567",
      totalProtocolDeposit: new Map([["USDC", "89.12"]]),
      isFinalized: true,
      weeksUntilClaimable: 0,
    },
    {
      week: currentEpoch - 7,
      rewards: [
        {
          week: currentEpoch - 7,
          currency: "GLW",
          amount: "178.2345",
          amountRaw: "178234500000000000000",
          type: "glowInflation" as const,
        },
        {
          week: currentEpoch - 7,
          currency: "USDG",
          amount: "54.67",
          amountRaw: "54670000",
          type: "protocolDeposit" as const,
        },
      ],
      totalGlw: "178.2345",
      totalProtocolDeposit: new Map([["USDG", "54.67"]]),
      isFinalized: true,
      weeksUntilClaimable: 0,
    },
  ];

  const aggregatedTotals = {
    GLW: "687.5745",
    USDC: "89.12",
    USDG: "122.56",
  };

  return { mockWeeklyBreakdown, aggregatedTotals };
}

export function ClaimsPanelMock() {
  const { mockWeeklyBreakdown, aggregatedTotals } = generateMockData();
  const [claimedWeeks, setClaimedWeeks] = React.useState<Set<number>>(
    new Set()
  );
  const [isClaimingAll, setIsClaimingAll] = React.useState(false);
  const [isClaimingWeek, setIsClaimingWeek] = React.useState<number | null>(
    null
  );

  const [activeClaim, setActiveClaim] =
    React.useState<ClaimInitiationPayload | null>(null);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = React.useState(false);
  const [claimDialogStatus, setClaimDialogStatus] = React.useState<
    "review" | "processing" | "success" | "error"
  >("review");
  const [claimDialogError, setClaimDialogError] = React.useState<string | null>(
    null
  );
  const [claimDialogInfo, setClaimDialogInfo] = React.useState<string | null>(
    null
  );
  const [claimStageStatuses, setClaimStageStatuses] =
    React.useState<ClaimStageMap>({
      inflation: { status: "pending" },
      protocolDeposits: { status: "pending" },
    });

  const createInitialStageState = React.useCallback(
    (payload: ClaimInitiationPayload): ClaimStageMap => {
      const hasInflationRewards = payload.weekData.rewards.some(
        (reward) => reward.type === "glowInflation"
      );
      const hasProtocolDepositRewards = payload.weekData.rewards.some(
        (reward) => reward.type === "protocolDeposit"
      );

      const inflationStage: ClaimStageState = hasInflationRewards
        ? payload.claimType === "v2Only"
          ? {
              status: "skipped",
              message: "Inflation rewards already claimed.",
            }
          : { status: "pending" }
        : { status: "skipped", message: "No inflation rewards this week." };

      const protocolStage: ClaimStageState = hasProtocolDepositRewards
        ? { status: "pending" }
        : {
            status: "skipped",
            message: "No protocol deposit rewards this week.",
          };

      return {
        inflation: inflationStage,
        protocolDeposits: protocolStage,
      };
    },
    []
  );

  const resetClaimDialog = React.useCallback(() => {
    setActiveClaim(null);
    setIsClaimDialogOpen(false);
    setClaimDialogStatus("review");
    setClaimDialogError(null);
    setClaimDialogInfo(null);
    setClaimStageStatuses({
      inflation: { status: "pending" },
      protocolDeposits: { status: "pending" },
    });
  }, []);

  const handleInitiateClaim = React.useCallback(
    (payload: ClaimInitiationPayload) => {
      const initialStatuses = createInitialStageState(payload);
      setClaimStageStatuses(initialStatuses);
      setActiveClaim(payload);
      setClaimDialogStatus("review");
      setClaimDialogError(null);
      setClaimDialogInfo(null);
      setIsClaimDialogOpen(true);
    },
    [createInitialStageState]
  );

  const handleDialogOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        if (claimDialogStatus === "processing") {
          return;
        }
        resetClaimDialog();
      } else {
        setIsClaimDialogOpen(true);
      }
    },
    [claimDialogStatus, resetClaimDialog]
  );

  // Mock claim function
  const handleConfirmClaim = React.useCallback(async () => {
    if (!activeClaim) return;

    setClaimDialogStatus("processing");
    setClaimDialogError(null);
    setClaimDialogInfo(null);

    const hasInflation = activeClaim.rewardsToClaim.some(
      (r) => r.type === "glowInflation"
    );
    const hasProtocolDeposits = activeClaim.rewardsToClaim.some(
      (r) => r.type === "protocolDeposit"
    );

    try {
      // Simulate inflation claim
      if (hasInflation && activeClaim.claimType !== "v2Only") {
        setClaimStageStatuses((prev) => ({
          ...prev,
          inflation: {
            status: "inProgress",
            message: "Submitting inflation rewards claim...",
          },
        }));

        await new Promise((resolve) => setTimeout(resolve, 1500));

        setClaimStageStatuses((prev) => ({
          ...prev,
          inflation: {
            status: "success",
            txHash: `0x${Math.random()
              .toString(16)
              .substring(2)}1234567890abcdef1234567890`,
            message: "Inflation rewards claimed successfully",
          },
        }));
      }

      // Simulate protocol deposit claim
      if (hasProtocolDeposits) {
        setClaimStageStatuses((prev) => ({
          ...prev,
          protocolDeposits: {
            status: "inProgress",
            message: "Submitting protocol deposit rewards claim...",
          },
        }));

        await new Promise((resolve) => setTimeout(resolve, 1500));

        setClaimStageStatuses((prev) => ({
          ...prev,
          protocolDeposits: {
            status: "success",
            txHash: `0x${Math.random()
              .toString(16)
              .substring(2)}abcdef1234567890abcdef`,
            message: "Protocol deposit rewards claimed successfully",
          },
        }));
      }

      setClaimDialogStatus("success");
      setClaimedWeeks((prev) => {
        const next = new Set(prev);
        next.add(activeClaim.weekData.week);
        return next;
      });

      toast.success(
        `Successfully claimed rewards for week ${activeClaim.weekData.week}`
      );
    } catch (error: any) {
      console.error("Claim confirmation error:", error);
      setClaimDialogStatus("error");
      setClaimDialogError(
        error?.message ||
          "We were unable to complete your claim. Please try again."
      );
    }
  }, [activeClaim]);

  const transactionDetails = React.useMemo<TransactionDetail[]>(() => {
    if (!activeClaim) return [];

    const details: TransactionDetail[] = [
      {
        label: "Week",
        value: `#${activeClaim.weekData.week}`,
      },
    ];

    const inflationRewards = activeClaim.weekData.rewards.filter(
      (reward) => reward.type === "glowInflation"
    );
    if (inflationRewards.length > 0) {
      const total = inflationRewards.reduce(
        (sum, reward) => sum + Number.parseFloat(reward.amount),
        0
      );
      details.push({
        label: "Inflation Rewards",
        value: `${total.toFixed(4)} GLW`,
      });
    }

    const protocolRewards = activeClaim.weekData.rewards.filter(
      (reward) => reward.type === "protocolDeposit"
    );
    if (protocolRewards.length > 0) {
      const totals = new Map<string, number>();
      protocolRewards.forEach((reward) => {
        const existing = totals.get(reward.currency) ?? 0;
        totals.set(
          reward.currency,
          existing + Number.parseFloat(reward.amount)
        );
      });

      details.push({
        label: "Protocol Deposits",
        value: Array.from(totals.entries())
          .map(([currency, amount]) => `${amount.toFixed(4)} ${currency}`)
          .join(", "),
      });
    }

    return details;
  }, [activeClaim]);

  const stageList = React.useMemo(() => {
    if (!activeClaim) return null;

    const inflationRewards = activeClaim.weekData.rewards.filter(
      (reward) => reward.type === "glowInflation"
    );
    const inflationAmount =
      inflationRewards.length > 0
        ? `${inflationRewards
            .reduce((sum, reward) => sum + Number.parseFloat(reward.amount), 0)
            .toFixed(4)} GLW`
        : null;

    const protocolRewards = activeClaim.weekData.rewards.filter(
      (reward) => reward.type === "protocolDeposit"
    );
    const protocolTotals = new Map<string, number>();
    protocolRewards.forEach((reward) => {
      const current = protocolTotals.get(reward.currency) ?? 0;
      protocolTotals.set(
        reward.currency,
        current + Number.parseFloat(reward.amount)
      );
    });
    const protocolAmount =
      protocolTotals.size > 0
        ? Array.from(protocolTotals.entries())
            .map(([currency, amount]) => `${amount.toFixed(4)} ${currency}`)
            .join(", ")
        : null;

    return (
      <div className="space-y-3">
        {CLAIM_STAGE_ORDER.map((stage) => {
          const status = claimStageStatuses[stage];
          if (!status) return null;

          const meta = CLAIM_STAGE_META[stage];
          const amountLabel =
            stage === "inflation" ? inflationAmount : protocolAmount;

          return (
            <div
              key={stage}
              className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted shadow-sm">
                  {meta.icon}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold">{meta.label}</div>
                  {amountLabel && (
                    <div className="text-xs text-muted-foreground font-medium">
                      {amountLabel}
                    </div>
                  )}
                  {status.message && (
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      {status.message}
                    </div>
                  )}
                  {status.txHash && (
                    <div className="mt-1.5 text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded inline-block">
                      Tx:{" "}
                      {`${status.txHash.slice(0, 6)}...${status.txHash.slice(
                        -4
                      )}`}
                    </div>
                  )}
                </div>
              </div>
              <span
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap",
                  CLAIM_STATUS_STYLES[status.status]
                )}
              >
                {CLAIM_STATUS_LABELS[status.status]}
              </span>
            </div>
          );
        })}
      </div>
    );
  }, [activeClaim, claimStageStatuses]);

  const reviewContent =
    activeClaim && transactionDetails.length > 0 ? (
      <div className="space-y-6 text-left">
        <div className="space-y-3 rounded-xl bg-muted/30 p-4 border border-border/50">
          {transactionDetails.map((detail, index) => (
            <div
              key={`${detail.label}-${index}`}
              className="flex items-center justify-between py-2"
            >
              <span className="text-sm font-medium text-muted-foreground">
                {detail.label}
              </span>
              <div className="text-right text-sm font-mono font-semibold text-foreground">
                {detail.value}
                {detail.unit ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {detail.unit}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {stageList}
      </div>
    ) : stageList ? (
      <div className="space-y-4 text-left">{stageList}</div>
    ) : undefined;

  const successContent = stageList ? (
    <div className="space-y-4 text-left">
      {stageList}
      {claimDialogInfo && (
        <div className="text-sm text-muted-foreground">{claimDialogInfo}</div>
      )}
    </div>
  ) : undefined;

  const errorDescription =
    claimDialogError ||
    "We were unable to complete your claim. Please try again.";

  const errorContent = stageList ? (
    <div className="space-y-4 text-left">{stageList}</div>
  ) : undefined;

  // Calculate total number of claimable weeks
  const totalClaimableWeeks = mockWeeklyBreakdown.filter(
    (w) => w.isFinalized && !claimedWeeks.has(w.week)
  ).length;

  // Handle claim all
  const handleClaimAll = async () => {
    setIsClaimingAll(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      mockWeeklyBreakdown
        .filter((w) => w.isFinalized && !claimedWeeks.has(w.week))
        .forEach((w) => {
          setClaimedWeeks((prev) => {
            const next = new Set(prev);
            next.add(w.week);
            return next;
          });
        });

      toast.success(
        `Successfully claimed rewards from ${totalClaimableWeeks} weeks (MOCK)`
      );
    } catch (error) {
      toast.error("Failed to claim rewards");
    } finally {
      setIsClaimingAll(false);
    }
  };

  return (
    <>
      <Card className="mb-8">
        <CardHeader className="pb-4 md:pb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
                <Gift className="w-5 h-5 md:w-6 md:h-6" />
                Farm Rewards Available (MOCK DATA)
              </CardTitle>
              <CardDescription className="mt-2 md:mt-3 text-sm md:text-base">
                Claim your earned rewards from solar farm delegations - This is
                using mock data for testing
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleClaimAll}
                disabled={isClaimingAll || totalClaimableWeeks === 0}
                size="lg"
                className="gap-2 w-full md:w-auto"
              >
                {isClaimingAll ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  <>
                    Claim All
                    <Badge variant="secondary" className="ml-1">
                      {totalClaimableWeeks} weeks
                    </Badge>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Aggregated Totals Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Total Claimable
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(aggregatedTotals).map(([currency, amount]) => {
                  const config = CURRENCY_CONFIG[currency as CurrencyKey] || {
                    icon: <Coins className="w-4 h-4" />,
                    color: "text-gray-600",
                    bgColor: "bg-gray-50 dark:bg-gray-950/20",
                    label: currency,
                  };

                  return (
                    <div
                      key={currency}
                      className={cn(
                        "flex items-center justify-between p-4 md:p-5 rounded-xl border shadow-sm transition-shadow hover:shadow-md",
                        config.bgColor
                      )}
                    >
                      <div className="flex items-center gap-2.5 md:gap-3">
                        <div
                          className={cn(
                            "p-2 md:p-2.5 rounded-full bg-background shadow-sm flex-shrink-0",
                            config.color
                          )}
                        >
                          {config.icon}
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-semibold text-xs md:text-sm">
                            {config.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {totalClaimableWeeks} weeks
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-base md:text-xl tabular-nums">
                          {parseFloat(amount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6,
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weekly Breakdown Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Weekly Breakdown
              </h3>
              <div className="space-y-3">
                {mockWeeklyBreakdown.map((weekData) => {
                  const isClaimingThisWeek = isClaimingWeek === weekData.week;
                  const isClaimed = claimedWeeks.has(weekData.week);

                  return (
                    <Collapsible
                      key={weekData.week}
                      className={cn(
                        "border rounded-xl transition-all shadow-sm hover:shadow-md",
                        isClaimed && "opacity-60 bg-muted/20"
                      )}
                    >
                      <div className="flex flex-col md:flex-row md:items-center w-full p-4 md:p-5 hover:bg-muted/50 transition-colors gap-3 md:gap-0">
                        <CollapsibleTrigger className="flex flex-1 flex-col sm:flex-row sm:items-center sm:justify-between text-left gap-3 sm:gap-4">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="text-left space-y-1">
                              <div className="font-semibold text-sm md:text-base">
                                Week {weekData.week}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatWeekDate(weekData.week)}
                              </div>
                            </div>
                            <Badge
                              variant={
                                isClaimed
                                  ? "secondary"
                                  : weekData.isFinalized
                                  ? "default"
                                  : "outline"
                              }
                              className="text-xs flex-shrink-0"
                            >
                              {isClaimed ? (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Claimed
                                </>
                              ) : weekData.isFinalized ? (
                                <>
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  Ready to Claim
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pending
                                </>
                              )}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {weekData.totalGlw !== "0" && (
                              <Badge variant="secondary" className="text-xs">
                                {parseFloat(weekData.totalGlw).toFixed(2)} GLW
                              </Badge>
                            )}
                            {Array.from(
                              weekData.totalProtocolDeposit.entries()
                            ).map(([currency, amount]) => (
                              <Badge
                                key={currency}
                                variant="secondary"
                                className="text-xs"
                              >
                                {parseFloat(amount).toFixed(2)} {currency}
                              </Badge>
                            ))}
                            <ChevronRight className="w-4 h-4 text-muted-foreground ml-1 sm:ml-3 hidden sm:inline-block" />
                          </div>
                        </CollapsibleTrigger>
                        <div className="w-full md:ml-4 md:w-44">
                          <Button
                            size="default"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (weekData.isFinalized && !isClaimed) {
                                handleInitiateClaim({
                                  weekData,
                                  claimType: "both",
                                  rewardsToClaim: weekData.rewards,
                                });
                              }
                            }}
                            disabled={
                              !weekData.isFinalized ||
                              isClaimed ||
                              isClaimingThisWeek ||
                              isClaimingAll
                            }
                            variant={isClaimed ? "secondary" : "default"}
                          >
                            {isClaimingThisWeek ? (
                              <>
                                <Clock className="w-4 h-4 mr-2 animate-spin" />
                                Claiming...
                              </>
                            ) : isClaimed ? (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Claimed
                              </>
                            ) : !weekData.isFinalized ? (
                              <>
                                <Clock className="w-4 h-4 mr-2" />
                                Pending
                              </>
                            ) : (
                              <>
                                Claim Week
                                <ChevronRight className="w-4 h-4 ml-2" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <CollapsibleContent className="px-4 md:px-5 pb-4 md:pb-5 pt-2">
                        <div className="space-y-2 border-t border-border/50 pt-3 md:pt-4">
                          {weekData.rewards.map((reward, idx) => {
                            const config = CURRENCY_CONFIG[
                              reward.currency as CurrencyKey
                            ] || {
                              icon: <Coins className="w-4 h-4" />,
                              color: "text-gray-600",
                              bgColor: "bg-gray-50 dark:bg-gray-950/20",
                              label: reward.currency,
                            };

                            return (
                              <div
                                key={`${reward.currency}-${reward.type}-${idx}`}
                                className="flex items-center justify-between p-3 md:p-4 rounded-lg bg-muted/50 border border-border/30 gap-2"
                              >
                                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                  <div
                                    className={cn(
                                      "p-1.5 md:p-2 rounded-full bg-background flex-shrink-0",
                                      config.color
                                    )}
                                  >
                                    {config.icon}
                                  </div>
                                  <div className="space-y-0.5 min-w-0">
                                    <div className="text-xs md:text-sm font-semibold truncate">
                                      {config.label}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {reward.type === "glowInflation"
                                        ? "Inflation Rewards"
                                        : "Protocol Deposit"}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm md:text-base font-bold tabular-nums flex-shrink-0">
                                  {parseFloat(reward.amount).toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 6,
                                    }
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>

            {/* Info Section */}
            <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
                  <div className="font-semibold">About Claims (TEST MODE)</div>
                  <div className="text-blue-800 dark:text-blue-200">
                    This is a test environment with mock data. All claims are
                    simulated and won't execute real transactions.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <TransactionDialog
        open={isClaimDialogOpen && Boolean(activeClaim)}
        onOpenChange={handleDialogOpenChange}
        isSubmitting={claimDialogStatus === "processing"}
        isSuccess={claimDialogStatus === "success"}
        isError={claimDialogStatus === "error"}
        title="Review Claim"
        successTitle="Claim Complete (MOCK)"
        errorTitle="Claim Failed"
        processingTitle="Processing Claim"
        description="Review your rewards before confirming the claim. (MOCK MODE)"
        processingDescription="Please wait while we process your mock claim."
        errorDescription={errorDescription}
        transactionDetails={transactionDetails}
        reviewContent={reviewContent}
        successContent={successContent}
        errorContent={errorContent}
        showProcessingProgress
        onConfirm={activeClaim ? handleConfirmClaim : undefined}
        confirmDisabled={!activeClaim || claimDialogStatus === "processing"}
        confirmLabel="Confirm Claim (MOCK)"
        cancelLabel="Cancel"
      />
    </>
  );
}

"use client";

import React from "react";
import { useAccount } from "wagmi";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  useClaimableRewards,
  type ClaimableReward,
  type WeeklyClaimableRewards,
} from "@/hooks/useClaimableRewards";
import {
  useRewardsKernelWrapper,
  type ClaimProgressUpdate,
  type ClaimStage,
  type ClaimStageStatus,
} from "@/hooks/useRewardsKernelWrapper";
import {
  getHotWalletAddress,
  useMerkleProofs,
  weekToNonce,
  type ReadableLeafReward,
} from "@/hooks/useMerkleProofs";
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
  userProof: ReadableLeafReward;
  nonce: bigint;
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

export function ClaimsPanel() {
  const { address, isConnected } = useAccount();
  const currentEpoch = getCurrentEpoch();
  const [claimedWeeks, setClaimedWeeks] = React.useState<Set<number>>(
    new Set()
  );
  const [v1ClaimedWeeks, setV1ClaimedWeeks] = React.useState<Set<number>>(
    new Set()
  );
  const [v2ClaimedWeeks, setV2ClaimedWeeks] = React.useState<Set<number>>(
    new Set()
  );

  // Fetch claimable rewards
  const { aggregatedTotals, weeklyBreakdown, isLoading, isError, refetch } =
    useClaimableRewards(address);

  // Rewards claiming functionality
  const {
    claimWeekRewards,
    claimAllRewards,
    isClaimingWeek,
    isClaimingAll,
    checkIfClaimed,
    checkIfGlwClaimed,
  } = useRewardsKernelWrapper();

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
  const claimStageStatusesRef = React.useRef<ClaimStageMap>(claimStageStatuses);

  React.useEffect(() => {
    claimStageStatusesRef.current = claimStageStatuses;
  }, [claimStageStatuses]);

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
    const initial: ClaimStageMap = {
      inflation: { status: "pending" },
      protocolDeposits: { status: "pending" },
    };
    claimStageStatusesRef.current = initial;
    setClaimStageStatuses(initial);
  }, []);

  const updateStageStatus = React.useCallback((update: ClaimProgressUpdate) => {
    setClaimStageStatuses((prev) => {
      const previousStage = prev[update.stage];
      const fallbackMessage: Partial<Record<ClaimStageStatus, string>> = {
        inProgress: "Submitting transaction...",
        success: "Transaction submitted",
        error: "Unable to complete",
      };

      const nextStage: ClaimStageState = {
        status: update.status,
        txHash:
          update.txHash !== undefined ? update.txHash : previousStage.txHash,
        message:
          update.message ??
          (update.status === "skipped"
            ? previousStage.message
            : fallbackMessage[update.status] ?? previousStage.message),
      };

      const next = {
        ...prev,
        [update.stage]: nextStage,
      } as ClaimStageMap;

      claimStageStatusesRef.current = next;
      return next;
    });
  }, []);

  const handleInitiateClaim = React.useCallback(
    (payload: ClaimInitiationPayload) => {
      const initialStatuses = createInitialStageState(payload);
      claimStageStatusesRef.current = initialStatuses;
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

  const handleConfirmClaim = React.useCallback(async () => {
    if (!activeClaim) return;

    setClaimDialogStatus("processing");
    setClaimDialogError(null);
    setClaimDialogInfo(null);

    const hotWalletAddress = getHotWalletAddress();
    const v1Proof = activeClaim.userProof.v1MerkleProof.map(
      (p) => p as `0x${string}`
    );
    const v2Proof = activeClaim.userProof.v2MerkleProof.map(
      (p) => p as `0x${string}`
    );
    const glwWeight =
      activeClaim.claimType === "v2Only"
        ? undefined
        : activeClaim.userProof.glowInflationEarnedLeafWeight;

    try {
      await claimWeekRewards(
        activeClaim.weekData.week,
        activeClaim.rewardsToClaim,
        activeClaim.nonce,
        v1Proof,
        v2Proof,
        hotWalletAddress,
        glwWeight,
        {
          onProgress: updateStageStatus,
        }
      );

      const latestStatuses = claimStageStatusesRef.current;
      const inflationStatus = latestStatuses.inflation.status;
      const protocolStatus = latestStatuses.protocolDeposits.status;
      const hasError =
        inflationStatus === "error" || protocolStatus === "error";
      const hasSuccess =
        inflationStatus === "success" || protocolStatus === "success";
      const allSkipped =
        inflationStatus === "skipped" && protocolStatus === "skipped";
      const weekNumber = activeClaim.weekData.week;

      if (!hasError) {
        setClaimDialogStatus("success");
        if (allSkipped) {
          setClaimDialogInfo("Rewards already claimed or unavailable.");
        }

        if (inflationStatus === "success" || inflationStatus === "skipped") {
          setV1ClaimedWeeks((prev) => {
            const next = new Set(prev);
            next.add(weekNumber);
            return next;
          });
        }

        if (protocolStatus === "success" || protocolStatus === "skipped") {
          setV2ClaimedWeeks((prev) => {
            const next = new Set(prev);
            next.add(weekNumber);
            return next;
          });
        }

        if (
          (inflationStatus === "success" || inflationStatus === "skipped") &&
          (protocolStatus === "success" || protocolStatus === "skipped")
        ) {
          setClaimedWeeks((prev) => {
            const next = new Set(prev);
            next.add(weekNumber);
            return next;
          });
        }
      } else {
        setClaimDialogStatus("error");
        setClaimDialogError(
          hasSuccess
            ? "Some rewards failed to claim. You can retry the remaining items."
            : "We were unable to complete your claim. Please try again."
        );
      }
    } catch (error: any) {
      console.error("Claim confirmation error:", error);
      setClaimDialogStatus("error");
      setClaimDialogError(
        error?.message ||
          "We were unable to complete your claim. Please try again."
      );
    } finally {
      refetch();
    }
  }, [activeClaim, claimWeekRewards, updateStageStatus, refetch]);

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
              className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  {meta.icon}
                </div>
                <div>
                  <div className="text-sm font-medium">{meta.label}</div>
                  {amountLabel && (
                    <div className="text-xs text-muted-foreground">
                      {amountLabel}
                    </div>
                  )}
                  {status.message && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {status.message}
                    </div>
                  )}
                  {status.txHash && (
                    <div className="mt-1 text-xs font-mono text-muted-foreground">
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
                  "px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap",
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
        <div className="space-y-4">
          {transactionDetails.map((detail, index) => (
            <div
              key={`${detail.label}-${index}`}
              className="flex items-center justify-between"
            >
              <span className="text-sm text-muted-foreground">
                {detail.label}
              </span>
              <div className="text-right text-sm font-mono text-foreground">
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

  // Don't show panel if not connected
  if (!isConnected || !address) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            Error Loading Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Failed to load your claimable rewards. Please try again.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Check if there are any claimable rewards (finalized totals)
  const hasClaimableRewards = Object.keys(aggregatedTotals).length > 0;

  // Calculate total number of claimable (finalized and not already optimistically claimed) weeks
  const totalClaimableWeeks = weeklyBreakdown.filter(
    (w) => w.isFinalized && !claimedWeeks.has(w.week)
  ).length;

  // Handle claim all
  const handleClaimAll = async () => {
    if (!address || weeklyBreakdown.length === 0) return;

    const hotWalletAddress = getHotWalletAddress();

    // Fetch all merkle proofs for unclaimed weeks
    const weeklyDataPromises = weeklyBreakdown
      .filter((week) => week.isFinalized && !claimedWeeks.has(week.week))
      .map(async (weekData) => {
        try {
          const response = await fetch(
            `https://pub-311748c72106476cbeabe0a22a59217d.r2.dev/weekly-report-week-${weekData.week}.json`
          );

          if (!response.ok) return null;

          const data = await response.json();
          const userProof = data.readableLeaves?.find(
            (leaf: any) => leaf.user.toLowerCase() === address.toLowerCase()
          );

          if (!userProof) return null;

          return {
            week: weekData.week,
            rewards: weekData.rewards,
            nonce: weekToNonce(weekData.week),
            v1Proof: userProof.v1MerkleProof.map(
              (p: string) => p as `0x${string}`
            ),
            v2Proof: userProof.v2MerkleProof.map(
              (p: string) => p as `0x${string}`
            ),
            fromAddress: hotWalletAddress,
            glwWeight: userProof.glowInflationEarnedLeafWeight,
          };
        } catch (error) {
          console.error(
            `Failed to fetch proof for week ${weekData.week}:`,
            error
          );
          return null;
        }
      });

    const weeklyClaimData = (await Promise.all(weeklyDataPromises)).filter(
      (data): data is NonNullable<typeof data> => data !== null
    );

    if (weeklyClaimData.length === 0) {
      toast.error("No claimable rewards found");
      return;
    }

    try {
      const successfulTxHashes = await claimAllRewards(weeklyClaimData);

      if (successfulTxHashes.length > 0) {
        toast.success(
          `Successfully claimed rewards from ${successfulTxHashes.length} weeks`
        );
        // Trigger refetch to update UI
        refetch();
      }
    } catch (error) {
      console.error("Claim all error:", error);
      toast.error("Failed to claim rewards");
    }
  };

  // Component for week claim button with merkle proof loading
  const WeekClaimButton = ({
    weekData,
    isClaimingThisWeek,
    isClaimed,
    onInitiateClaim,
    size = "sm",
    className,
    claimType = "both",
  }: {
    weekData: WeeklyClaimableRewards;
    isClaimingThisWeek: boolean;
    isClaimed: boolean;
    onInitiateClaim: (payload: ClaimInitiationPayload) => void;
    size?: "sm" | "default";
    className?: string;
    claimType?: "both" | "v2Only";
  }) => {
    const {
      userProof,
      nonce,
      isLoading: isProofLoading,
    } = useMerkleProofs(weekData.week, address);

    const handleOpenDialog = () => {
      if (!userProof) {
        toast.error("No rewards found for your address in this week");
        return;
      }

      let rewardsToClaim: ClaimableReward[] = weekData.rewards;
      if (claimType === "v2Only") {
        rewardsToClaim = weekData.rewards.filter(
          (reward) => reward.type === "protocolDeposit"
        );
      }

      if (rewardsToClaim.length === 0) {
        toast.info("No rewards available to claim for this selection");
        return;
      }

      onInitiateClaim({
        weekData,
        claimType,
        rewardsToClaim,
        userProof,
        nonce,
      });
    };

    // Pending countdown (until finalized)
    const weekSeconds = 7 * 86400;
    const currentEpoch = getCurrentEpoch();
    const hasProtocolDeposits = weekData.rewards.some(
      (r: any) => r.type === "protocolDeposit"
    );

    // If week has protocol deposits, wait for PD finalization (4 weeks), otherwise GLW (3 weeks)
    const weeksToWait = hasProtocolDeposits ? 4 : 3;
    const targetTimestampMs = React.useMemo(
      () =>
        (GENESIS_TIMESTAMP + (weekData.week + weeksToWait) * weekSeconds) *
        1000,
      [weekData.week, weeksToWait]
    );
    const [nowMs, setNowMs] = React.useState<number>(() => Date.now());

    const remainingMs = React.useMemo(
      () => Math.max(0, targetTimestampMs - nowMs),
      [targetTimestampMs, nowMs]
    );

    const showCountdown = remainingMs < 24 * 3600 * 1000; // show countdown only if < 24h

    React.useEffect(() => {
      if (weekData.isFinalized || !showCountdown) return; // only run timer if showing countdown
      const id = setInterval(() => setNowMs(Date.now()), 1000);
      return () => clearInterval(id);
    }, [weekData.isFinalized, showCountdown]);

    const countdownLabel = React.useMemo(() => {
      if (!showCountdown) {
        const days = Math.ceil(remainingMs / (24 * 3600 * 1000));
        return days === 1 ? "1 day" : `${days} days`;
      }
      const totalSeconds = Math.floor(remainingMs / 1000);
      const totalHours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = Math.floor(totalSeconds % 60);
      return `${totalHours}h ${minutes}m ${seconds}s`;
    }, [remainingMs, showCountdown]);

    return (
      <Button
        size={size}
        className={cn("w-full mt-3", className)}
        onClick={handleOpenDialog}
        disabled={
          isClaimingThisWeek ||
          isClaimingAll ||
          isClaimed ||
          isProofLoading ||
          !userProof ||
          claimDialogStatus === "processing" ||
          remainingMs > 0
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
        ) : isProofLoading ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Loading proof...
          </>
        ) : !userProof ? (
          <>No rewards</>
        ) : remainingMs > 0 ? (
          <>
            <Clock className="w-4 h-4 mr-2" />
            Claim in {countdownLabel}
          </>
        ) : claimType === "v2Only" ? (
          <>
            Claim PD
            <ChevronRight className="w-4 h-4 ml-2" />
          </>
        ) : (
          <>
            Claim Inflation
            <ChevronRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
    );
  };

  // Component to show appropriate claim buttons based on status
  const ClaimButtonsWrapper = ({
    weekData,
  }: {
    weekData: WeeklyClaimableRewards;
  }) => {
    const [glwClaimed, setGlwClaimed] = React.useState(false);
    const [v2Claimed, setV2Claimed] = React.useState(false);
    const [isChecking, setIsChecking] = React.useState(true);
    const isClaimingThisWeek = isClaimingWeek === weekData.week;
    const isClaimed = claimedWeeks.has(weekData.week);

    // Check individual finalization status
    const currentEpoch = getCurrentEpoch();
    const isGlwFinalized = weekData.week <= currentEpoch - 3;
    const isPdFinalized = weekData.week <= currentEpoch - 4;

    React.useEffect(() => {
      if (!address) {
        setIsChecking(false);
        return;
      }

      // Only check if at least one type is finalized
      if (!isGlwFinalized && !isPdFinalized) {
        setIsChecking(false);
        return;
      }

      const checkClaimStatus = async () => {
        try {
          // Check if GLW is claimed
          const glwStatus = await checkIfGlwClaimed(weekData.week + 1, address);
          setGlwClaimed(glwStatus);

          // Check if v2 (protocol deposits) is claimed
          const nonce = weekToNonce(weekData.week);
          const v2Status = await checkIfClaimed(address, nonce);
          setV2Claimed(v2Status);
        } catch (error) {
          console.error("Error checking claim status:", error);
        } finally {
          setIsChecking(false);
        }
      };

      checkClaimStatus();
    }, [weekData.week, isGlwFinalized, isPdFinalized, address]);

    // Don't show buttons if checking status
    if (isChecking && (isGlwFinalized || isPdFinalized)) {
      return (
        <div className="ml-3 w-40">
          <Button size="default" className="w-full mt-0" disabled>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Checking...
          </Button>
        </div>
      );
    }

    const hasGlwRewards = weekData.rewards.some(
      (r: any) => r.type === "glowInflation"
    );
    const hasProtocolDeposits = weekData.rewards.some(
      (r: any) => r.type === "protocolDeposit"
    );

    // If both are claimed, show claimed status
    if (glwClaimed && v2Claimed) {
      return (
        <div className="ml-3 w-40">
          <Button
            size="default"
            className="w-full mt-0"
            variant="secondary"
            disabled
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Claimed
          </Button>
        </div>
      );
    }

    // If only GLW is claimed but v2 is available, show v2 claim button
    if (glwClaimed && !v2Claimed && hasProtocolDeposits) {
      return (
        <div className="ml-3 w-40">
          <WeekClaimButton
            weekData={weekData}
            isClaimingThisWeek={isClaimingThisWeek}
            isClaimed={false}
            onInitiateClaim={handleInitiateClaim}
            size="default"
            className="mt-0"
            claimType="v2Only"
          />
        </div>
      );
    }

    // If nothing is finalized yet, show pending
    if (!isGlwFinalized && !isPdFinalized) {
      return (
        <div className="ml-3 w-40">
          <Button size="default" className="w-full mt-0" disabled>
            <Clock className="w-4 h-4 mr-2" />
            Pending
          </Button>
        </div>
      );
    }

    // If only GLW is finalized but not PD, still show the week claim button
    // The button itself will handle showing the countdown for PD

    // Otherwise show normal claim button
    return (
      <div className="ml-3 w-40">
        <WeekClaimButton
          weekData={weekData}
          isClaimingThisWeek={isClaimingThisWeek}
          isClaimed={isClaimed}
          onInitiateClaim={handleInitiateClaim}
          size="default"
          className="mt-0"
          claimType="both"
        />
      </div>
    );
  };

  return (
    <>
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Farm Rewards Available
              </CardTitle>
              <CardDescription className="mt-2">
                Claim your earned rewards from solar farm delegations
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleClaimAll}
                disabled={
                  isClaimingAll ||
                  totalClaimableWeeks === 0 ||
                  claimDialogStatus === "processing"
                }
                className="gap-2"
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
            {hasClaimableRewards && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Total Claimable
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(aggregatedTotals).map(
                    ([currency, amount]) => {
                      const config = CURRENCY_CONFIG[
                        currency as CurrencyKey
                      ] || {
                        icon: <Coins className="w-4 h-4" />,
                        color: "text-gray-600",
                        bgColor: "bg-gray-50 dark:bg-gray-950/20",
                        label: currency,
                      };

                      return (
                        <div
                          key={currency}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-lg border",
                            config.bgColor
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "p-2 rounded-full bg-background",
                                config.color
                              )}
                            >
                              {config.icon}
                            </div>
                            <div>
                              <div className="font-medium">{config.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {totalClaimableWeeks} weeks
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">
                              {parseFloat(amount).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 6,
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {/* Weekly Breakdown Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Weekly Breakdown
              </h3>
              <div className="space-y-2">
                {weeklyBreakdown.map((weekData) => {
                  const isClaimingThisWeek = isClaimingWeek === weekData.week;
                  const isClaimed = claimedWeeks.has(weekData.week);

                  return (
                    <Collapsible
                      key={weekData.week}
                      className={cn(
                        "border rounded-lg transition-all",
                        isClaimed && "opacity-60 bg-muted/20"
                      )}
                    >
                      <div className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                        <CollapsibleTrigger className="flex flex-1 items-center justify-between text-left">
                          <div className="flex items-center gap-3">
                            <div className="text-left">
                              <div className="font-medium">
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
                              className="text-xs"
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
                          <div className="flex items-center gap-2">
                            {weekData.totalGlw !== "0" && (
                              <Badge variant="secondary">
                                {parseFloat(weekData.totalGlw).toFixed(2)} GLW
                              </Badge>
                            )}
                            {Array.from(
                              weekData.totalProtocolDeposit.entries()
                            ).map(([currency, amount]) => (
                              <Badge key={currency} variant="secondary">
                                {parseFloat(amount).toFixed(2)} {currency}
                              </Badge>
                            ))}

                            <ChevronRight className="w-4 h-4 text-muted-foreground ml-2" />
                          </div>
                        </CollapsibleTrigger>
                        <ClaimButtonsWrapper weekData={weekData} />
                      </div>
                      <CollapsibleContent className="px-4 pb-4">
                        <div className="space-y-3 mt-3">
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
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={cn(
                                      "p-1.5 rounded-full",
                                      config.color
                                    )}
                                  >
                                    {config.icon}
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium">
                                      {config.label}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {reward.type === "glowInflation"
                                        ? "Inflation Rewards"
                                        : "Protocol Deposit"}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm font-medium">
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
            <div className="mt-4 p-3 rounded-lg bg-muted/50">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <div className="font-medium mb-1">About Claims</div>
                  <div>
                    Rewards become claimable after a 3-week finality period.
                    Week 96 and earlier are available to claim on the{" "}
                    <a
                      href="https://hub.glow.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 underline"
                    >
                      Hub Dashboard
                    </a>{" "}
                    for V1 Solar Farms.
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
        successTitle="Claim Complete"
        errorTitle="Claim Failed"
        processingTitle="Processing Claim"
        description="Review your rewards before confirming the claim."
        processingDescription="Please wait while we process your claim."
        errorDescription={errorDescription}
        transactionDetails={transactionDetails}
        reviewContent={reviewContent}
        successContent={successContent}
        errorContent={errorContent}
        showProcessingProgress
        onConfirm={activeClaim ? handleConfirmClaim : undefined}
        confirmDisabled={!activeClaim || claimDialogStatus === "processing"}
        confirmLabel="Confirm Claim"
        cancelLabel="Cancel"
      />
    </>
  );
}

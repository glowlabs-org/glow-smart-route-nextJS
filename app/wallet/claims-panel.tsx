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
import { SmartAccountWarningDialog } from "@/components/wallet/smart-account-warning-dialog";

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
  const weekTimestamp = GENESIS_TIMESTAMP + (week + 1) * 7 * 86400;
  const date = new Date(weekTimestamp * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type ClaimDialogStatus = "review" | "processing" | "success" | "error";

interface ClaimStatusSummary {
  glwClaimed: boolean;
  protocolClaimed: boolean;
}

type WeekClaimButtonProps = {
  address?: string;
  claimDialogStatus: ClaimDialogStatus;
  claimType?: "both" | "v2Only";
  className?: string;
  isClaimed: boolean;
  isClaimingAll: boolean;
  isClaimingThisWeek: boolean;
  isConnected: boolean;
  onInitiateClaim: (payload: ClaimInitiationPayload) => void;
  size?: "sm" | "default";
  weekData: WeeklyClaimableRewards;
};

function WeekClaimButton({
  address,
  claimDialogStatus,
  claimType = "both",
  className,
  isClaimed,
  isClaimingAll,
  isClaimingThisWeek,
  isConnected,
  onInitiateClaim,
  size = "sm",
  weekData,
}: WeekClaimButtonProps) {
  const {
    userProof,
    nonce,
    isLoading: isProofLoading,
  } = useMerkleProofs(weekData.week, address);

  const handleOpenDialog = React.useCallback(() => {
    if (!isConnected) {
      toast.info("Connect your wallet to claim rewards.");
      return;
    }

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
  }, [claimType, isConnected, nonce, onInitiateClaim, userProof, weekData]);

  const weekSeconds = React.useMemo(() => 7 * 86400, []);
  const hasProtocolDeposits = React.useMemo(
    () => weekData.rewards.some((reward) => reward.type === "protocolDeposit"),
    [weekData.rewards]
  );

  const weeksToWait = hasProtocolDeposits ? 4 : 3;
  const targetTimestampMs = React.useMemo(
    () =>
      (GENESIS_TIMESTAMP + (weekData.week + weeksToWait) * weekSeconds) * 1000,
    [weekData.week, weekSeconds, weeksToWait]
  );

  const [nowMs, setNowMs] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    if (weekData.isFinalized) return;

    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [weekData.isFinalized]);

  const remainingMs = React.useMemo(
    () => Math.max(0, targetTimestampMs - nowMs),
    [nowMs, targetTimestampMs]
  );

  const showCountdown = remainingMs < 24 * 3600 * 1000;

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

  const isDisabled =
    isClaimingThisWeek ||
    isClaimingAll ||
    isClaimed ||
    isProofLoading ||
    !userProof ||
    claimDialogStatus === "processing" ||
    remainingMs > 0 ||
    !isConnected;

  const buttonLabel = React.useMemo(() => {
    if (!isConnected) {
      return "Connect Wallet";
    }

    if (isClaimingThisWeek) {
      return (
        <>
          <Clock className="w-4 h-4 mr-2 animate-spin" />
          Claiming...
        </>
      );
    }

    if (isClaimed) {
      return (
        <>
          <CheckCircle className="w-4 h-4 mr-2" />
          Claimed
        </>
      );
    }

    if (isProofLoading) {
      return (
        <>
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Loading proof...
        </>
      );
    }

    if (!userProof) {
      return <>No rewards</>;
    }

    if (remainingMs > 0) {
      return (
        <>
          <Clock className="w-4 h-4 mr-2" />
          Claim in {countdownLabel}
        </>
      );
    }

    if (claimType === "v2Only") {
      return (
        <>
          Claim PD
          <ChevronRight className="w-4 h-4 ml-2" />
        </>
      );
    }

    return (
      <>
        Claim Inflation
        <ChevronRight className="w-4 h-4 ml-2" />
      </>
    );
  }, [
    claimType,
    countdownLabel,
    isClaimed,
    isClaimingThisWeek,
    isConnected,
    isProofLoading,
    remainingMs,
    userProof,
  ]);

  return (
    <Button
      size={size}
      className={cn("w-full", className)}
      onClick={handleOpenDialog}
      disabled={isDisabled}
      variant={isClaimed ? "secondary" : "default"}
    >
      {buttonLabel}
    </Button>
  );
}

type ClaimButtonsWrapperProps = {
  address?: string;
  checkIfClaimed: (
    userAddress: `0x${string}`,
    nonce: bigint
  ) => Promise<boolean>;
  checkIfGlwClaimed: (
    week: number,
    userAddress: `0x${string}`
  ) => Promise<boolean>;
  claimDialogStatus: ClaimDialogStatus;
  glwClaimed: boolean;
  isClaimingAll: boolean;
  isClaimingWeek: number | null;
  isConnected: boolean;
  onClaimStatusChange: (week: number, status: ClaimStatusSummary) => void;
  onInitiateClaim: (payload: ClaimInitiationPayload) => void;
  protocolClaimed: boolean;
  weekData: WeeklyClaimableRewards;
};

function ClaimButtonsWrapper({
  address,
  checkIfClaimed,
  checkIfGlwClaimed,
  claimDialogStatus,
  glwClaimed,
  isClaimingAll,
  isClaimingWeek,
  isConnected,
  onClaimStatusChange,
  onInitiateClaim,
  protocolClaimed,
  weekData,
}: ClaimButtonsWrapperProps) {
  const [isChecking, setIsChecking] = React.useState(true);
  const isClaimingThisWeek = isClaimingWeek === weekData.week;

  const currentEpoch = getCurrentEpoch();
  const isGlwFinalized = weekData.week <= currentEpoch - 3;
  const isPdFinalized = weekData.week <= currentEpoch - 4;
  const hasGlwRewards = React.useMemo(
    () => weekData.rewards.some((r) => r.type === "glowInflation"),
    [weekData.rewards]
  );
  const hasProtocolDeposits = React.useMemo(
    () => weekData.rewards.some((r) => r.type === "protocolDeposit"),
    [weekData.rewards]
  );

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!address) {
        onClaimStatusChange(weekData.week, {
          glwClaimed: false,
          protocolClaimed: false,
        });
        if (!cancelled) {
          setIsChecking(false);
        }
        return;
      }

      const shouldCheckGlw = hasGlwRewards && isGlwFinalized;
      const shouldCheckProtocol = hasProtocolDeposits && isPdFinalized;

      if (!shouldCheckGlw && !shouldCheckProtocol) {
        onClaimStatusChange(weekData.week, {
          glwClaimed: !hasGlwRewards,
          protocolClaimed: !hasProtocolDeposits,
        });
        if (!cancelled) {
          setIsChecking(false);
        }
        return;
      }

      const needsCheck =
        (shouldCheckGlw && !glwClaimed) ||
        (shouldCheckProtocol && !protocolClaimed);

      if (!needsCheck) {
        if (!cancelled) {
          setIsChecking(false);
        }
        return;
      }

      if (!cancelled) {
        setIsChecking(true);
      }

      try {
        const [glwStatus, protocolStatus] = await Promise.all([
          shouldCheckGlw
            ? checkIfGlwClaimed(weekData.week + 1, address as `0x${string}`)
            : Promise.resolve(!hasGlwRewards),
          shouldCheckProtocol
            ? checkIfClaimed(
                address as `0x${string}`,
                weekToNonce(weekData.week)
              )
            : Promise.resolve(!hasProtocolDeposits),
        ]);

        if (!cancelled) {
          onClaimStatusChange(weekData.week, {
            glwClaimed: glwStatus,
            protocolClaimed: protocolStatus,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error checking claim status:", error);
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    address,
    claimDialogStatus,
    checkIfClaimed,
    checkIfGlwClaimed,
    glwClaimed,
    hasGlwRewards,
    hasProtocolDeposits,
    isGlwFinalized,
    isPdFinalized,
    onClaimStatusChange,
    protocolClaimed,
    weekData.week,
  ]);

  const fullyClaimed = glwClaimed && protocolClaimed;

  if (isChecking && (isGlwFinalized || isPdFinalized)) {
    return (
      <div className="w-full md:ml-4 md:w-44">
        <Button size="default" className="w-full" disabled>
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Checking...
        </Button>
      </div>
    );
  }

  if (fullyClaimed) {
    return (
      <div className="w-full md:ml-4 md:w-44">
        <Button size="default" className="w-full" variant="secondary" disabled>
          <CheckCircle className="w-4 h-4 mr-2" />
          Claimed
        </Button>
      </div>
    );
  }

  if (glwClaimed && !protocolClaimed && hasProtocolDeposits) {
    return (
      <div className="w-full md:ml-4 md:w-44">
        <WeekClaimButton
          address={address}
          claimDialogStatus={claimDialogStatus}
          claimType="v2Only"
          isClaimed={false}
          isClaimingAll={isClaimingAll}
          isClaimingThisWeek={isClaimingThisWeek}
          isConnected={isConnected}
          onInitiateClaim={onInitiateClaim}
          size="default"
          weekData={weekData}
        />
      </div>
    );
  }

  if (!isGlwFinalized && !isPdFinalized) {
    return (
      <div className="w-full md:ml-4 md:w-44">
        <Button size="default" className="w-full" disabled>
          <Clock className="w-4 h-4 mr-2" />
          Pending
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full md:ml-4 md:w-44">
      <WeekClaimButton
        address={address}
        claimDialogStatus={claimDialogStatus}
        isClaimed={fullyClaimed}
        isClaimingAll={isClaimingAll}
        isClaimingThisWeek={isClaimingThisWeek}
        isConnected={isConnected}
        onInitiateClaim={onInitiateClaim}
        size="default"
        weekData={weekData}
      />
    </div>
  );
}
type WeekRewardsContentProps = {
  weekData: WeeklyClaimableRewards;
  glwClaimed: boolean;
  protocolClaimed: boolean;
  isClaimable: boolean;
  isClaimingWeek: number | null;
  isClaimingAll: boolean;
  claimDialogStatus: ClaimDialogStatus;
  address?: string;
  onInitiateClaim: (payload: ClaimInitiationPayload) => void;
  onClaimSuccess?: () => void;
};

function WeekRewardsContent({
  weekData,
  glwClaimed,
  protocolClaimed,
  isClaimable,
  isClaimingWeek,
  isClaimingAll,
  claimDialogStatus,
  address,
  onInitiateClaim,
  onClaimSuccess,
}: WeekRewardsContentProps) {
  const { userProof, nonce } = useMerkleProofs(weekData.week, address);
  const { claimWeekRewards } = useRewardsKernelWrapper();
  const [claimingRewardType, setClaimingRewardType] = React.useState<
    "inflation" | "protocolDeposit" | null
  >(null);

  const handleClaimReward = React.useCallback(
    async (reward: ClaimableReward, isInflation: boolean) => {
      if (!address || !userProof) {
        toast.error("No proof found for this week");
        return;
      }

      const rewardType = isInflation ? "inflation" : "protocolDeposit";
      setClaimingRewardType(rewardType);

      try {
        const hotWalletAddress = getHotWalletAddress();
        const v1Proof = userProof.v1MerkleProof.map((p) => p as `0x${string}`);
        const v2Proof = userProof.v2MerkleProof.map((p) => p as `0x${string}`);
        const glwWeight = isInflation
          ? userProof.glowInflationEarnedLeafWeight
          : undefined;

        const txHash = await claimWeekRewards(
          weekData.week,
          [reward],
          nonce,
          v1Proof,
          v2Proof,
          hotWalletAddress,
          glwWeight
        );

        if (txHash) {
          toast.success(
            `Successfully claimed ${
              isInflation ? "Inflation" : "Protocol Deposit"
            } rewards for week ${weekData.week}`
          );
          if (onClaimSuccess) {
            onClaimSuccess();
          }
        }
      } catch (error: any) {
        console.error("Claim error:", error);
        toast.error(
          `Failed to claim ${
            isInflation ? "Inflation" : "Protocol Deposit"
          } rewards`,
          {
            description: error?.message || "Unknown error",
          }
        );
      } finally {
        setClaimingRewardType(null);
      }
    },
    [address, userProof, nonce, weekData.week, claimWeekRewards, onClaimSuccess]
  );

  return (
    <div className="space-y-3 border-t border-border/50 pt-3 md:pt-4">
      {weekData.rewards.map((reward, idx) => {
        const config = CURRENCY_CONFIG[reward.currency as CurrencyKey] || {
          icon: <Coins className="w-4 h-4" />,
          color: "text-gray-600",
          bgColor: "bg-gray-50 dark:bg-gray-950/20",
          label: reward.currency,
        };

        const isInflation = reward.type === "glowInflation";
        const canClaim = isInflation ? !glwClaimed : !protocolClaimed;
        const rewardLabel = isInflation
          ? "Inflation Rewards"
          : "Protocol Deposit";

        return (
          <div
            key={`${reward.currency}-${reward.type}-${idx}`}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-4 rounded-lg bg-muted/50 border border-border/30 gap-3"
          >
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <div
                className={cn(
                  "p-1.5 md:p-2 rounded-full bg-background flex-shrink-0",
                  config.color
                )}
              >
                {config.icon}
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs md:text-sm font-semibold truncate">
                    {config.label}
                  </div>
                  <div className="text-sm md:text-base font-bold tabular-nums flex-shrink-0 sm:hidden">
                    {parseFloat(reward.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {rewardLabel}
                </div>
              </div>
              <div className="text-sm md:text-base font-bold tabular-nums flex-shrink-0 hidden sm:block">
                {parseFloat(reward.amount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}
              </div>
            </div>
            {isClaimable && canClaim && userProof && (
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClaimReward(reward, isInflation);
                }}
                disabled={
                  isClaimingWeek === weekData.week ||
                  isClaimingAll ||
                  claimDialogStatus === "processing" ||
                  claimingRewardType !== null
                }
              >
                {claimingRewardType ===
                (isInflation ? "inflation" : "protocolDeposit") ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  <>Claim {isInflation ? "Inflation" : "PD"}</>
                )}
              </Button>
            )}
          </div>
        );
      })}

      {/* Explanation about reward types */}
      <div className="mt-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50">
        <p className="text-xs text-blue-900 dark:text-blue-100 space-y-1">
          <span className="block">
            <strong>Inflation Rewards:</strong> GLW tokens earned by solar farms
            and split between Glow Miners and Glow Delegators. These are the
            core mining rewards for operating competitive solar farms on the
            protocol.
          </span>
          <span className="block mt-2">
            <strong>Protocol Deposits:</strong> GLW rewards from Glow's
            competitive redistribution mechanism, where high-performing farms
            earn back deposits plus surplus captured from underperforming
            competitors.
          </span>
        </p>
      </div>
    </div>
  );
}

interface ClaimsPanelProps {
  onClaimSuccess?: () => void;
}

export function ClaimsPanel({ onClaimSuccess }: ClaimsPanelProps = {}) {
  const { address, isConnected } = useAccount();
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
    checkSmartAccount,
  } = useRewardsKernelWrapper();

  // Smart account warning dialog state
  const [showSmartAccountWarning, setShowSmartAccountWarning] =
    React.useState(false);
  const [triggerSmartAccountCheck, setTriggerSmartAccountCheck] =
    React.useState(false);

  const handleSmartAccountDialogChange = React.useCallback((open: boolean) => {
    setShowSmartAccountWarning(open);
    if (!open) {
      setTriggerSmartAccountCheck(false);
    }
  }, []);

  const [activeClaim, setActiveClaim] =
    React.useState<ClaimInitiationPayload | null>(null);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = React.useState(false);
  const [claimDialogStatus, setClaimDialogStatus] =
    React.useState<ClaimDialogStatus>("review");
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

  const handleClaimStatusChange = React.useCallback(
    (week: number, status: ClaimStatusSummary) => {
      setV1ClaimedWeeks((prev) => {
        const hasWeek = prev.has(week);
        if (status.glwClaimed === hasWeek) {
          return prev;
        }
        const next = new Set(prev);
        if (status.glwClaimed) {
          next.add(week);
        } else {
          next.delete(week);
        }
        return next;
      });

      setV2ClaimedWeeks((prev) => {
        const hasWeek = prev.has(week);
        if (status.protocolClaimed === hasWeek) {
          return prev;
        }
        const next = new Set(prev);
        if (status.protocolClaimed) {
          next.add(week);
        } else {
          next.delete(week);
        }
        return next;
      });
    },
    []
  );

  const getWeekClaimState = React.useCallback(
    (weekData: WeeklyClaimableRewards) => {
      const hasGlwRewards = weekData.rewards.some(
        (reward) => reward.type === "glowInflation"
      );
      const hasProtocolRewards = weekData.rewards.some(
        (reward) => reward.type === "protocolDeposit"
      );

      const glwClaimed = !hasGlwRewards || v1ClaimedWeeks.has(weekData.week);
      const protocolClaimed =
        !hasProtocolRewards || v2ClaimedWeeks.has(weekData.week);

      return {
        glwClaimed,
        protocolClaimed,
        isClaimed: glwClaimed && protocolClaimed,
      };
    },
    [v1ClaimedWeeks, v2ClaimedWeeks]
  );

  // Calculate actual claimable totals excluding claimed weeks
  const actualClaimableTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};

    weeklyBreakdown.forEach((weekData) => {
      const { isClaimed } = getWeekClaimState(weekData);

      // Only include finalized and unclaimed weeks
      if (!weekData.isFinalized || isClaimed) return;

      weekData.rewards.forEach((reward) => {
        const amount = parseFloat(reward.amount);
        if (!isNaN(amount)) {
          totals[reward.currency] = (totals[reward.currency] || 0) + amount;
        }
      });
    });

    return totals;
  }, [weeklyBreakdown, getWeekClaimState]);

  // Check if there are any claimable rewards (finalized totals)
  const hasClaimableRewards =
    Object.keys(actualClaimableTotals).length > 0 &&
    Object.values(actualClaimableTotals).some((amount) => amount > 0);

  // Calculate total number of claimable (finalized and not already optimistically claimed) weeks
  const totalClaimableWeeks = weeklyBreakdown.filter((week) => {
    const { isClaimed } = getWeekClaimState(week);
    return week.isFinalized && !isClaimed;
  }).length;

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

    // Check for smart account before proceeding
    const isSmartAccount = await checkSmartAccount();
    if (isSmartAccount) {
      setShowSmartAccountWarning(true);
      setTriggerSmartAccountCheck(true);
      return;
    }

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
      if (!hasError) {
        setClaimDialogStatus("success");
        if (allSkipped) {
          setClaimDialogInfo("Rewards already claimed or unavailable.");
        }
        if (hasSuccess && onClaimSuccess) {
          onClaimSuccess();
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
  }, [
    activeClaim,
    checkSmartAccount,
    claimWeekRewards,
    updateStageStatus,
    refetch,
    onClaimSuccess,
  ]);

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

  const totalClaimableLabel =
    totalClaimableWeeks === 0
      ? "All claimed"
      : totalClaimableWeeks === 1
      ? "1 week"
      : `${totalClaimableWeeks} weeks`;

  const isEverythingClaimed = totalClaimableWeeks === 0;

  // Don't show panel if there are no weeks at all (user never had any farm rewards)
  if (weeklyBreakdown.length === 0) {
    return null;
  }

  // Handle claim all
  const handleClaimAll = async () => {
    if (!address || weeklyBreakdown.length === 0) return;

    // Check for smart account before proceeding
    const isSmartAccount = await checkSmartAccount();
    if (isSmartAccount) {
      setShowSmartAccountWarning(true);
      setTriggerSmartAccountCheck(true);
      return;
    }

    const hotWalletAddress = getHotWalletAddress();

    // Fetch all merkle proofs for unclaimed weeks
    const weeklyDataPromises = weeklyBreakdown
      .filter((week) => {
        const { isClaimed } = getWeekClaimState(week);
        return week.isFinalized && !isClaimed;
      })
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
        if (onClaimSuccess) {
          onClaimSuccess();
        }
      }
    } catch (error) {
      console.error("Claim all error:", error);
      toast.error("Failed to claim rewards");
    }
  };

  return (
    <>
      <Card id="claims-panel" className="mb-8">
        <CardHeader className="pb-4 md:pb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
                <Gift className="w-5 h-5 md:w-6 md:h-6" />
                {isEverythingClaimed
                  ? "Farm Rewards"
                  : "Farm Rewards Available"}
              </CardTitle>
              <CardDescription className="mt-2 md:mt-3 text-sm md:text-base">
                {isEverythingClaimed
                  ? "Your farm rewards history"
                  : "Claim your earned rewards from solar farm delegations"}
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
            {hasClaimableRewards && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Total Claimable
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(actualClaimableTotals).map(
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
                                {totalClaimableLabel}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-base md:text-xl tabular-nums">
                              {amount.toLocaleString(undefined, {
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
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Weekly Breakdown
              </h3>
              <div className="space-y-3">
                {weeklyBreakdown.map((weekData) => {
                  const { isClaimed, glwClaimed, protocolClaimed } =
                    getWeekClaimState(weekData);

                  const isClaimable = !isClaimed && weekData.isFinalized;

                  // Calculate total rewards for the badge
                  const totalGlwNum = parseFloat(weekData.totalGlw || "0");
                  const totalProtocolNum = Array.from(
                    weekData.totalProtocolDeposit.entries()
                  ).reduce(
                    (sum, [, amount]) => sum + parseFloat(amount || "0"),
                    0
                  );
                  const totalRewards = totalGlwNum + totalProtocolNum;

                  return (
                    <Collapsible
                      key={`${weekData.week}-${isClaimed}`}
                      defaultOpen={!isClaimed && isClaimable}
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
                            {totalRewards > 0 && (
                              <Badge
                                variant="secondary"
                                className="text-xs font-semibold"
                              >
                                {totalRewards.toFixed(2)} GLW
                              </Badge>
                            )}

                            <ChevronRight className="w-4 h-4 text-muted-foreground ml-1 sm:ml-3 hidden sm:inline-block" />
                          </div>
                        </CollapsibleTrigger>
                        <ClaimButtonsWrapper
                          address={address}
                          checkIfClaimed={checkIfClaimed}
                          checkIfGlwClaimed={checkIfGlwClaimed}
                          claimDialogStatus={claimDialogStatus}
                          glwClaimed={glwClaimed}
                          isClaimingAll={isClaimingAll}
                          isClaimingWeek={isClaimingWeek}
                          isConnected={isConnected}
                          onClaimStatusChange={handleClaimStatusChange}
                          onInitiateClaim={handleInitiateClaim}
                          protocolClaimed={protocolClaimed}
                          weekData={weekData}
                        />
                      </div>
                      <CollapsibleContent className="px-4 md:px-5 pb-4 md:pb-5 pt-2">
                        <WeekRewardsContent
                          weekData={weekData}
                          glwClaimed={glwClaimed}
                          protocolClaimed={protocolClaimed}
                          isClaimable={isClaimable}
                          isClaimingWeek={isClaimingWeek}
                          isClaimingAll={isClaimingAll}
                          claimDialogStatus={claimDialogStatus}
                          address={address}
                          onInitiateClaim={handleInitiateClaim}
                          onClaimSuccess={() => {
                            refetch();
                            if (onClaimSuccess) {
                              onClaimSuccess();
                            }
                          }}
                        />
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
                  <div className="font-semibold">About Claims</div>
                  <div className="text-blue-800 dark:text-blue-200">
                    Rewards become claimable after a 3-week finality period.
                    Week 96 and earlier are available to claim on the{" "}
                    <a
                      href="https://hub.glow.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline font-medium"
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
      <SmartAccountWarningDialog
        open={showSmartAccountWarning}
        onOpenChange={handleSmartAccountDialogChange}
        triggerCheck={triggerSmartAccountCheck}
      />
    </>
  );
}

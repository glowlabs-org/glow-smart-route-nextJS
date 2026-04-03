"use client";

import React from "react";
import { useAccount, useChainId } from "wagmi";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ExternalLink,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";
import {
  useClaimableRewards,
  type ClaimableReward,
  type WeeklyClaimableRewards,
} from "@/hooks";
import {
  useRewardsKernelWrapper,
  type ClaimProgressUpdate,
  type ClaimStage,
  type ClaimStageStatus,
  type ProtocolDepositMulticallWeek,
} from "@/hooks/useRewardsKernelWrapper";
import {
  fetchWeeklyReportData,
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
import { trackEvent } from "@/lib/telemetry";
import { formatRewardPipelineDate } from "@/utils/reward-pipeline";

// Currency configurations - neutral containers, colored icons only when active
const CURRENCY_CONFIG = {
  GLW: {
    icon: <Sparkles className="w-4 h-4" />,
    color: "text-[#4ADE80]",
    bgColor: "bg-muted/50",
    label: "GLOW",
  },
  USDC: {
    icon: <Coins className="w-4 h-4" />,
    color: "text-[#2081e2]",
    bgColor: "bg-muted/50",
    label: "USDC",
  },
  USDG: {
    icon: <Coins className="w-4 h-4" />,
    color: "text-[color:var(--delegation-purple)]",
    bgColor: "bg-muted/50",
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
  claimStatus: ClaimStatusSummary;
}

const CLAIM_STAGE_ORDER: ClaimStage[] = ["inflation", "protocolDeposits"];

const CLAIM_STAGE_META: Record<
  ClaimStage,
  { label: string; icon: React.ReactNode }
> = {
  inflation: {
    label: "Emission Rewards",
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
  pending: "bg-muted/50 text-muted-foreground",
  inProgress:
    "bg-[color:var(--color-glow-orange)]/10 text-[color:var(--color-glow-orange)]",
  success: "bg-[#4ADE80]/10 text-[#4ADE80]",
  skipped: "bg-muted/50 text-muted-foreground",
  error: "bg-destructive/10 text-destructive",
};

// Helper to format week number to date
function formatWeekDate(week: number): string {
  const weekTimestamp = GENESIS_TIMESTAMP + (week + 1) * 7 * 86400;
  return formatRewardPipelineDate(weekTimestamp * 1000, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Helper to get Etherscan URL based on chain ID
function getEtherscanUrl(chainId: number, txHash: string): string {
  const baseUrl =
    chainId === 1 ? "https://etherscan.io" : "https://sepolia.etherscan.io";
  return `${baseUrl}/tx/${txHash}`;
}

function getEtherscanAddressUrl(chainId: number, address: string): string {
  const baseUrl =
    chainId === 1 ? "https://etherscan.io" : "https://sepolia.etherscan.io";
  return `${baseUrl}/address/${address}`;
}

function isTransactionTimeoutError(message: string | null): boolean {
  if (!message) return false;
  return message.includes("Transaction receipt not found");
}

function isUserRejectedClaimError(error: unknown): boolean {
  const candidate = error as {
    message?: string;
    shortMessage?: string;
    cause?: { message?: string; shortMessage?: string };
    code?: number;
    name?: string;
  };
  const message =
    candidate?.message ||
    candidate?.shortMessage ||
    candidate?.cause?.shortMessage ||
    candidate?.cause?.message ||
    "";

  return (
    candidate?.code === 4001 ||
    candidate?.name === "UserRejectedRequestError" ||
    message.includes("User rejected") ||
    /denied transaction signature|request rejected|rejected the request/i.test(
      message
    )
  );
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
  glwClaimed: boolean;
  isClaimed: boolean;
  isClaimingAll: boolean;
  isClaimingThisWeek: boolean;
  isConnected: boolean;
  onInitiateClaim: (payload: ClaimInitiationPayload) => void;
  protocolClaimed: boolean;
  size?: "sm" | "default";
  weekData: WeeklyClaimableRewards;
};

function WeekClaimButton({
  address,
  claimDialogStatus,
  claimType = "both",
  className,
  glwClaimed,
  isClaimed,
  isClaimingAll,
  isClaimingThisWeek,
  isConnected,
  onInitiateClaim,
  protocolClaimed,
  size = "sm",
  weekData,
}: WeekClaimButtonProps) {
  const {
    userProof,
    nonce,
    isLoading: isProofLoading,
  } = useMerkleProofs(weekData.week, address);

  const handleOpenDialog = React.useCallback(() => {
    trackEvent("wallet_claim_week_click", {
      week: weekData.week,
      claim_type: claimType,
    });
    if (!isConnected) {
      trackEvent("wallet_claim_week_blocked", {
        week: weekData.week,
        reason: "not_connected",
      });
      toast.info("Connect your wallet to claim rewards.");
      return;
    }

    if (!userProof) {
      trackEvent("wallet_claim_week_blocked", {
        week: weekData.week,
        reason: "no_proof",
      });
      toast.error("No rewards found for your address in this week");
      return;
    }

    let rewardsToClaim: ClaimableReward[] =
      claimType === "v2Only"
        ? weekData.rewards.filter((reward) => reward.type === "protocolDeposit")
        : weekData.rewards.filter((reward) => {
            if (reward.type === "glowInflation") return !glwClaimed;
            if (reward.type === "protocolDeposit") return !protocolClaimed;
            return true;
          });

    if (rewardsToClaim.length === 0) {
      trackEvent("wallet_claim_week_blocked", {
        week: weekData.week,
        reason: "no_rewards",
      });
      toast.info("No rewards available to claim for this selection");
      return;
    }

    trackEvent("wallet_claim_dialog_open", {
      week: weekData.week,
      claim_type: claimType,
      rewards_count: rewardsToClaim.length,
    });
    onInitiateClaim({
      weekData,
      claimType,
      rewardsToClaim,
      userProof,
      nonce,
      claimStatus: {
        glwClaimed,
        protocolClaimed,
      },
    });
  }, [
    claimType,
    glwClaimed,
    isConnected,
    nonce,
    onInitiateClaim,
    protocolClaimed,
    userProof,
    weekData,
  ]);

  const hasProtocolDeposits = React.useMemo(
    () => weekData.rewards.some((reward) => reward.type === "protocolDeposit"),
    [weekData.rewards]
  );

  const weeksToWait =
    claimType === "v2Only" || hasProtocolDeposits ? 4 : 3;
  const targetTimestampMs = React.useMemo(() => {
    const weekSeconds = 7 * 86_400;
    return (
      (GENESIS_TIMESTAMP + (weekData.week + weeksToWait) * weekSeconds) * 1000
    );
  }, [weekData.week, weeksToWait]);

  // Avoid any ticking state here (it causes visible “flicker” across many rows).
  // This will update whenever the component re-renders for other reasons.
  const remainingMs = Math.max(0, targetTimestampMs - Date.now());

  const showCountdown = remainingMs < 24 * 3600 * 1000;

  const countdownLabel = React.useMemo(() => {
    if (!showCountdown) {
      const days = Math.ceil(remainingMs / (24 * 3600 * 1000));
      return days === 1 ? "1 day" : `${days} days`;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const totalHours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${totalHours}h ${minutes}m`;
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
          {claimType === "v2Only"
            ? `PD in ${countdownLabel}`
            : `Claim in ${countdownLabel}`}
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
        Claim Emissions
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
  const [isChecking, setIsChecking] = React.useState(false);
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
      if (!address) return;

      const shouldCheckGlw = hasGlwRewards && isGlwFinalized;
      const shouldCheckProtocol = hasProtocolDeposits && isPdFinalized;

      if (!shouldCheckGlw && !shouldCheckProtocol) {
        return;
      }

      // Only show a spinner if the UI currently believes something is unclaimed
      // (we still check in the background to confirm claim status).
      const shouldShowChecking =
        (shouldCheckGlw && !glwClaimed) ||
        (shouldCheckProtocol && !protocolClaimed);
      if (shouldShowChecking && !cancelled) setIsChecking(true);

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

        if (cancelled) return;

        // Only update parent if status actually changed.
        if (glwStatus !== glwClaimed || protocolStatus !== protocolClaimed) {
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
        if (!cancelled) setIsChecking(false);
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
          glwClaimed={glwClaimed}
          isClaimed={false}
          isClaimingAll={isClaimingAll}
          isClaimingThisWeek={isClaimingThisWeek}
          isConnected={isConnected}
          onInitiateClaim={onInitiateClaim}
          protocolClaimed={protocolClaimed}
          size="default"
          weekData={weekData}
        />
      </div>
    );
  }

  if (!isGlwFinalized && !isPdFinalized) {
    const weekSeconds = 7 * 86_400;
    const pendingWeeksToWait = hasProtocolDeposits ? 4 : 3;
    const claimableTs =
      (GENESIS_TIMESTAMP + (weekData.week + pendingWeeksToWait) * weekSeconds) *
      1000;
    const claimableDateLabel = new Date(claimableTs).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric" }
    );
    return (
      <div className="w-full md:ml-4 md:w-44">
        <Button size="default" className="w-full" disabled>
          <Shield className="w-4 h-4 mr-2" />
          Claimable {claimableDateLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full md:ml-4 md:w-44">
      <WeekClaimButton
        address={address}
        claimDialogStatus={claimDialogStatus}
        glwClaimed={glwClaimed}
        isClaimed={fullyClaimed}
        isClaimingAll={isClaimingAll}
        isClaimingThisWeek={isClaimingThisWeek}
        isConnected={isConnected}
        onInitiateClaim={onInitiateClaim}
        protocolClaimed={protocolClaimed}
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
  const currentEpoch = getCurrentEpoch();
  const hasInflationRewards = React.useMemo(
    () => weekData.rewards.some((reward) => reward.type === "glowInflation"),
    [weekData.rewards]
  );
  const hasProtocolRewards = React.useMemo(
    () => weekData.rewards.some((reward) => reward.type === "protocolDeposit"),
    [weekData.rewards]
  );
  const isGlwFinalized = weekData.week <= currentEpoch - 3;
  const isPdFinalized = weekData.week <= currentEpoch - 4;
  const isWeekFullyUnlocked =
    (!hasInflationRewards || isGlwFinalized) &&
    (!hasProtocolRewards || isPdFinalized);
  const protocolUnlockDateLabel = React.useMemo(() => {
    const weekSeconds = 7 * 86_400;
    const claimableTimestamp =
      (GENESIS_TIMESTAMP + (weekData.week + 4) * weekSeconds) * 1000;
    return formatRewardPipelineDate(claimableTimestamp, {
      month: "short",
      day: "numeric",
    });
  }, [weekData.week]);

  const handleClaimReward = React.useCallback(
    async (reward: ClaimableReward, isInflation: boolean) => {
      if (!address || !userProof) {
        trackEvent("wallet_claim_single_reward_blocked", {
          week: weekData.week,
          reason: "missing_proof_or_address",
        });
        toast.error("No proof found for this week");
        return;
      }

      const rewardType = isInflation ? "inflation" : "protocolDeposit";
      trackEvent("wallet_claim_single_reward_click", {
        week: weekData.week,
        reward_type: rewardType,
        currency: reward.currency,
      });
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
          glwWeight,
          userProof.onchainAssetsEarned
        );

        if (txHash) {
          toast.success(
            `Successfully claimed ${
              isInflation ? "emission" : "protocol deposit"
            } rewards for week ${weekData.week}`
          );
          trackEvent("wallet_claim_single_reward_result", {
            week: weekData.week,
            reward_type: rewardType,
            ok: true,
            tx_hash: txHash,
          });
          if (onClaimSuccess) {
            onClaimSuccess();
          }
        } else {
          trackEvent("wallet_claim_single_reward_result", {
            week: weekData.week,
            reward_type: rewardType,
            ok: false,
            reason: "no_tx_hash",
          });
        }
      } catch (error: any) {
        console.error("Claim error:", error);

        // Report to Sentry (exclude user rejections)
        const isUserRejected = isUserRejectedClaimError(error);
        if (!isUserRejected) {
          const normalizedError =
            error instanceof Error
              ? error
              : new Error(String(error?.message || error));
          Sentry.captureException(normalizedError, {
            tags: { walletStage: "claim_single_reward" },
            extra: {
              week: weekData.week,
              rewardType,
              walletAddress: address,
            },
          });
        }

        toast.error(
          `Failed to claim ${
            isInflation ? "emission" : "protocol deposit"
          } rewards`,
          {
            description: error?.message || "Unknown error",
          }
        );
        trackEvent("wallet_claim_single_reward_result", {
          week: weekData.week,
          reward_type: rewardType,
          ok: false,
          error_name: error instanceof Error ? error.name : "unknown",
        });
      } finally {
        setClaimingRewardType(null);
      }
    },
    [address, userProof, nonce, weekData.week, claimWeekRewards, onClaimSuccess]
  );

  return (
    <div className="space-y-3 border-t border-border/20 dark:border-border/40 pt-3 md:pt-4">
      {glwClaimed &&
        !protocolClaimed &&
        hasProtocolRewards &&
        !isPdFinalized && (
          <div className="rounded-xl border border-border/20 bg-muted/30 px-3 py-2 text-xs text-muted-foreground dark:border-border/40 dark:bg-muted/50">
            Emissions for this week are already claimed. Protocol deposits are
            still moving through the posting and finalization pipeline and
            should unlock around {protocolUnlockDateLabel}.
          </div>
        )}
      {weekData.rewards.map((reward, idx) => {
        const config = CURRENCY_CONFIG[reward.currency as CurrencyKey] || {
          icon: <Coins className="w-4 h-4" />,
          color: "text-muted-foreground",
          bgColor: "bg-muted/50",
          label: reward.currency,
        };

        const isInflation = reward.type === "glowInflation";
        const canClaim = isInflation
          ? !glwClaimed && isWeekFullyUnlocked
          : !protocolClaimed && isWeekFullyUnlocked;
        const rewardLabel = isInflation
          ? "Emission Rewards"
          : "Protocol Deposit";

        return (
          <div
            key={`${reward.currency}-${reward.type}-${idx}`}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-4 rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 gap-3"
          >
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <div
                className={cn(
                  "p-1.5 md:p-2 rounded-lg bg-muted/50 flex-shrink-0",
                  config.color
                )}
              >
                {config.icon}
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-foreground truncate">
                    {config.label}
                  </div>
                  <div className="text-sm md:text-base font-semibold font-mono tabular-nums flex-shrink-0 sm:hidden text-foreground">
                    {parseFloat(reward.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })}
                  </div>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground/70 truncate">
                  {rewardLabel}
                </div>
              </div>
              <div className="text-sm md:text-base font-semibold font-mono tabular-nums flex-shrink-0 hidden sm:block text-foreground">
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
                className="w-full sm:w-auto flex-shrink-0 border-border/40 dark:border-border/60 hover:border-border/60 dark:hover:border-border/80 transition-colors"
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
                  <>Claim {isInflation ? "Emissions" : "PD"}</>
                )}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface ClaimsPanelProps {
  onClaimSuccess?: () => void;
  variant?: "dialog" | "card";
  className?: string;
}

type CurrencyTotals = Record<string, number>;

function formatCompactAmount(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function TotalsSummaryCard({
  title,
  subtitle,
  icon,
  totals,
  className,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  totals: CurrencyTotals;
  className?: string;
}) {
  const entries = Object.entries(totals)
    .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
    .sort((a, b) => b[1] - a[1]);

  const primary = entries[0] ?? null;

  return (
    <div
      className={cn(
        "rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {title}
          </div>
          <div className="mt-1 text-[10px] font-mono text-muted-foreground">
            {subtitle}
          </div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background border border-border/40 text-muted-foreground">
          {icon}
        </div>
      </div>

      <div className="mt-4">
        {entries.length === 0 ? (
          <div className="text-3xl font-semibold font-mono tabular-nums tracking-tight text-foreground">
            0
          </div>
        ) : entries.length === 1 && primary ? (
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-3xl font-semibold font-mono tabular-nums tracking-tight text-foreground">
                {formatCompactAmount(primary[1])}
              </div>
              <div className="mt-1 text-[10px] font-mono text-muted-foreground/70">
                {CURRENCY_CONFIG[primary[0] as CurrencyKey]?.label ??
                  primary[0]}
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0 font-mono text-xs">
              {primary[0]}
            </Badge>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 3).map(([currency, amount]) => {
              const config = CURRENCY_CONFIG[currency as CurrencyKey] || {
                icon: <Coins className="w-4 h-4" />,
                color: "text-muted-foreground",
                bgColor: "bg-muted/50",
                label: currency,
              };
              return (
                <div
                  key={currency}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        "rounded-lg bg-muted/50 p-1.5",
                        config.color
                      )}
                    >
                      {config.icon}
                    </div>
                    <div className="text-sm font-medium text-foreground truncate">
                      {config.label}
                    </div>
                  </div>
                  <div className="text-sm font-semibold font-mono tabular-nums text-foreground">
                    {formatCompactAmount(amount)}
                  </div>
                </div>
              );
            })}
            {entries.length > 3 ? (
              <div className="text-[10px] font-mono text-muted-foreground/70">
                +{entries.length - 3} more
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function RewardTypesInfo() {
  return (
    <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Reward Types
      </div>
      <div className="mt-3 space-y-3 text-sm text-foreground/80 dark:text-foreground/70">
        <div>
          <span className="font-semibold text-foreground">
            Emission Rewards:
          </span>{" "}
          GLW earned by solar farms and split between Glow Miners and Glow
          Delegators.
        </div>
        <div>
          <span className="font-semibold text-foreground">
            Protocol Deposits:
          </span>{" "}
          Rewards from Glow&apos;s redistribution mechanism, where
          high-performing farms earn back deposits plus surplus captured from
          underperforming competitors.
        </div>
      </div>
    </div>
  );
}

function ClaimsAboutInfo() {
  return (
    <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background border border-border/40 shrink-0">
          <Shield className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Security &amp; Finality
          </div>
          <div className="text-sm text-foreground/80 dark:text-foreground/70">
            Each reward batch follows the same pipeline: the protocol week
            closes on Sunday, the control backend generates the batch on
            Thursday, auditors review and post it on-chain on Friday, and then
            the finalization window completes before claims open. That buffer
            gives the protocol team time to pause distributions if an exploit
            or anomaly is ever detected, protecting all participants. Week 96
            and earlier are available on the{" "}
            <a
              href="https://hub.glow.org"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground underline hover:no-underline transition-colors"
            >
              Hub Dashboard
            </a>{" "}
            for V1 Solar Farms.
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingRewardsNotice({
  pendingWeeks,
}: {
  pendingWeeks: WeeklyClaimableRewards[];
}) {
  if (pendingWeeks.length === 0) return null;

  const earliestPending = pendingWeeks.reduce(
    (earliest, w) => (w.week < earliest.week ? w : earliest),
    pendingWeeks[0]
  );
  const earliestHasPd = earliestPending.rewards.some(
    (r) => r.type === "protocolDeposit"
  );
  const earliestWait = earliestHasPd ? 4 : 3;
  const weekSeconds = 7 * 86_400;
  const claimableTimestamp =
    (GENESIS_TIMESTAMP + (earliestPending.week + earliestWait) * weekSeconds) *
    1000;
  const dateLabel = formatRewardPipelineDate(claimableTimestamp, {
    month: "short",
    day: "numeric",
  });
  const pendingLabel =
    pendingWeeks.length === 1
      ? "1 reward week in the pipeline"
      : `${pendingWeeks.length} reward weeks in the pipeline`;

  return (
    <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background border border-border/40 shrink-0">
          <Shield className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{pendingLabel}</div>
          <div className="text-sm text-foreground/80 dark:text-foreground/70">
            These rewards are still moving through review and finalization. Your
            next claim should open around{" "}
            <span className="font-semibold text-foreground">{dateLabel}</span>.
          </div>
        </div>
      </div>
    </div>
  );
}

function InflationClaimReassuranceNotice({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background border border-border/40 shrink-0">
          <Shield className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">
            Your emission rewards are safe
          </div>
          <div className="text-sm text-foreground/80 dark:text-foreground/70">
            If emissions are not claimable today, it can be because your prior
            claim already included more than one week of emission rewards. This
            does not mean anything is missing. You have not lost rewards, and
            claims should return to the normal weekly rhythm on the next cycle.
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClaimsPanel({
  onClaimSuccess,
  variant = "dialog",
  className,
}: ClaimsPanelProps = {}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
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
    claimAllProtocolDepositsInOneTx,
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
  const [isPreparingClaimAll, setIsPreparingClaimAll] = React.useState(false);

  const trackedStageUpdatesRef = React.useRef<Set<string>>(new Set());
  const trackedStageTxRef = React.useRef<Set<string>>(new Set());

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

  // Calculate claimable totals per reward type (avoid counting already-claimed
  // protocol rewards on weeks where emissions are still unclaimed, and vice versa).
  const actualClaimableTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};

    weeklyBreakdown.forEach((weekData) => {
      if (!weekData.isFinalized) return;
      const { glwClaimed, protocolClaimed } = getWeekClaimState(weekData);

      weekData.rewards.forEach((reward) => {
        const isInflation = reward.type === "glowInflation";
        const isRewardClaimed = isInflation ? glwClaimed : protocolClaimed;
        if (isRewardClaimed) return;

        const amount = parseFloat(reward.amount);
        if (!isNaN(amount)) {
          totals[reward.currency] = (totals[reward.currency] || 0) + amount;
        }
      });
    });

    return totals;
  }, [weeklyBreakdown, getWeekClaimState]);

  const claimedTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};

    weeklyBreakdown.forEach((weekData) => {
      if (!weekData.isFinalized) return;
      const { glwClaimed, protocolClaimed } = getWeekClaimState(weekData);

      weekData.rewards.forEach((reward) => {
        const isInflation = reward.type === "glowInflation";
        const isRewardClaimed = isInflation ? glwClaimed : protocolClaimed;
        if (!isRewardClaimed) return;

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

  const totalClaimedWeeks = weeklyBreakdown.filter((weekData) => {
    if (!weekData.isFinalized) return false;
    const { glwClaimed, protocolClaimed } = getWeekClaimState(weekData);
    const hasGlwRewards = weekData.rewards.some(
      (reward) => reward.type === "glowInflation"
    );
    const hasProtocolRewards = weekData.rewards.some(
      (reward) => reward.type === "protocolDeposit"
    );

    return (
      (hasGlwRewards && glwClaimed) || (hasProtocolRewards && protocolClaimed)
    );
  }).length;

  // Calculate total number of claimable (finalized and not already optimistically claimed) weeks
  const totalClaimableWeeks = weeklyBreakdown.filter((week) => {
    const { isClaimed } = getWeekClaimState(week);
    return week.isFinalized && !isClaimed;
  }).length;

  const claimableProtocolWeeks = React.useMemo(() => {
    const currentEpoch = getCurrentEpoch();

    return weeklyBreakdown.filter((weekData) => {
      const isPdFinalized = weekData.week <= currentEpoch - 4;
      if (!isPdFinalized) return false;
      const hasProtocolRewards = weekData.rewards.some(
        (reward) => reward.type === "protocolDeposit"
      );
      if (!hasProtocolRewards) return false;

      const { protocolClaimed } = getWeekClaimState(weekData);
      return !protocolClaimed;
    });
  }, [weeklyBreakdown, getWeekClaimState]);

  const claimableInflationWeeks = React.useMemo(
    () =>
      weeklyBreakdown.filter((weekData) => {
        if (!weekData.isFinalized) return false;
        const hasInflationRewards = weekData.rewards.some(
          (reward) => reward.type === "glowInflation"
        );
        if (!hasInflationRewards) return false;

        const { glwClaimed } = getWeekClaimState(weekData);
        return !glwClaimed;
      }),
    [weeklyBreakdown, getWeekClaimState]
  );

  const shouldShowInflationClaimReassurance = React.useMemo(() => {
    const finalizedInflationWeeks = weeklyBreakdown.filter((weekData) => {
      if (!weekData.isFinalized) return false;
      return weekData.rewards.some((reward) => reward.type === "glowInflation");
    });
    if (finalizedInflationWeeks.length === 0) return false;

    const hasAnyClaimedInflationWeek = finalizedInflationWeeks.some((weekData) => {
      const { glwClaimed } = getWeekClaimState(weekData);
      return glwClaimed;
    });

    return hasAnyClaimedInflationWeek && claimableInflationWeeks.length === 0;
  }, [claimableInflationWeeks.length, getWeekClaimState, weeklyBreakdown]);

  const createInitialStageState = React.useCallback(
    (payload: ClaimInitiationPayload): ClaimStageMap => {
      const hasInflationRewards = payload.weekData.rewards.some(
        (reward) => reward.type === "glowInflation"
      );
      const hasProtocolDepositRewards = payload.weekData.rewards.some(
        (reward) => reward.type === "protocolDeposit"
      );
      const isInflationIncluded = payload.rewardsToClaim.some(
        (reward) => reward.type === "glowInflation"
      );
      const isProtocolIncluded = payload.rewardsToClaim.some(
        (reward) => reward.type === "protocolDeposit"
      );

      const inflationStage: ClaimStageState = hasInflationRewards
        ? payload.claimStatus.glwClaimed || !isInflationIncluded
          ? {
              status: "skipped",
              message: "Emission rewards already claimed.",
            }
          : { status: "pending" }
        : { status: "skipped", message: "Emission rewards already claimed." };

      const protocolStage: ClaimStageState = hasProtocolDepositRewards
        ? payload.claimStatus.protocolClaimed || !isProtocolIncluded
          ? {
              status: "skipped",
              message:
                "Protocol deposit rewards already claimed. Not included in this transaction.",
            }
          : { status: "pending" }
        : {
            status: "skipped",
            message: "Protocol deposit rewards already claimed.",
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

  const updateStageStatus = React.useCallback(
    (update: ClaimProgressUpdate) => {
      setClaimStageStatuses((prev) => {
        const previousStage = prev[update.stage];
        const fallbackMessage: Partial<Record<ClaimStageStatus, string>> = {
          inProgress: "Submitting transaction...",
          success: "Transaction confirmed",
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

      if (activeClaim) {
        const key = `${activeClaim.weekData.week}:${update.stage}:${update.status}`;
        if (!trackedStageUpdatesRef.current.has(key)) {
          trackedStageUpdatesRef.current.add(key);
          trackEvent("wallet_claim_stage_update", {
            week: activeClaim.weekData.week,
            stage: update.stage,
            status: update.status,
            has_tx_hash: Boolean(update.txHash),
          });
        }

        if (update.txHash) {
          const txKey = `${activeClaim.weekData.week}:${update.stage}`;
          if (!trackedStageTxRef.current.has(txKey)) {
            trackedStageTxRef.current.add(txKey);
            trackEvent("wallet_claim_tx_submitted", {
              week: activeClaim.weekData.week,
              stage: update.stage,
              tx_hash: update.txHash,
            });
          }
        }
      }
    },
    [activeClaim]
  );

  const handleInitiateClaim = React.useCallback(
    (payload: ClaimInitiationPayload) => {
      trackedStageUpdatesRef.current = new Set();
      trackedStageTxRef.current = new Set();
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
        if (activeClaim) {
          trackEvent("wallet_claim_dialog_close", {
            week: activeClaim.weekData.week,
            claim_type: activeClaim.claimType,
            status: claimDialogStatus,
          });
        }
        resetClaimDialog();
      } else {
        setIsClaimDialogOpen(true);
      }
    },
    [activeClaim, claimDialogStatus, resetClaimDialog]
  );

  const handleConfirmClaim = React.useCallback(async () => {
    if (!activeClaim) return;

    trackEvent("wallet_claim_confirm_click", {
      week: activeClaim.weekData.week,
      claim_type: activeClaim.claimType,
      rewards_count: activeClaim.rewardsToClaim.length,
    });

    // Check for smart account before proceeding
    const isSmartAccount = await checkSmartAccount();
    if (isSmartAccount) {
      trackEvent("wallet_claim_blocked", {
        week: activeClaim.weekData.week,
        reason: "smart_account",
      });
      setShowSmartAccountWarning(true);
      setTriggerSmartAccountCheck(true);
      return;
    }

    setClaimDialogStatus("processing");
    setClaimDialogError(null);
    setClaimDialogInfo(null);

    trackEvent("wallet_claim_processing_start", {
      week: activeClaim.weekData.week,
      claim_type: activeClaim.claimType,
    });

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
        activeClaim.userProof.onchainAssetsEarned,
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

        trackEvent("wallet_claim_result", {
          week: activeClaim.weekData.week,
          result: allSkipped ? "skipped" : "success",
          inflation_status: inflationStatus,
          protocol_status: protocolStatus,
        });
      } else {
        setClaimDialogStatus("error");
        setClaimDialogError(
          hasSuccess
            ? "Some rewards failed to claim. You can retry the remaining items."
            : "We were unable to complete your claim. Please try again."
        );

        trackEvent("wallet_claim_result", {
          week: activeClaim.weekData.week,
          result: hasSuccess ? "partial_error" : "error",
          inflation_status: inflationStatus,
          protocol_status: protocolStatus,
        });
      }
    } catch (error: any) {
      console.error("Claim confirmation error:", error);

      // Report to Sentry (exclude user rejections)
      const isUserRejected = isUserRejectedClaimError(error);
      if (!isUserRejected) {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error(String(error?.message || error));
        Sentry.captureException(normalizedError, {
          tags: { walletStage: "claim_confirmation" },
          extra: {
            week: activeClaim.weekData.week,
            walletAddress: address,
          },
        });
      }

      setClaimDialogStatus("error");
      setClaimDialogError(
        error?.message ||
          "We were unable to complete your claim. Please try again."
      );
      trackEvent("wallet_claim_result", {
        week: activeClaim.weekData.week,
        result: "exception",
        error_name: error instanceof Error ? error.name : "unknown",
      });
    } finally {
      refetch();
    }
  }, [
    activeClaim,
    address,
    checkSmartAccount,
    claimWeekRewards,
    updateStageStatus,
    refetch,
    onClaimSuccess,
  ]);

  const handleClaimAllProtocolDeposits = React.useCallback(async () => {
    if (!address || !isConnected) {
      toast.info("Connect your wallet to claim rewards.");
      return;
    }

    if (claimableProtocolWeeks.length === 0) {
      toast.info("No protocol deposit rewards available to claim.");
      return;
    }

    const isSmartAccount = await checkSmartAccount();
    if (isSmartAccount) {
      setShowSmartAccountWarning(true);
      setTriggerSmartAccountCheck(true);
      return;
    }

    setIsPreparingClaimAll(true);

    try {
      const hotWalletAddress = getHotWalletAddress();
      const lowerAddress = address.toLowerCase();

      const preparedWeeks = await Promise.all(
        claimableProtocolWeeks.map(async (weekData) => {
          try {
            const report = await fetchWeeklyReportData(weekData.week);
            const userProof =
              report.readableLeaves.find(
                (leaf) => leaf.user.toLowerCase() === lowerAddress
              ) ?? null;

            if (!userProof) return null;

            return {
              week: weekData.week,
              nonce: weekToNonce(weekData.week),
              v2Proof: userProof.v2MerkleProof.map((p) => p as `0x${string}`),
              fromAddress: hotWalletAddress,
              onchainAssetsEarned: userProof.onchainAssetsEarned,
            };
          } catch (error) {
            console.error(
              `Failed to prepare protocol deposit claim for week ${weekData.week}:`,
              error
            );
            return null;
          }
        })
      );

      const weeklyData = preparedWeeks.filter(
        (
          item
        ): item is Exclude<(typeof preparedWeeks)[number], null> =>
          item !== null
      );

      if (weeklyData.length === 0) {
        toast.info("No claimable protocol deposit proofs were found.");
        return;
      }

      const txHash = await claimAllProtocolDepositsInOneTx(weeklyData);

      if (txHash) {
        setV2ClaimedWeeks((prev) => {
          const next = new Set(prev);
          weeklyData.forEach((week) => next.add(week.week));
          return next;
        });

        refetch();
        if (onClaimSuccess) {
          onClaimSuccess();
        }
      }
    } catch (error: any) {
      console.error("Claim all protocol deposits error:", error);
      toast.error("Failed to prepare claim-all transaction", {
        description: error?.message || "Unknown error",
      });
    } finally {
      setIsPreparingClaimAll(false);
    }
  }, [
    address,
    isConnected,
    claimableProtocolWeeks,
    checkSmartAccount,
    claimAllProtocolDepositsInOneTx,
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

    const inflationRewards = activeClaim.rewardsToClaim.filter(
      (reward) => reward.type === "glowInflation"
    );
    if (inflationRewards.length > 0) {
      const total = inflationRewards.reduce(
        (sum, reward) => sum + Number.parseFloat(reward.amount),
        0
      );
      details.push({
        label: "Emission Rewards",
        value: `${total.toFixed(4)} GLW`,
      });
    }

    const protocolRewards = activeClaim.rewardsToClaim.filter(
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

    const inflationRewards = activeClaim.rewardsToClaim.filter(
      (reward) => reward.type === "glowInflation"
    );
    const inflationAmount =
      inflationRewards.length > 0
        ? `${inflationRewards
            .reduce((sum, reward) => sum + Number.parseFloat(reward.amount), 0)
            .toFixed(4)} GLW`
        : null;

    const protocolRewards = activeClaim.rewardsToClaim.filter(
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
              className="flex items-start justify-between gap-4 rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                  {meta.icon}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">
                    {meta.label}
                  </div>
                  {amountLabel && (
                    <div className="text-xs font-mono text-muted-foreground">
                      {amountLabel}
                    </div>
                  )}
                  {status.message && (
                    <div className="mt-1.5 text-[10px] font-mono text-muted-foreground/70">
                      {status.message}
                    </div>
                  )}
                  {status.txHash && (
                    <a
                      href={getEtherscanUrl(chainId, status.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 text-xs font-mono text-foreground hover:text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg inline-block underline hover:no-underline transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on Etherscan:{" "}
                      {`${status.txHash.slice(0, 6)}...${status.txHash.slice(
                        -4
                      )}`}
                    </a>
                  )}
                </div>
              </div>
              <span
                className={cn(
                  "px-3 py-1.5 text-xs font-medium font-mono rounded-full whitespace-nowrap",
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
  }, [activeClaim, chainId, claimStageStatuses]);

  const reviewContent =
    activeClaim && transactionDetails.length > 0 ? (
      <div className="space-y-6 text-left">
        <div className="rounded-xl bg-muted/30 dark:bg-muted/50 p-4 border border-border/20 dark:border-border/40">
          {transactionDetails.map((detail, index) => (
            <div
              key={`${detail.label}-${index}`}
              className={cn(
                "flex items-center justify-between py-3",
                index !== transactionDetails.length - 1 &&
                  "border-b border-border/20 dark:border-border/40"
              )}
            >
              <span className="text-sm text-muted-foreground">
                {detail.label}
              </span>
              <div className="text-right text-sm font-mono font-semibold text-foreground">
                {detail.value}
                {detail.unit ? (
                  <span className="ml-2 text-xs text-muted-foreground/50 dark:text-muted-foreground/70">
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

  const hasTxHashes = React.useMemo(() => {
    return (
      claimStageStatuses.inflation.txHash ||
      claimStageStatuses.protocolDeposits.txHash
    );
  }, [claimStageStatuses]);

  const isTimeoutError = isTransactionTimeoutError(claimDialogError);

  const errorDescription = React.useMemo(() => {
    if (hasTxHashes) {
      return "Your transaction was submitted but we couldn't confirm its completion. Please check the transaction status on Etherscan using the link(s) below. If the transaction failed, please reach out in our Discord #help channel for assistance.";
    }
    if (isTimeoutError) {
      return "Your transaction may still be pending. Before retrying, please check Etherscan to see if your transaction is processing or has completed.";
    }
    return (
      claimDialogError ||
      "We were unable to complete your claim. Please try again."
    );
  }, [hasTxHashes, isTimeoutError, claimDialogError]);

  const errorContent = React.useMemo(() => {
    if (!stageList && !isTimeoutError) return undefined;

    return (
      <div className="space-y-4 text-left">
        {stageList}
        {(hasTxHashes || isTimeoutError) && (
          <div className="p-4 rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40">
            <div className="space-y-3">
              {isTimeoutError && !hasTxHashes && address && (
                <div className="space-y-2">
                  <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                    Check Your Transactions
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <a
                      href={getEtherscanAddressUrl(chainId, address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 underline hover:no-underline font-medium text-foreground transition-colors"
                    >
                      View your wallet on Etherscan
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <span className="block mt-1 text-muted-foreground/80">
                      Look for any pending or recently completed transactions
                      before retrying.
                    </span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                  Need Help?
                </div>
                <div className="text-sm text-muted-foreground">
                  Join our{" "}
                  <a
                    href="https://discord.gg/glowfnd"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline font-medium text-foreground transition-colors"
                  >
                    Discord server
                  </a>{" "}
                  and ask for assistance in the{" "}
                  <span className="font-medium text-foreground">#help</span>{" "}
                  channel.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }, [stageList, hasTxHashes, isTimeoutError, address, chainId]);

  const pendingWeeks = React.useMemo(
    () => weeklyBreakdown.filter((w) => !w.isFinalized),
    [weeklyBreakdown]
  );

  const isDialog = variant === "dialog";

  // Loading state
  if (isLoading) {
    if (isDialog) {
      return (
        <div
          id="claims-panel"
          className={cn("flex max-h-[85vh] flex-col p-6", className)}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border/20 dark:border-border/40 pb-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-60 rounded-lg" />
              <Skeleton className="h-4 w-72 rounded-lg" />
            </div>
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
          <div className="flex-1 overflow-hidden pt-4">
            <ScrollArea className="h-full pr-2">
              <div className="space-y-4 pr-4">
                <Skeleton className="h-4 w-40 rounded-lg" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-xl" />
                  ))}
                </div>
                <Skeleton className="h-4 w-44 mt-4 rounded-lg" />
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      );
    }
    return (
      <Card className="mb-8 border-border/20 dark:border-border/40">
        <CardHeader>
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 mt-2 rounded-lg" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    if (isDialog) {
      return (
        <div
          id="claims-panel"
          className={cn("flex max-h-[85vh] flex-col p-6", className)}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border/20 dark:border-border/40 pb-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-xl font-semibold text-foreground">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                </div>
                Error loading rewards
              </div>
              <div className="text-sm text-muted-foreground">
                Failed to load your claimable rewards. Please try again.
              </div>
            </div>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="border-border/40 dark:border-border/60"
            >
              Retry
            </Button>
          </div>
        </div>
      );
    }
    return (
      <Card className="mb-8 border-border/20 dark:border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertCircle className="w-5 h-5" />
            </div>
            Error Loading Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Failed to load your claimable rewards. Please try again.
          </p>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="border-border/40 dark:border-border/60"
          >
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

  const totalClaimedLabel =
    totalClaimedWeeks === 0
      ? "None yet"
      : totalClaimedWeeks === 1
      ? "1 week"
      : `${totalClaimedWeeks} weeks`;

  const isEverythingClaimed = totalClaimableWeeks === 0;
  const isBulkClaiming = isClaimingAll || isPreparingClaimAll;
  const isBulkClaimBusy = isBulkClaiming || claimDialogStatus === "processing";
  const isClaimAllProtocolDisabled =
    claimableProtocolWeeks.length === 0 || isBulkClaimBusy;

  // Don't show panel if not connected
  if (!isConnected || !address) {
    return null;
  }

  // Don't show panel if there are no weeks at all (user never had any farm rewards)
  if (weeklyBreakdown.length === 0) {
    return null;
  }

  const content = (
    <div className={cn("space-y-6", isDialog && "pr-4")}>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          onClick={handleClaimAllProtocolDeposits}
          disabled={isClaimAllProtocolDisabled}
          className="w-full sm:w-auto"
        >
          {isPreparingClaimAll || isClaimingAll ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Claiming Protocol Deposits...
            </>
          ) : (
            <>
              Claim All Protocol Deposits
              <Badge variant="secondary" className="ml-2 font-mono text-xs">
                {claimableProtocolWeeks.length}
              </Badge>
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TotalsSummaryCard
          title="Total Claimable"
          subtitle={totalClaimableLabel}
          totals={actualClaimableTotals}
          icon={<Gift className="h-4 w-4" />}
          className={cn(!hasClaimableRewards && "opacity-70")}
        />
        <TotalsSummaryCard
          title="Total Claimed"
          subtitle={totalClaimedLabel}
          totals={claimedTotals}
          icon={<CheckCircle className="h-4 w-4" />}
        />
      </div>

      <PendingRewardsNotice pendingWeeks={pendingWeeks} />
      <InflationClaimReassuranceNotice
        show={shouldShowInflationClaimReassurance}
      />

      <div className="space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
          Weekly Breakdown
        </div>
        <div className="space-y-3">
          {weeklyBreakdown.map((weekData) => {
            const { isClaimed, glwClaimed, protocolClaimed } =
              getWeekClaimState(weekData);
            const currentEpoch = getCurrentEpoch();
            const hasGlwRewards = weekData.rewards.some(
              (reward) => reward.type === "glowInflation"
            );
            const hasProtocolRewards = weekData.rewards.some(
              (reward) => reward.type === "protocolDeposit"
            );
            const isGlwFinalized = weekData.week <= currentEpoch - 3;
            const isPdFinalized = weekData.week <= currentEpoch - 4;
            const isWeekFullyUnlocked =
              (!hasGlwRewards || isGlwFinalized) &&
              (!hasProtocolRewards || isPdFinalized);

            const isClaimable = !isClaimed && weekData.isFinalized;

            const totalGlwNum = parseFloat(weekData.totalGlw || "0");
            const totalProtocolNum = Array.from(
              weekData.totalProtocolDeposit.entries()
            ).reduce((sum, [, amount]) => sum + parseFloat(amount || "0"), 0);
            const totalRewards = totalGlwNum + totalProtocolNum;

            return (
              <Collapsible
                key={weekData.week}
                defaultOpen={false}
                className={cn(
                  "rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50",
                  isClaimed && "opacity-60"
                )}
              >
                <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-0">
                  <CollapsibleTrigger className="flex flex-1 flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-foreground md:text-base">
                          Week {weekData.week}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/50 dark:text-muted-foreground/70">
                          {formatWeekDate(weekData.week)}
                        </div>
                      </div>
                      <Badge
                        variant={
                          isClaimed
                            ? "secondary"
                            : isWeekFullyUnlocked
                            ? "default"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {isClaimed ? (
                          <>
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Claimed
                          </>
                        ) : glwClaimed &&
                          !protocolClaimed &&
                          hasProtocolRewards &&
                          !isPdFinalized ? (
                          <>
                            <Sparkles className="mr-1 h-3 w-3" />
                            Emissions Claimed
                          </>
                        ) : isWeekFullyUnlocked ? (
                          <>
                            <Sparkles className="mr-1 h-3 w-3" />
                            Ready to Claim
                          </>
                        ) : (
                          <>
                            <Shield className="mr-1 h-3 w-3" />
                            Finalizing
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {totalRewards > 0 && (
                        <Badge
                          variant="secondary"
                          className="text-xs font-mono tabular-nums"
                        >
                          {totalRewards.toFixed(2)} GLW
                        </Badge>
                      )}
                      <ChevronRight className="hidden h-4 w-4 text-muted-foreground/50 dark:text-muted-foreground/70 sm:inline-block" />
                    </div>
                  </CollapsibleTrigger>
                  <ClaimButtonsWrapper
                    address={address}
                    checkIfClaimed={checkIfClaimed}
                    checkIfGlwClaimed={checkIfGlwClaimed}
                    claimDialogStatus={claimDialogStatus}
                    glwClaimed={glwClaimed}
                    isClaimingAll={isBulkClaiming}
                    isClaimingWeek={isClaimingWeek}
                    isConnected={isConnected}
                    onClaimStatusChange={handleClaimStatusChange}
                    onInitiateClaim={handleInitiateClaim}
                    protocolClaimed={protocolClaimed}
                    weekData={weekData}
                  />
                </div>
                <CollapsibleContent className="px-4 pb-4 pt-1 md:px-5 md:pb-5 border-t border-border/20 dark:border-border/40">
                  <WeekRewardsContent
                    weekData={weekData}
                    glwClaimed={glwClaimed}
                    protocolClaimed={protocolClaimed}
                    isClaimable={isClaimable}
                    isClaimingWeek={isClaimingWeek}
                    isClaimingAll={isBulkClaiming}
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

      <RewardTypesInfo />
      <ClaimsAboutInfo />
    </div>
  );

  return (
    <>
      {isDialog ? (
        <div
          id="claims-panel"
          className={cn("flex max-h-[85vh] flex-col", className)}
        >
          {/* Header with hero amount */}
          <div className="border-b border-border/40 pb-6 pt-8 px-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                {isEverythingClaimed ? "Farm Rewards" : "Claimable Rewards"}
              </div>
              {/* Hero amount */}
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold font-mono tabular-nums tracking-tight text-foreground">
                  {hasClaimableRewards
                    ? formatCompactAmount(
                        Object.values(actualClaimableTotals).reduce(
                          (a, b) => a + b,
                          0
                        )
                      )
                    : "0"}
                </span>
                <span className="text-xl font-mono text-muted-foreground">
                  GLW
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {isEverythingClaimed
                  ? "All rewards have been claimed"
                  : `${totalClaimableWeeks} week${
                      totalClaimableWeeks !== 1 ? "s" : ""
                    } ready to claim`}
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="max-h-[60vh]">
            <div className="p-5 space-y-6">{content}</div>
          </ScrollArea>
        </div>
      ) : (
        <Card
          id="claims-panel"
          className={cn(
            "mb-8 border-border/20 dark:border-border/40 overflow-hidden",
            className
          )}
        >
          <CardHeader className="pb-4 md:pb-6 border-b border-border/20 dark:border-border/40">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 shrink-0">
                <Gift className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80 mb-1">
                  {isEverythingClaimed
                    ? "Rewards History"
                    : "Rewards Available"}
                </div>
                <CardTitle className="text-xl md:text-2xl text-foreground">
                  Farm Rewards
                </CardTitle>
                <CardDescription className="mt-2 text-sm text-muted-foreground">
                  {isEverythingClaimed
                    ? "Your farm rewards history"
                    : "Claim your earned rewards from solar farm delegations"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">{content}</CardContent>
        </Card>
      )}

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

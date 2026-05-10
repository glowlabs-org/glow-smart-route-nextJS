"use client";

import React from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
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
  resolveFractionRemainingSteps,
  useGlowLaunchpad,
} from "@/hooks/hub-listings";
import Link from "next/link";
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
import { getNextWednesdayAt1pmET } from "@/utils/nextTuesdayET";
import { SmartAccountWarningDialog } from "@/components/wallet/smart-account-warning-dialog";
import { trackEvent } from "@/lib/telemetry";
import { formatRewardPipelineDate } from "@/utils/reward-pipeline";
import { useLang, getBcp47, type Strings } from "@/lib/i18n";
import { useEthGasPreflight } from "@/hooks/useEthGasPreflight";
import { formatUnits } from "viem";
import {
  INSUFFICIENT_GAS_ERROR_MESSAGE,
} from "@/lib/rpc-error-utils";

// Conservative gas estimates for the claim flows. Single-week confirm runs up
// to two sequential txs (GLW inflation + protocol deposit). Multicall path
// claims N protocol-deposit weeks in one tx; budget per-week + small base.
// The `useEthGasPreflight` hook adds its own 7% safety margin.
// 750k covers worst-case inflation (~300k) + PD with multi-token transfers
// (~350k) + headroom. The previous 400k let the preflight pass when only the
// inflation tx fit, leaving the PD tx to revert on-chain mid-flow.
const SINGLE_CLAIM_GAS_UNITS = 750_000n;
const MULTICALL_BASE_GAS_UNITS = 50_000n;
const MULTICALL_PER_WEEK_GAS_UNITS = 150_000n;

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
  SGCTL: {
    icon: <Shield className="w-4 h-4" />,
    color: "text-amber-500",
    bgColor: "bg-muted/50",
    label: "sGCTL",
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

// Per the early-claim-delegation mechanic, raw claims unlock the Wednesday at
// 1pm ET that follows the protocol's Saturday-night-ET finalization. The
// Tuesday launchpad delegation window sits between the two, giving users a
// claim-and-delegate path that opens before the standalone unlock.
function computeClaimUnlockTimestampMs(
  week: number,
  weeksToWait: number,
): number {
  const weekSeconds = 7 * 86_400;
  const finalizationMs =
    (GENESIS_TIMESTAMP + (week + weeksToWait) * weekSeconds) * 1000;
  return getNextWednesdayAt1pmET(new Date(finalizationMs)).getTime();
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
  isClaimGateActive?: boolean;
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
  isClaimGateActive = false,
  isClaimingThisWeek,
  isConnected,
  onInitiateClaim,
  protocolClaimed,
  size = "sm",
  weekData,
}: WeekClaimButtonProps) {
  const { t } = useLang();
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
      toast.info(t.claims.toastConnectWallet);
      return;
    }

    if (!userProof) {
      trackEvent("wallet_claim_week_blocked", {
        week: weekData.week,
        reason: "no_proof",
      });
      toast.error(t.claims.toastNoProof);
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
      toast.info(t.claims.toastNoRewardsSelection);
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
    t.claims,
    userProof,
    weekData,
  ]);

  const hasProtocolDeposits = React.useMemo(
    () => weekData.rewards.some((reward) => reward.type === "protocolDeposit"),
    [weekData.rewards]
  );

  const weeksToWait =
    claimType === "v2Only" || hasProtocolDeposits ? 4 : 3;
  const targetTimestampMs = React.useMemo(
    () => computeClaimUnlockTimestampMs(weekData.week, weeksToWait),
    [weekData.week, weeksToWait],
  );

  // Avoid any ticking state here (it causes visible “flicker” across many rows).
  // This will update whenever the component re-renders for other reasons.
  const remainingMs = Math.max(0, targetTimestampMs - Date.now());

  const showCountdown = remainingMs < 24 * 3600 * 1000;

  const countdownLabel = React.useMemo(() => {
    if (!showCountdown) {
      const days = Math.ceil(remainingMs / (24 * 3600 * 1000));
      return days === 1 ? t.claims.dayOne : t.claims.days(days);
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const totalHours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return t.claims.hoursMinutes(totalHours, minutes);
  }, [remainingMs, showCountdown, t.claims]);

  const isDisabled =
    isClaimingThisWeek ||
    isClaimingAll ||
    isClaimed ||
    isProofLoading ||
    !userProof ||
    claimDialogStatus === "processing" ||
    remainingMs > 0 ||
    !isConnected ||
    isClaimGateActive;

  const buttonLabel = React.useMemo(() => {
    if (!isConnected) {
      return t.wallet.connectWallet;
    }

    if (isClaimingThisWeek) {
      return (
        <>
          <Clock className="w-4 h-4 mr-2 animate-spin" />
          {t.claims.claimingInProgress}
        </>
      );
    }

    if (isClaimed) {
      return (
        <>
          <CheckCircle className="w-4 h-4 mr-2" />
          {t.claims.claimed}
        </>
      );
    }

    if (isProofLoading) {
      return (
        <>
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          {t.claims.loadingProof}
        </>
      );
    }

    if (!userProof) {
      return <>{t.claims.noRewards}</>;
    }

    if (remainingMs > 0) {
      return (
        <>
          <Clock className="w-4 h-4 mr-2" />
          {claimType === "v2Only"
            ? t.claims.pdIn(countdownLabel)
            : t.claims.claimIn(countdownLabel)}
        </>
      );
    }

    if (claimType === "v2Only") {
      return (
        <>
          {t.claims.claimPd}
          <ChevronRight className="w-4 h-4 ml-2" />
        </>
      );
    }

    return (
      <>
        {t.claims.claimEmissions}
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
    t.claims,
    t.wallet.connectWallet,
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
  isClaimGateActive?: boolean;
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
  isClaimGateActive = false,
  isClaimingWeek,
  isConnected,
  onClaimStatusChange,
  onInitiateClaim,
  protocolClaimed,
  weekData,
}: ClaimButtonsWrapperProps) {
  const { t, lang } = useLang();
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

        // Monotonic update: only "upgrade" false → true (when the backend
        // or chain confirms a claim). Never downgrade true → false based
        // on polling, because the backend indexer can lag a freshly
        // optimistically-marked claim by several seconds — overwriting
        // would make the panel flicker back to "Ready to claim" until
        // the indexer catches up.
        const nextGlw = glwStatus || glwClaimed;
        const nextProtocol = protocolStatus || protocolClaimed;
        if (nextGlw !== glwClaimed || nextProtocol !== protocolClaimed) {
          onClaimStatusChange(weekData.week, {
            glwClaimed: nextGlw,
            protocolClaimed: nextProtocol,
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
          {t.claims.checking}
        </Button>
      </div>
    );
  }

  if (fullyClaimed) {
    return (
      <div className="w-full md:ml-4 md:w-44">
        <Button size="default" className="w-full" variant="secondary" disabled>
          <CheckCircle className="w-4 h-4 mr-2" />
          {t.claims.claimed}
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
          isClaimGateActive={isClaimGateActive}
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
    const pendingWeeksToWait = hasProtocolDeposits ? 4 : 3;
    const claimableTs = computeClaimUnlockTimestampMs(
      weekData.week,
      pendingWeeksToWait,
    );
    const claimableDateLabel = new Date(claimableTs).toLocaleDateString(
      getBcp47(lang),
      { month: "short", day: "numeric" }
    );
    return (
      <div className="w-full md:ml-4 md:w-44">
        <Button size="default" className="w-full" disabled>
          <Shield className="w-4 h-4 mr-2" />
          {t.claims.claimableOn(claimableDateLabel)}
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
        isClaimGateActive={isClaimGateActive}
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
  isClaimGateActive?: boolean;
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
  isClaimGateActive = false,
  claimDialogStatus,
  address,
  onInitiateClaim,
  onClaimSuccess,
}: WeekRewardsContentProps) {
  const { t, lang } = useLang();
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
  // Epoch 121 protocol deposits are delayed one week, claimable April 18 2026 at 9 AM ET.
  const isEpoch121PdDelayed =
    weekData.week === 121 && Date.now() < Date.UTC(2026, 3, 18, 13, 0, 0);
  const isWeekFullyUnlocked =
    (!hasInflationRewards || isGlwFinalized) &&
    (!hasProtocolRewards || (isPdFinalized && !isEpoch121PdDelayed));
  const protocolUnlockDateLabel = React.useMemo(() => {
    if (weekData.week === 121) return "Apr 18";
    const claimableTimestamp = computeClaimUnlockTimestampMs(weekData.week, 4);
    return formatRewardPipelineDate(claimableTimestamp, {
      month: "short",
      day: "numeric",
      locale: getBcp47(lang),
    });
  }, [weekData.week, lang]);

  const handleClaimReward = React.useCallback(
    async (reward: ClaimableReward, isInflation: boolean) => {
      if (!address || !userProof) {
        trackEvent("wallet_claim_single_reward_blocked", {
          week: weekData.week,
          reason: "missing_proof_or_address",
        });
        toast.error(t.claims.toastNoProof);
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
            t.claims.toastClaimSuccess(
              isInflation
                ? t.claims.emissionRewardsWord
                : t.claims.protocolDepositWord,
              weekData.week
            )
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
          t.claims.toastUnableToComplete,
          {
            description: error?.message || t.claims.toastUnknownError,
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
    [address, userProof, nonce, weekData.week, claimWeekRewards, onClaimSuccess, t.claims]
  );

  return (
    <div className="space-y-3 border-t border-border/20 dark:border-border/40 pt-3 md:pt-4">
      {glwClaimed &&
        !protocolClaimed &&
        hasProtocolRewards &&
        !isPdFinalized && (
          <div className="rounded-xl border border-border/20 bg-muted/30 px-3 py-2 text-xs text-muted-foreground dark:border-border/40 dark:bg-muted/50">
            {t.claims.pendingNoticeBody(protocolUnlockDateLabel)}
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
          ? !glwClaimed && isGlwFinalized
          : !protocolClaimed && isPdFinalized && !isEpoch121PdDelayed;
        const rewardLabel = isInflation
          ? t.claims.emissionRewards
          : reward.currency === "SGCTL"
          ? t.claims.protocolDepositWithCredit
          : t.claims.protocolDepositLabel;

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
                  claimingRewardType !== null ||
                  isClaimGateActive
                }
              >
                {claimingRewardType ===
                (isInflation ? "inflation" : "protocolDeposit") ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                    {t.claims.claimingInProgress}
                  </>
                ) : (
                  <>
                    {t.claims.claimButton(
                      isInflation
                        ? t.claims.claimEmissionsShort
                        : t.claims.claimPdShort
                    )}
                  </>
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
  const { t } = useLang();
  return (
    <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        {t.claims.rewardTypesTitle}
      </div>
      <div className="mt-3 space-y-3 text-sm text-foreground/80 dark:text-foreground/70">
        {t.claims.rewardTypesBody}
      </div>
    </div>
  );
}

function ClaimsAboutInfo() {
  const { t } = useLang();
  return (
    <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background border border-border/40 shrink-0">
          <Shield className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            {t.claims.aboutClaimsTitle}
          </div>
          <div className="text-sm text-foreground/80 dark:text-foreground/70">
            {t.claims.aboutClaimsBody}
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
  const { t, lang } = useLang();
  if (pendingWeeks.length === 0) return null;

  const earliestPending = pendingWeeks.reduce(
    (earliest, w) => (w.week < earliest.week ? w : earliest),
    pendingWeeks[0]
  );
  const earliestHasPd = earliestPending.rewards.some(
    (r) => r.type === "protocolDeposit"
  );
  const earliestWait = earliestHasPd ? 4 : 3;
  const claimableTimestamp = computeClaimUnlockTimestampMs(
    earliestPending.week,
    earliestWait,
  );
  const dateLabel = formatRewardPipelineDate(claimableTimestamp, {
    month: "short",
    day: "numeric",
    locale: getBcp47(lang),
  });
  const pendingLabel =
    pendingWeeks.length === 1
      ? t.claims.pendingWeeksOne
      : t.claims.pendingWeeksMany(pendingWeeks.length);

  return (
    <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background border border-border/40 shrink-0">
          <Shield className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{pendingLabel}</div>
          <div className="text-sm text-foreground/80 dark:text-foreground/70">
            {t.claims.pendingNoticeBody(dateLabel)}
          </div>
        </div>
      </div>
    </div>
  );
}

function InflationClaimReassuranceNotice({ show }: { show: boolean }) {
  const { t } = useLang();
  if (!show) return null;

  return (
    <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background border border-border/40 shrink-0">
          <Shield className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">
            {t.claims.inflationReassuranceTitle}
          </div>
          <div className="text-sm text-foreground/80 dark:text-foreground/70">
            {t.claims.inflationReassuranceBody}
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
  const { t } = useLang();
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();

  // Snapshot of the connected wallet's identity used for claim diagnostics.
  // Privy wraps wagmi connectors and silently swallows some sign requests
  // for specific connector + transport combinations (issue surfaced after
  // the Privy migration). Capturing this on every claim event lets us
  // pin down which combinations are affected without needing the user
  // to reproduce in front of us.
  const claimWalletSnapshot = React.useMemo(
    () => ({
      walletAddress: address ?? null,
      isConnected,
      chainId,
      connectorId: connector?.id ?? null,
      connectorName: connector?.name ?? null,
      connectorType: connector?.type ?? null,
      hasWalletClient: Boolean(walletClient),
      walletClientChainId: walletClient?.chain?.id ?? null,
      walletClientAccount: walletClient?.account?.address ?? null,
      walletClientTransportType:
        (walletClient as { transport?: { type?: string } } | undefined)
          ?.transport?.type ?? null,
      walletClientTransportName:
        (walletClient as { transport?: { name?: string } } | undefined)
          ?.transport?.name ?? null,
    }),
    [address, isConnected, chainId, connector, walletClient]
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

  // Listing-presence claim gate. When a GLW launchpad delegation is live,
  // direct claims are gated; users must claim-and-delegate via the marketplace
  // dialog instead, which keeps the GLW from being dumped post-claim.
  const launchpad = useGlowLaunchpad();
  const liveGlwListing = React.useMemo(() => {
    return launchpad.applications.find((app) => {
      const fraction = app.activeFraction;
      if (!fraction) return false;
      if (fraction.delegationAsset && fraction.delegationAsset !== "GLW") {
        return false;
      }
      const remaining = resolveFractionRemainingSteps(fraction);
      return remaining > 0;
    });
  }, [launchpad.applications]);
  const isClaimGateActive = Boolean(liveGlwListing);

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

  // ETH gas preflight: gate both claim entry points so users with insufficient
  // ETH for gas see a clear "add ETH" message instead of a generic RPC revert
  // toast (and so the failed write never reaches Sentry).
  const singleClaimGasPreflight = useEthGasPreflight({
    estimatedGasUnits: SINGLE_CLAIM_GAS_UNITS,
    enabled: isConnected && Boolean(address),
  });
  const multicallClaimGasUnits = React.useMemo(() => {
    const weeks = BigInt(Math.max(claimableProtocolWeeks.length, 1));
    return MULTICALL_BASE_GAS_UNITS + weeks * MULTICALL_PER_WEEK_GAS_UNITS;
  }, [claimableProtocolWeeks.length]);
  const multicallGasPreflight = useEthGasPreflight({
    estimatedGasUnits: multicallClaimGasUnits,
    enabled:
      isConnected && Boolean(address) && claimableProtocolWeeks.length > 0,
  });
  const hasInsufficientSingleClaimGas =
    singleClaimGasPreflight.sufficient === false;
  const hasInsufficientMulticallGas =
    multicallGasPreflight.sufficient === false;
  const gasShortfallEth =
    multicallGasPreflight.shortfallWei != null &&
    multicallGasPreflight.shortfallWei > 0n
      ? formatUnits(multicallGasPreflight.shortfallWei, 18)
      : singleClaimGasPreflight.shortfallWei != null &&
          singleClaimGasPreflight.shortfallWei > 0n
        ? formatUnits(singleClaimGasPreflight.shortfallWei, 18)
        : null;

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
          Sentry.addBreadcrumb({
            category: "claim_stage",
            message: `${update.stage}:${update.status}`,
            level: update.status === "error" ? "error" : "info",
            data: {
              week: activeClaim.weekData.week,
              txHash: update.txHash ?? null,
              message: update.message ?? null,
            },
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
    Sentry.addBreadcrumb({
      category: "claim",
      message: "confirm_click",
      level: "info",
      data: {
        week: activeClaim.weekData.week,
        claimType: activeClaim.claimType,
        rewardsCount: activeClaim.rewardsToClaim.length,
        ...claimWalletSnapshot,
      },
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

    if (hasInsufficientSingleClaimGas) {
      toast.error(INSUFFICIENT_GAS_ERROR_MESSAGE);
      setClaimDialogStatus("error");
      setClaimDialogError(INSUFFICIENT_GAS_ERROR_MESSAGE);
      trackEvent("wallet_claim_blocked", {
        week: activeClaim.weekData.week,
        reason: "insufficient_gas",
      });
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

    const claimStartedAt = performance.now();
    let claimReturnValue: string | null = null;
    try {
      claimReturnValue = await claimWeekRewards(
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

      // Silent-failure detector: claim flow returned without firing any
      // progress callback AND without throwing. Stages remain at their
      // initial value (typically "pending"), so the existing `!hasError`
      // branch below would mark the dialog as success even though nothing
      // happened. Capture full diagnostics so we can correlate which
      // connector + transport combos hit this path.
      const noStageProgress =
        !hasError &&
        !hasSuccess &&
        !allSkipped &&
        claimReturnValue == null;
      if (noStageProgress) {
        const elapsedMs = Math.round(performance.now() - claimStartedAt);
        console.warn(
          "[Glow claim] Claim flow ended without firing any stage progress",
          {
            week: activeClaim.weekData.week,
            elapsedMs,
            ...claimWalletSnapshot,
          }
        );
        Sentry.captureMessage("claim_silent_failure_no_progress", {
          level: "error",
          tags: {
            walletStage: "claim_silent_failure",
            connectorId: connector?.id ?? "unknown",
            connectorType: connector?.type ?? "unknown",
          },
          extra: {
            week: activeClaim.weekData.week,
            claimType: activeClaim.claimType,
            rewardsToClaimCount: activeClaim.rewardsToClaim.length,
            elapsedMs,
            inflationStatus,
            protocolStatus,
            ...claimWalletSnapshot,
          },
        });
      }
      if (hasSuccess || allSkipped) {
        setClaimDialogStatus("success");
        if (allSkipped && !hasSuccess) {
          setClaimDialogInfo(t.claims.toastRewardsAlreadyClaimed);
        }
        if (hasSuccess && onClaimSuccess) {
          onClaimSuccess();
        }

        // Optimistically mark the affected stages as claimed so the panel
        // updates immediately. The backend indexer can lag the on-chain
        // claim by several seconds, which made the panel look stale until
        // a manual page refresh.
        const claimedWeek = activeClaim.weekData.week;
        if (inflationStatus === "success") {
          setV1ClaimedWeeks((prev) => {
            if (prev.has(claimedWeek)) return prev;
            const next = new Set(prev);
            next.add(claimedWeek);
            return next;
          });
        }
        if (protocolStatus === "success") {
          setV2ClaimedWeeks((prev) => {
            if (prev.has(claimedWeek)) return prev;
            const next = new Set(prev);
            next.add(claimedWeek);
            return next;
          });
        }

        trackEvent("wallet_claim_result", {
          week: activeClaim.weekData.week,
          result: hasSuccess ? "success" : "skipped",
          inflation_status: inflationStatus,
          protocol_status: protocolStatus,
        });
      } else {
        // Either an explicit error fired, or no stage progressed at all
        // (silent failure — the dialog must NOT paint success in that case).
        setClaimDialogStatus("error");
        setClaimDialogError(
          hasError
            ? hasSuccess
              ? t.claims.toastSomeFailed
              : t.claims.toastUnableToComplete
            : t.claims.toastUnableToComplete
        );

        trackEvent("wallet_claim_result", {
          week: activeClaim.weekData.week,
          result: hasError
            ? hasSuccess
              ? "partial_error"
              : "error"
            : "no_progress",
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
        const elapsedMs = Math.round(performance.now() - claimStartedAt);
        Sentry.captureException(normalizedError, {
          tags: {
            walletStage: "claim_confirmation",
            connectorId: connector?.id ?? "unknown",
            connectorType: connector?.type ?? "unknown",
          },
          extra: {
            week: activeClaim.weekData.week,
            claimType: activeClaim.claimType,
            elapsedMs,
            errorName: error instanceof Error ? error.name : null,
            errorCode: (error as { code?: unknown })?.code ?? null,
            errorShortMessage:
              (error as { shortMessage?: string })?.shortMessage ?? null,
            errorMetaMessages:
              (error as { metaMessages?: string[] })?.metaMessages?.join(
                " | "
              ) ?? null,
            errorCauseMessage:
              (error as { cause?: { message?: string } })?.cause?.message ??
              null,
            errorCauseName:
              (error as { cause?: { name?: string } })?.cause?.name ?? null,
            ...claimWalletSnapshot,
          },
        });
      }

      setClaimDialogStatus("error");
      setClaimDialogError(
        error?.message || t.claims.toastUnableToComplete
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
    t.claims,
    hasInsufficientSingleClaimGas,
    claimWalletSnapshot,
    connector,
  ]);

  const handleClaimAllProtocolDeposits = React.useCallback(async () => {
    if (!address || !isConnected) {
      toast.info(t.claims.toastConnectWallet);
      return;
    }

    if (claimableProtocolWeeks.length === 0) {
      toast.info(t.claims.toastNoProtocolAvailable);
      return;
    }

    const isSmartAccount = await checkSmartAccount();
    if (isSmartAccount) {
      setShowSmartAccountWarning(true);
      setTriggerSmartAccountCheck(true);
      return;
    }

    if (hasInsufficientMulticallGas) {
      toast.error(INSUFFICIENT_GAS_ERROR_MESSAGE);
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
        toast.info(t.claims.toastNoClaimableProofs);
        return;
      }

      const { txHash, alreadyClaimedWeeks } =
        await claimAllProtocolDepositsInOneTx(weeklyData);

      // Optimistically mark every week the kernel reports as claimed
      // on-chain, whether the wrapper just landed the multicall or merely
      // observed the prior tx. This stops the UI from inviting the user
      // back into a re-claim attempt while the indexer catches up.
      const claimedNow = txHash
        ? weeklyData
            .filter((w) => !alreadyClaimedWeeks.includes(w.week))
            .map((w) => w.week)
        : [];
      const claimedTotal = [...claimedNow, ...alreadyClaimedWeeks];

      if (claimedTotal.length > 0) {
        setV2ClaimedWeeks((prev) => {
          const next = new Set(prev);
          claimedTotal.forEach((week) => next.add(week));
          return next;
        });

        refetch();
        if (onClaimSuccess) {
          onClaimSuccess();
        }
      }
    } catch (error: any) {
      console.error("Claim all protocol deposits error:", error);
      toast.error(t.claims.toastUnableToComplete, {
        description: error?.message || t.claims.toastUnknownError,
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
    t.claims,
    hasInsufficientMulticallGas,
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
          .map(([currency, amount]) => `${amount.toFixed(4)} ${currency === "SGCTL" ? "sGCTL" : currency}`)
          .join(", "),
      });

      if (protocolRewards.some((reward) => reward.currency === "SGCTL")) {
        details.push({
          label: "sGCTL Settlement",
          value: "Credited to your staked balance after the claim confirms",
        });
      }
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
            .map(([currency, amount]) => `${amount.toFixed(4)} ${currency === "SGCTL" ? "sGCTL" : currency}`)
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
    claimableProtocolWeeks.length === 0 ||
    isBulkClaimBusy ||
    hasInsufficientMulticallGas ||
    isClaimGateActive;

  // Don't show panel if not connected
  if (!isConnected || !address) {
    return null;
  }

  // Don't show panel if there are no weeks at all (user never had any farm rewards)
  if (weeklyBreakdown.length === 0) {
    return null;
  }

  const showInsufficientGasNotice =
    hasInsufficientSingleClaimGas || hasInsufficientMulticallGas;

  const content = (
    <div className={cn("space-y-6", isDialog && "pr-4")}>
      {showInsufficientGasNotice && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">{INSUFFICIENT_GAS_ERROR_MESSAGE}</div>
            {gasShortfallEth && (
              <div className="text-xs opacity-80">
                Need ~{Number(gasShortfallEth).toFixed(6)} ETH more.
              </div>
            )}
          </div>
        </div>
      )}
      {isClaimGateActive && (
        <div className="flex items-start gap-2 rounded-md border border-[color:var(--color-glow-orange)]/40 bg-[color:var(--color-glow-orange)]/10 p-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-glow-orange)]" />
          <div className="space-y-1">
            <div className="font-medium text-foreground">
              A GLW launchpad delegation is live now.
            </div>
            <div className="text-xs text-muted-foreground">
              Claims are paused while the listing is open. Claim and delegate
              your unclaimed GLW in one flow on the launchpad to keep your
              capital working.
            </div>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-glow-orange)] hover:underline"
            >
              Go to launchpad
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          onClick={handleClaimAllProtocolDeposits}
          disabled={isClaimAllProtocolDisabled}
          className="w-full sm:w-auto"
        >
          {isPreparingClaimAll || isClaimingAll ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              {t.claims.claimingProtocolDeposits}
            </>
          ) : (
            <>
              {t.claims.claimAllProtocolDeposits}
              <Badge variant="secondary" className="ml-2 font-mono text-xs">
                {claimableProtocolWeeks.length}
              </Badge>
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TotalsSummaryCard
          title={t.claims.totalClaimable}
          subtitle={totalClaimableLabel}
          totals={actualClaimableTotals}
          icon={<Gift className="h-4 w-4" />}
          className={cn(!hasClaimableRewards && "opacity-70")}
        />
        <TotalsSummaryCard
          title={t.claims.totalClaimed}
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
          {t.claims.weeklyBreakdown}
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
                          {t.claims.weekLabel(weekData.week)}
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
                            {t.claims.claimed}
                          </>
                        ) : glwClaimed &&
                          !protocolClaimed &&
                          hasProtocolRewards &&
                          !isPdFinalized ? (
                          <>
                            <Sparkles className="mr-1 h-3 w-3" />
                            {t.claims.emissionsClaimed}
                          </>
                        ) : isWeekFullyUnlocked ? (
                          <>
                            <Sparkles className="mr-1 h-3 w-3" />
                            {t.claims.readyToClaim}
                          </>
                        ) : (
                          <>
                            <Shield className="mr-1 h-3 w-3" />
                            {t.claims.finalizing}
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
                    isClaimGateActive={isClaimGateActive}
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
                    isClaimGateActive={isClaimGateActive}
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
                {isEverythingClaimed
                  ? t.claims.heroFarmRewardsLabel
                  : t.claims.heroClaimableLabel}
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
                  ? t.claims.heroAllClaimed
                  : t.claims.heroWeeksReadyToClaim(totalClaimableWeeks)}
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
                    ? t.claims.cardRewardsHistory
                    : t.claims.cardRewardsAvailable}
                </div>
                <CardTitle className="text-xl md:text-2xl text-foreground">
                  {t.claims.cardTitleFarmRewards}
                </CardTitle>
                <CardDescription className="mt-2 text-sm text-muted-foreground">
                  {isEverythingClaimed
                    ? t.claims.cardDescriptionAllClaimed
                    : t.claims.cardDescriptionClaimable}
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
        title={t.claims.reviewClaimTitle}
        successTitle={t.claims.claimCompleteTitle}
        errorTitle={t.claims.claimFailedTitle}
        processingTitle={t.claims.processingClaimTitle}
        description={t.claims.reviewClaimDescription}
        processingDescription={t.claims.processingClaimDescription}
        errorDescription={errorDescription}
        transactionDetails={transactionDetails}
        reviewContent={reviewContent}
        successContent={successContent}
        errorContent={errorContent}
        showProcessingProgress
        onConfirm={activeClaim ? handleConfirmClaim : undefined}
        confirmDisabled={
          !activeClaim ||
          claimDialogStatus === "processing" ||
          hasInsufficientSingleClaimGas
        }
        confirmLabel={t.claims.confirmClaim}
        cancelLabel={t.claims.cancel}
      />
      <SmartAccountWarningDialog
        open={showSmartAccountWarning}
        onOpenChange={handleSmartAccountDialogChange}
        triggerCheck={triggerSmartAccountCheck}
      />
    </>
  );
}

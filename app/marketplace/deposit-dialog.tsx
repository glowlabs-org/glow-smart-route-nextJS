"use client";

import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TransactionDetail } from "@/components/dialogs/transaction-dialog";
import { Button } from "@/components/ui/button";
import {
  Minus,
  Plus,
  Loader2,
  X,
  Coins,
  Share2,
  RefreshCw,
  CreditCard,
  Sparkles,
  Zap,
} from "lucide-react";
import { mainnet, sepolia } from "wagmi/chains";
import {
  useFundWallet,
  useLogin,
  usePrivy,
} from "@privy-io/react-auth";
import { capturePrivyWalletError } from "@/lib/privy-errors";
import { GlowSymbol } from "@/components/glow-symbol";
import { cn } from "@/lib/utils";
import { useAccount, useChainId } from "wagmi";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { SegmentedCircleProgress } from "@/components/ui/circle-progress";
import { formatNumber } from "./utils";
import { formatUnits, parseUnits } from "viem";
import {
  DECIMALS_BY_TOKEN,
  buildDelegateSgctlMessage,
  delegateSgctlEIP712Types,
  stakeControlEIP712Domain,
  type FarmWithRewards,
} from "@glowlabs-org/utils/browser";
import { useQueryClient } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";
import { useEthPrice } from "@/hooks/useEthPrice";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import {
  fetchSponsorListings,
  useRewardsBreakdown,
  useSponsorApplication,
  type AuctionApplication,
} from "@/hooks";
import {
  fetchWalletRegionAvailableStake,
  useWalletRegionAvailableStake,
  useWallets,
} from "@/hooks/control-wallets";
import { useGctlPreparationOrchestrator } from "@/hooks/useGctlPreparationOrchestrator";
import { ConnectButton } from "@/components/connect-button";
import { trackEvent } from "@/lib/telemetry";
import { bucketUsd } from "@/lib/telemetry-buckets";
import { getStoredReferralAttribution } from "@/lib/referral-attribution";
import * as Sentry from "@sentry/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { getControlRouter } from "@/lib/api/control-routers";
import { getSmartAccountStatus } from "@/web3/web3/utils/detectSmartAccount";
import { publicClient } from "@/web3/web3/clients/publicClient";
import { SmartAccountWarningDialog } from "@/components/wallet/smart-account-warning-dialog";
import { toast } from "sonner";
import { useFractionSplits } from "@/hooks";
import { addresses } from "@/web3/constants/addresses";
import { useSwapUSDCToUSDG } from "@/hooks/useSwapUSDCToUSDG";
import { useSwap } from "@/hooks/useSwap";
import { GlowSymbolAnimated } from "@/components/glow-symbol-animated";
import {
  TransactionStepper,
  type StepStatus,
} from "@/components/transaction-stepper";

import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";
import { usePatchedOffchainFractions } from "@/hooks/usePatchedOffchainFractions";
import {
  CONTRACT_ERROR_MESSAGES,
  RPC_INTERNAL_ERROR_MESSAGE,
  calculateAffordability,
  calculateCostInETH,
  calculateCostInGCTL,
  calculateCostInGLW,
  calculateCostInUSDC,
  calculateEstimatedRewardsBreakdown,
  calculateShortfall,
  calculateSuccessMetrics,
  clampQuantity,
  coerceToBigInt,
  findErrorInMessage,
  getDefaultPaymentMethodForRuntimeCurrency,
  generateShareUrl,
  getErrorCode,
  getErrorMessage,
  hasConfirmedSplitPurchase,
  getSgctlPreparationCutoffGuard,
  isDelayedSplitConfirmationErrorMessage,
  getSwapVolatilityErrorMessage,
  getInitialPositionValueGuard,
  initializeTransactionSteps,
  isInternalRpcError,
  isRetriableStakeSyncRefreshError,
  MIN_INITIAL_POSITION_USD,
  parseAvailableStakeSnapshot,
  parseQuantityInput,
  requiresSmartAccountCheck,
  resolveDelegationStepAtomic,
  resolveRuntimeSelectedCurrency,
  selectClaimSetForGlwDelegation,
  SPLIT_CONFIRMATION_DELAYED_MESSAGE,
  updateTransactionStepStatus,
  withInternalRpcRetry,
  type ClaimableGlwItem,
  type ClaimSetSelection,
  type DepositPaymentMethod,
  type DepositSelectedCurrency,
  type SgctlSourceMode,
  type SuccessMetrics,
  type TransactionStep,
} from "./deposit-dialog-utils";
import { useUnclaimedGlwForDelegation } from "@/hooks/useUnclaimedGlwForDelegation";
import { useRewardsKernelWrapper } from "@/hooks/useRewardsKernelWrapper";
import {
  fetchWeeklyReportData,
  getHotWalletAddress,
  weekToNonce,
  type ReadableLeafReward,
} from "@/hooks/useMerkleProofs";
import type { ClaimableReward } from "@/hooks/control-wallets";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { useV2PointsBalance, useV2PointsRates } from "@/hooks/v2-points";
import { useEstimatedAllocation } from "@/hooks/v2-impact";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  resolveFractionRemainingSteps,
  type SplitActivity,
  type SplitsActivityResponse,
} from "@/hooks/hub-listings";
import { resolveLaunchpadDelegationUnitCount } from "@/utils/launchpad-rewards";
import { hubGet } from "@/lib/api/hub-client";
import type { RewardsBreakdownResponse } from "@/hooks/hub-fractions";
import { getLaunchpadNowMs } from "@/utils/launchpad-now";
import { normalizeMinerWeeksRemainingDisplay } from "@/lib/mining-score";
import { useLang } from "@/lib/i18n";

export type LaunchpadRewardScore = {
  userWeeklyGlwRewards: string;
  userWeeklyPdRewards: string;
};

export type MiningCenterScore = {
  miningScore: number;
  weeklyGlwRewards?: string;
  weeklyGlwRewardsUsd?: string;
  weeksOfMinerLifeRemaining?: number;
};

function updateApplicationAfterSuccessfulPurchase(
  application: AuctionApplication,
  quantity: number,
): AuctionApplication {
  const fraction = application.activeFraction;
  if (!fraction) return application;

  const totalSteps = Math.max(0, Math.floor(fraction.totalSteps ?? 0));
  const prevRemaining = resolveFractionRemainingSteps(fraction);
  const nextRemaining = Math.max(0, prevRemaining - Math.max(0, quantity));
  const nextSplitsSold = Math.max(
    0,
    Math.floor(fraction.splitsSold ?? 0) + Math.max(0, quantity),
  );
  const filled = Math.max(0, totalSteps - nextRemaining);
  const progressPercent =
    totalSteps > 0 ? Number(((filled / totalSteps) * 100).toFixed(2)) : 0;

  return {
    ...application,
    activeFraction: {
      ...fraction,
      remainingSteps: nextRemaining,
      splitsSold: nextSplitsSold,
      progressPercent,
      isFilled: nextRemaining <= 0,
    },
  };
}

function prependSuccessfulSplitActivity(
  previous: SplitsActivityResponse | undefined,
  params: {
    txHash: string;
    walletAddress: string;
    application: AuctionApplication;
    quantity: number;
    amount: bigint;
    currency: DepositSelectedCurrency;
  },
): SplitsActivityResponse | undefined {
  if (!previous) return previous;

  const currency =
    params.currency === "USDC" ? "USDC" : params.currency === "SGCTL" ? "SGCTL" : "GLW";
  const fraction = params.application.activeFraction;
  if (!fraction) return previous;

  const alreadyPresent = previous.activity.some(
    (item) => item.transactionHash === params.txHash,
  );
  if (alreadyPresent) return previous;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const updatedApplication = updateApplicationAfterSuccessfulPurchase(
    params.application,
    params.quantity,
  );
  const fractionType: SplitActivity["fractionType"] =
    params.application.paymentCurrency === "USDC"
      ? "mining-center"
      : "launchpad";

  const optimisticEntry: SplitActivity = {
    transactionHash: params.txHash,
    blockNumber: 0,
    buyer: params.walletAddress,
    creator: fraction.owner,
    stepsPurchased: params.quantity,
    amount: params.amount.toString(),
    step: fraction.step,
    timestamp: nowSeconds,
    purchaseDate: new Date(nowSeconds * 1000).toISOString(),
    fractionId: fraction.id,
    applicationId: params.application.id,
    farmId: params.application.farmId ?? null,
    farmName: params.application.farmName ?? "",
    fractionType,
    fractionStatus: fraction.status,
    currency,
    currencyDecimals: DECIMALS_BY_TOKEN[currency],
    isFilled: updatedApplication.activeFraction?.isFilled ?? false,
    progressPercent: updatedApplication.activeFraction?.progressPercent ?? 0,
    rewardScore: updatedApplication.activeFraction?.rewardScore ?? null,
    stepPrice: fraction.stepPrice,
    totalValue: params.amount.toString(),
  };

  return {
    ...previous,
    activity: [optimisticEntry, ...previous.activity],
    summary: {
      ...previous.summary,
      totalTransactions: previous.summary.totalTransactions + 1,
      totalStepsPurchased:
        previous.summary.totalStepsPurchased + Math.max(0, params.quantity),
      totalAmountSpent: previous.summary.totalAmountSpent,
    },
  };
}

function replaceApplicationInSponsorListings(
  old: unknown,
  application: AuctionApplication,
) {
  if (!Array.isArray(old)) return old;
  return old.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      (item as AuctionApplication).id !== application.id
    ) {
      return item;
    }
    return application;
  });
}

async function fetchFreshSplitsActivityResponse(params: {
  walletAddress: string;
  limit: number;
  fractionType?: "launchpad" | "mining-center";
}): Promise<SplitsActivityResponse> {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit));
  search.set("walletAddress", params.walletAddress);
  if (params.fractionType) {
    search.set("fractionType", params.fractionType);
  }

  const endpoint = params.fractionType
    ? "/api/fractions/splits-activity-by-type"
    : "/api/fractions/splits-activity";
  const response = await fetch(`${endpoint}?${search.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch fresh splits activity: ${response.status}`,
    );
  }

  return (await response.json()) as SplitsActivityResponse;
}

async function fetchFreshWalletFarmsResponse(
  walletAddress: string,
): Promise<FarmWithRewards[]> {
  const baseUrl = process.env.NEXT_PUBLIC_CONTROL_API_URL;
  if (!baseUrl) {
    throw new Error("Environment variable NEXT_PUBLIC_CONTROL_API_URL is not set");
  }

  const response = await fetch(
    `${baseUrl}/farms/wallet/${encodeURIComponent(
      walletAddress,
    )}/farms-with-rewards?_=${Date.now()}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch fresh wallet farms: ${response.status}`);
  }

  const body = (await response.json()) as
    | { farms?: FarmWithRewards[] }
    | FarmWithRewards[];

  return Array.isArray(body) ? body : body.farms ?? [];
}

async function fetchFreshRewardsBreakdownResponse(params: {
  walletAddress?: string | null;
  farmId?: string | null;
  startWeek?: number;
  endWeek?: number;
}): Promise<RewardsBreakdownResponse | null> {
  if (!params.walletAddress && !params.farmId) {
    return null;
  }

  return await hubGet<RewardsBreakdownResponse | null>(
    "/fractions/rewards-breakdown",
    {
      params: {
        walletAddress: params.walletAddress ?? undefined,
        farmId: params.farmId ?? undefined,
        startWeek: params.startWeek,
        endWeek: params.endWeek,
      },
      notFound: null,
      init: {
        cache: "no-store",
      },
    },
  );
}

function isInsufficientAvailableStakedError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.includes("Insufficient available staked GCTL in region");
}

type DepositDialogProps =
  | {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      application: AuctionApplication | null;
      selectedCurrency: "GLW";
      rewardScore?: LaunchpadRewardScore | null;
      onSuccess?: () => void;
    }
  | {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      application: AuctionApplication | null;
      selectedCurrency: "USDC";
      rewardScore?: MiningCenterScore | null;
      onSuccess?: () => void;
    };

type Phase =
  | "review"
  | "processing"
  | "success"
  | "error"
  | "pending_confirmation";

export function DepositDialog({
  open,
  onOpenChange,
  application,
  selectedCurrency,
  rewardScore,
  onSuccess,
}: DepositDialogProps) {
  const APP_DOMAIN_PLAIN_TEXT = "app.\u200Bglow.\u200Borg";

  const { t } = useLang();
  const dd = t.routes.depositDialog;
  const { isConnected, address, connector } = useAccount();
  const isMobile = useIsMobile();
  const chainId = useChainId();
  const { signer, isLoading: isSignerLoading } = useEthersSigner();
  const { data: walletClient, isLoading: isWalletClientLoading } =
    useWalletClient();
  const queryClient = useQueryClient();
  const { spotPriceUsd: glwSpotPrice } = useGlowSpotPriceSummary();
  const { ethPrice: ethSpotPrice } = useEthPrice();
  const {
    usdcBalance,
    glwBalance,
    ethBalance,
    refetch: refetchBalances,
  } = useWalletTokenBalances(address);
  const { swapEthToUsdc, estimateEthToUsdc } = useSwapETHToUSDC();
  const { swapUSDCToUSDG } = useSwapUSDCToUSDG();
  const { swap: swapUsdgToGlow } = useSwap({
    tokenA_address: addresses.usdg,
    tokenB_address: addresses.glow,
  });
  const [liveApplication, setLiveApplication] =
    React.useState<AuctionApplication | null>(null);
  const effectiveApplication = liveApplication ?? application;
  const runtimeSelectedCurrency = React.useMemo(
    () =>
      resolveRuntimeSelectedCurrency(
        selectedCurrency,
        effectiveApplication?.activeFraction ?? null,
      ),
    [effectiveApplication?.activeFraction, selectedCurrency],
  );

  const { authenticated: isPrivyAuthenticated } = usePrivy();
  const pendingCardFundRef = React.useRef<{
    address: `0x${string}`;
    amount: string;
  } | null>(null);
  const { fundWallet: privyFundWallet } = useFundWallet();
  const triggerCardFund = React.useCallback(
    (target: { address: `0x${string}`; amount: string }) => {
      void privyFundWallet({
        address: target.address,
        options: {
          asset: "USDC",
          amount: target.amount,
          chain: mainnet,
          defaultFundingMethod: "card",
          card: { preferredProvider: "moonpay" },
        },
      });
    },
    [privyFundWallet],
  );
  const { login: privyLogin } = useLogin({
    onComplete: () => {
      const pending = pendingCardFundRef.current;
      pendingCardFundRef.current = null;
      if (pending) triggerCardFund(pending);
    },
    onError: (error) => {
      pendingCardFundRef.current = null;
      capturePrivyWalletError(error, "card_buy_login");
    },
  });
  const handleBuyWithCard = React.useCallback(
    (usdcAmount: string) => {
      if (!address) {
        toast.error(t.wallet.connectWalletFirst);
        return;
      }
      if (chainId === sepolia.id) {
        toast.info(t.wallet.cardPurchasesMainnetOnly);
        return;
      }
      trackEvent("deposit_card_click", {
        usdc_amount: usdcAmount,
        runtime_currency: runtimeSelectedCurrency,
        privy_authenticated: isPrivyAuthenticated,
      });
      const target = {
        address: address as `0x${string}`,
        amount: usdcAmount,
      };
      if (!isPrivyAuthenticated) {
        pendingCardFundRef.current = target;
        privyLogin();
        return;
      }
      triggerCardFund(target);
    },
    [
      address,
      chainId,
      t,
      runtimeSelectedCurrency,
      isPrivyAuthenticated,
      privyLogin,
      triggerCardFund,
    ],
  );

  const regionId = effectiveApplication?.zone?.id ?? null;
  const controlChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
  const delegationStepAtomic = React.useMemo(
    () =>
      resolveDelegationStepAtomic({
        activeFraction: effectiveApplication?.activeFraction ?? null,
        applicationPriceQuotes: effectiveApplication?.applicationPriceQuotes,
        selectedCurrency: runtimeSelectedCurrency,
      }),
    [
      effectiveApplication?.activeFraction,
      effectiveApplication?.applicationPriceQuotes,
      runtimeSelectedCurrency,
    ],
  );

  const { refetchWalletDetails } = useWallets({
    walletAddress: address ?? undefined,
    enabled: open && runtimeSelectedCurrency === "SGCTL" && Boolean(address),
    includeMintedEvents: false,
    includeStakeEvents: false,
    includeMigrationAmount: false,
  });
  const { data: walletRewardsBreakdown, isLoading: isWalletRewardsBreakdownLoading } =
    useRewardsBreakdown({
      walletAddress: address ?? null,
      enabled: open && Boolean(address),
    });
  const { availableStake, refetchAvailableStake } =
    useWalletRegionAvailableStake({
      walletAddress: address ?? undefined,
      regionId,
      enabled: open && runtimeSelectedCurrency === "SGCTL" && Boolean(address),
    });
  const {
    gctlPriceNumber,
    gctlBalance,
    stakeExistingGctlToRegion,
    mintAndStakeGctlToRegion,
    invalidateAllQueries: invalidateGctlQueries,
  } = useGctlPreparationOrchestrator({
    enabled: open && runtimeSelectedCurrency === "SGCTL",
  });
  const gctlWalletBalance = React.useMemo(
    () => coerceToBigInt(gctlBalance),
    [gctlBalance],
  );

  const stakedGctlBalance = React.useMemo(() => {
    if (runtimeSelectedCurrency !== "SGCTL") return 0n;
    return parseAvailableStakeSnapshot(availableStake).availableStakedGctl;
  }, [availableStake, runtimeSelectedCurrency]);

  // State
  const [quantity, setQuantity] = React.useState<number>(1);
  const [quantityInput, setQuantityInput] = React.useState("1");
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    React.useState<DepositPaymentMethod>(
      getDefaultPaymentMethodForRuntimeCurrency(runtimeSelectedCurrency),
    );
  const [isSmartAccountWarningOpen, setIsSmartAccountWarningOpen] =
    React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const submitInFlightRef = React.useRef(false);
  const [phase, setPhase] = React.useState<Phase>("review");
  const [transactionSteps, setTransactionSteps] = React.useState<
    TransactionStep[]
  >([]);
  const stepsRef = React.useRef<TransactionStep[]>([]);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isInsufficientSharesError, setIsInsufficientSharesError] =
    React.useState(false);
  const [successMetrics, setSuccessMetrics] =
    React.useState<SuccessMetrics | null>(null);
  const postSuccessRefreshTimeoutsRef = React.useRef<number[]>([]);

  // V2 points: snapshot the wallet's balance before the purchase so the
  // success screen can show the points this action granted. The award is
  // credited asynchronously once the on-chain delegation is processed, so
  // the delta may still be 0 at the moment the success screen renders;
  // invalidating the balance query lets it update live.
  const { data: v2PointsBalance } = useV2PointsBalance(address);
  const pointsBeforeRef = React.useRef<number | null>(null);
  const [launchpadNowMs, setLaunchpadNowMs] = React.useState(() =>
    getLaunchpadNowMs(),
  );

  React.useEffect(() => {
    if (!open || runtimeSelectedCurrency !== "SGCTL") return;

    setLaunchpadNowMs(getLaunchpadNowMs());
    const intervalId = window.setInterval(() => {
      setLaunchpadNowMs(getLaunchpadNowMs());
    }, 5_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [open, runtimeSelectedCurrency]);

  const fetchLatestApplication = React.useCallback(async () => {
    if (!application?.id) return application;

    const filters =
      selectedCurrency === "USDC"
        ? ({ includeFilled: true, type: "mining-center" } as const)
        : ({ includeFilled: true } as const);

    const listings = await queryClient.fetchQuery({
      queryKey: QUERY_KEYS.listings.sponsor(filters),
      staleTime: 0,
      queryFn: async () => await fetchSponsorListings(filters),
    });

    return listings.find((item) => item.id === application.id) ?? application;
  }, [application, queryClient, selectedCurrency]);

  const costInGLW = React.useCallback(
    (qty: number) =>
      calculateCostInGLW(
        qty,
        effectiveApplication?.activeFraction ?? null,
        delegationStepAtomic,
      ),
    [effectiveApplication?.activeFraction, delegationStepAtomic],
  );

  const costInGCTL = React.useCallback(
    (qty: number) =>
      calculateCostInGCTL(
        qty,
        effectiveApplication?.activeFraction ?? null,
        delegationStepAtomic,
      ),
    [effectiveApplication?.activeFraction, delegationStepAtomic],
  );

  const costInUSDC = React.useCallback(
    (qty: number) =>
      calculateCostInUSDC(
        qty,
        effectiveApplication?.activeFraction ?? null,
        runtimeSelectedCurrency,
        glwSpotPrice,
        gctlPriceNumber,
        delegationStepAtomic,
      ),
    [
      effectiveApplication?.activeFraction,
      delegationStepAtomic,
      gctlPriceNumber,
      glwSpotPrice,
      runtimeSelectedCurrency,
    ],
  );

  const costInETH = React.useCallback(
    (qty: number) =>
      calculateCostInETH(
        qty,
        effectiveApplication?.activeFraction ?? null,
        runtimeSelectedCurrency,
        glwSpotPrice,
        ethSpotPrice,
        gctlPriceNumber,
        delegationStepAtomic,
      ),
    [
      effectiveApplication?.activeFraction,
      delegationStepAtomic,
      ethSpotPrice,
      gctlPriceNumber,
      glwSpotPrice,
      runtimeSelectedCurrency,
    ],
  );

  // --- Pre-purchase preview: points/unit + estimated watts/unit ------------
  // Points are one-time per action: unitUsd * rate, where the rate depends on
  // the action (GLW delegation 4 / sGCTL delegation 16 / miner purchase 8 per
  // $1). Watts are an upper-bound estimate from the backend (delegator bucket).
  const { data: pointsRatesData } = useV2PointsRates();
  const estimateQuery = useEstimatedAllocation(
    effectiveApplication?.activeFraction?.id ?? null,
    quantity,
  );

  const previewUnitUsd = React.useMemo(() => costInUSDC(1), [costInUSDC]);

  const previewPointsPerUnit = React.useMemo(() => {
    // Prefer the server's quote-based points: it values the per-unit GLW at the
    // application's locked GVE quote price -- the exact basis the award uses --
    // so the preview equals what gets credited and does not drift with the GLW
    // pool price (or the post-purchase listing refetch). Only for the GLW
    // delegation path; sGCTL/miner keep the local rate*usd estimate until their
    // award paths are quote-based too.
    const serverPerUnit = estimateQuery.data?.estimatedPointsPerUnit;
    if (
      runtimeSelectedCurrency === "GLW" &&
      serverPerUnit != null &&
      Number.isFinite(serverPerUnit)
    ) {
      return serverPerUnit;
    }
    const r = pointsRatesData?.rates;
    if (!r) return null;
    const rate =
      runtimeSelectedCurrency === "GLW"
        ? r.glwDelegationPointsPerUsd
        : runtimeSelectedCurrency === "SGCTL"
          ? r.sgctlDelegationPointsPerUsd
          : r.minerPurchasePointsPerUsd;
    if (rate == null || !Number.isFinite(previewUnitUsd)) return null;
    return previewUnitUsd * rate;
  }, [
    pointsRatesData,
    runtimeSelectedCurrency,
    previewUnitUsd,
    estimateQuery.data,
  ]);

  const previewWattsPerUnit = estimateQuery.data?.estimatedWattsPerUnit ?? null;
  // Totals scale with the selected quantity (what the user actually earns).
  const previewPointsTotal =
    previewPointsPerUnit != null ? previewPointsPerUnit * quantity : null;
  const previewWattsTotal =
    previewWattsPerUnit != null ? previewWattsPerUnit * quantity : null;

  // Smart auto-selection of payment method on open/connect
  React.useEffect(() => {
    if (open && effectiveApplication) {
      if (runtimeSelectedCurrency === "GLW") {
        // Delegation: Prefer GLW if enough, else USDC, else ETH
        const costGLW = costInGLW(1);
        const glwBalNum = glwBalance
          ? parseFloat(formatUnits(glwBalance, 18))
          : 0;
        const usdcBalNum = usdcBalance
          ? parseFloat(formatUnits(usdcBalance, 6))
          : 0;

        if (glwBalNum >= costGLW) {
          setSelectedPaymentMethod("GLW");
        } else if (usdcBalNum > 0) {
          setSelectedPaymentMethod("USDC");
        } else {
          // Default fallback
          setSelectedPaymentMethod("GLW");
        }
      } else if (runtimeSelectedCurrency === "SGCTL") {
        const requiredGctl = delegationStepAtomic ?? 0n;
        const totalAvailableGctl = gctlWalletBalance + stakedGctlBalance;

        if (stakedGctlBalance >= requiredGctl) {
          setSelectedPaymentMethod("SGCTL");
        } else if (totalAvailableGctl >= requiredGctl) {
          setSelectedPaymentMethod("GCTL");
        } else if ((usdcBalance ?? 0n) > 0n) {
          setSelectedPaymentMethod("USDC");
        } else if ((ethBalance ?? 0n) > 0n) {
          setSelectedPaymentMethod("ETH");
        } else {
          setSelectedPaymentMethod("GCTL");
        }
      } else {
        // Miner: Prefer USDC, else ETH
        setSelectedPaymentMethod("USDC");
      }
    }
  }, [
    open,
    ethBalance,
    gctlWalletBalance,
    usdcBalance,
    glwBalance,
    runtimeSelectedCurrency,
    effectiveApplication,
    costInGLW,
    stakedGctlBalance,
    delegationStepAtomic,
  ]);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setLiveApplication(null);
      setQuantity(1);
      setQuantityInput("1");
      setSelectedPaymentMethod(
        getDefaultPaymentMethodForRuntimeCurrency(runtimeSelectedCurrency),
      );
      setIsSubmitting(false);
      setPhase("review");
      setTransactionSteps([]);
      stepsRef.current = [];
      setTxHash(null);
      setErrorMessage(null);
      setIsInsufficientSharesError(false);
      setSuccessMetrics(null);
      pointsBeforeRef.current = null;
    }
  }, [open, runtimeSelectedCurrency]);

  // Snapshot the V2 points balance once, before the purchase completes, so
  // the success screen can show the delta this action granted.
  React.useEffect(() => {
    if (
      open &&
      phase !== "success" &&
      v2PointsBalance &&
      pointsBeforeRef.current === null
    ) {
      pointsBeforeRef.current = v2PointsBalance.availablePoints;
    }
  }, [open, phase, v2PointsBalance]);

  React.useEffect(() => {
    if (!open || !application?.id) {
      setLiveApplication(null);
      return;
    }

    let cancelled = false;
    void fetchLatestApplication()
      .then((nextApplication) => {
        if (!cancelled) {
          setLiveApplication(nextApplication ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveApplication(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [application?.id, fetchLatestApplication, open]);

  // Icon Helpers
  const TOKEN_ICON_SRC_BY_SYMBOL = {
    ETH: "/images/tokens/eth.svg",
    USDC: "/images/tokens/usdc.svg",
  } as const;

  function TokenIcon(props: { symbol: "ETH" | "GLW" | "USDC" | "GCTL" }) {
    const { symbol } = props;

    if (symbol === "GLW") {
      return (
        <div className="h-6 w-6 rounded-full bg-muted border border-border flex items-center justify-center">
          <GlowSymbol className="h-4 w-4" />
        </div>
      );
    }

    if (symbol === "GCTL") {
      return (
        <div className="h-6 w-6 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-mono font-semibold">
          G
        </div>
      );
    }

    const iconSrc =
      symbol === "ETH" || symbol === "USDC"
        ? TOKEN_ICON_SRC_BY_SYMBOL[symbol]
        : null;

    if (iconSrc) {
      return (
        <img
          src={iconSrc}
          alt={`${symbol} token`}
          className="h-6 w-6 rounded-full"
          draggable={false}
        />
      );
    }
    return <Coins className="h-6 w-6" />;
  }
  const unclaimedGlw = useUnclaimedGlwForDelegation(
    runtimeSelectedCurrency === "GLW" ? address : undefined,
  );
  const rewardsKernelWrapper = useRewardsKernelWrapper();

  const affordability = React.useMemo(
    () =>
      calculateAffordability({
        activeFraction: application?.activeFraction ?? null,
        quantity,
        selectedCurrency: runtimeSelectedCurrency,
        selectedPaymentMethod,
        delegationStepAtomic,
        glwSpotPrice,
        gctlSpotPrice: gctlPriceNumber,
        ethSpotPrice,
        glwBalance: glwBalance ?? 0n,
        gctlBalance: gctlWalletBalance,
        stakedGctlBalance,
        usdcBalance: usdcBalance ?? 0n,
        ethBalance: ethBalance ?? 0n,
        unclaimedGlwBalance: unclaimedGlw.totalGlwWei,
      }),
    [
      application?.activeFraction,
      delegationStepAtomic,
      gctlWalletBalance,
      gctlPriceNumber,
      ethSpotPrice,
      glwBalance,
      quantity,
      runtimeSelectedCurrency,
      selectedPaymentMethod,
      stakedGctlBalance,
      glwSpotPrice,
      usdcBalance,
      ethBalance,
      unclaimedGlw.totalGlwWei,
    ],
  );

  const targetGlwForUnclaimed = React.useMemo<bigint>(() => {
    if (runtimeSelectedCurrency !== "GLW") return 0n;
    const required = affordability.requiredByMethod.UNCLAIMED_REWARDS;
    return required ?? 0n;
  }, [
    affordability.requiredByMethod.UNCLAIMED_REWARDS,
    runtimeSelectedCurrency,
  ]);

  const claimSetSelection = React.useMemo<ClaimSetSelection>(
    () => selectClaimSetForGlwDelegation(unclaimedGlw.items, targetGlwForUnclaimed),
    [unclaimedGlw.items, targetGlwForUnclaimed],
  );

  const showUnclaimedRewardsOption =
    runtimeSelectedCurrency === "GLW" && unclaimedGlw.totalGlwWei > 0n;

  const formatTokenAmount = React.useCallback(
    (
      amount: bigint | null,
      decimals: number,
      fallback: string,
      maxFractionDigitsOverride?: number,
    ) => {
      if (amount == null) return fallback;
      const maxFractionDigits =
        maxFractionDigitsOverride ?? (decimals === 18 ? 4 : 2);
      return parseFloat(formatUnits(amount, decimals)).toLocaleString(
        undefined,
        {
          minimumFractionDigits: 0,
          maximumFractionDigits: maxFractionDigits,
        },
      );
    },
    [],
  );

  const requiredDisplayByMethod = React.useMemo(
    () => ({
      GLW: `${formatTokenAmount(
        affordability.requiredByMethod.GLW,
        18,
        costInGLW(quantity).toLocaleString(),
      )} GLW`,
      SGCTL: `${formatTokenAmount(
        affordability.requiredByMethod.SGCTL,
        6,
        costInGCTL(quantity).toLocaleString(),
        6,
      )} SGCTL`,
      GCTL: `${formatTokenAmount(
        affordability.requiredByMethod.GCTL,
        6,
        costInGCTL(quantity).toLocaleString(),
        6,
      )} GCTL`,
      USDC: `${formatTokenAmount(
        affordability.requiredByMethod.USDC,
        6,
        costInUSDC(quantity).toLocaleString(),
      )} USDC`,
      ETH: `${formatTokenAmount(
        affordability.requiredByMethod.ETH,
        18,
        costInETH(quantity).toFixed(4),
      )} ETH`,
      UNCLAIMED_REWARDS: `${formatTokenAmount(
        affordability.requiredByMethod.UNCLAIMED_REWARDS,
        18,
        costInGLW(quantity).toLocaleString(),
      )} GLW`,
    }),
    [
      affordability.requiredByMethod,
      costInETH,
      costInGCTL,
      costInGLW,
      costInUSDC,
      formatTokenAmount,
      quantity,
    ],
  );
  const delegatedAmountLabel = React.useMemo(() => {
    if (runtimeSelectedCurrency === "SGCTL") {
      return `${formatTokenAmount(
        affordability.requiredByMethod.SGCTL,
        6,
        costInGCTL(quantity).toLocaleString(),
        6,
      )} SGCTL`;
    }

    if (runtimeSelectedCurrency === "GLW") {
      return `${formatTokenAmount(
        affordability.requiredByMethod.GLW,
        18,
        costInGLW(quantity).toLocaleString(),
      )} GLW`;
    }

    return `$${formatTokenAmount(
      affordability.requiredByMethod.USDC,
      6,
      costInUSDC(quantity).toLocaleString(),
    )}`;
  }, [
    affordability.requiredByMethod,
    costInGCTL,
    costInGLW,
    costInUSDC,
    formatTokenAmount,
    quantity,
    runtimeSelectedCurrency,
  ]);

  const shortfallByMethod = React.useMemo(() => {
    return {
      GLW: calculateShortfall(affordability.requiredByMethod.GLW, glwBalance),
      SGCTL: calculateShortfall(
        affordability.requiredByMethod.SGCTL,
        stakedGctlBalance,
      ),
      GCTL: calculateShortfall(
        affordability.requiredByMethod.GCTL,
        affordability.balances.GCTL,
      ),
      USDC: calculateShortfall(
        affordability.requiredByMethod.USDC,
        usdcBalance,
      ),
      ETH: calculateShortfall(affordability.requiredByMethod.ETH, ethBalance),
      UNCLAIMED_REWARDS: calculateShortfall(
        affordability.requiredByMethod.UNCLAIMED_REWARDS,
        unclaimedGlw.totalGlwWei,
      ),
    } as const;
  }, [
    affordability.balances.GCTL,
    affordability.requiredByMethod,
    ethBalance,
    glwBalance,
    stakedGctlBalance,
    unclaimedGlw.totalGlwWei,
    usdcBalance,
  ]);

  const selectedShortfall = shortfallByMethod[selectedPaymentMethod];
  const hasExistingMinerOrDelegation = React.useMemo(() => {
    const farmStats = walletRewardsBreakdown?.farmStatistics;
    const rewardedFarmCount = farmStats
      ? Math.max(
          0,
          (farmStats.totalFarms ?? 0) +
            (walletRewardsBreakdown?.otherFarmsWithRewards?.count ?? 0),
        )
      : 0;
    const recentPurchasesCount =
      walletRewardsBreakdown?.recentPurchasesWithoutRewards?.length ?? 0;

    return rewardedFarmCount > 0 || recentPurchasesCount > 0;
  }, [walletRewardsBreakdown]);
  const estimatedPurchaseValueUsd = costInUSDC(quantity);
  const needsInitialPositionEligibilityCheck =
    isConnected &&
    estimatedPurchaseValueUsd < MIN_INITIAL_POSITION_USD;
  const isCheckingInitialPositionEligibility =
    needsInitialPositionEligibilityCheck &&
    isWalletRewardsBreakdownLoading;
  const initialPositionValueGuard = React.useMemo(
    () =>
      getInitialPositionValueGuard({
        purchaseValueUsd: estimatedPurchaseValueUsd,
        hasExistingPositions: hasExistingMinerOrDelegation,
      }),
    [estimatedPurchaseValueUsd, hasExistingMinerOrDelegation],
  );
  const shortfallDecimals =
    selectedPaymentMethod === "ETH" ||
    selectedPaymentMethod === "GLW" ||
    selectedPaymentMethod === "UNCLAIMED_REWARDS"
      ? 18
      : 6;
  const showShortfallInCta =
    isConnected &&
    !isSubmitting &&
    !initialPositionValueGuard.isBlocked &&
    !affordability.canSubmit &&
    selectedShortfall > 0n;
  // Unclaimed rewards are GLW-denominated, so the shortfall reads as GLW
  // rather than the raw "UNCLAIMED_REWARDS" payment-method key.
  const shortfallSymbol =
    selectedPaymentMethod === "UNCLAIMED_REWARDS"
      ? "GLW"
      : selectedPaymentMethod;
  const disabledCtaLabel =
    runtimeSelectedCurrency === "GLW" && selectedPaymentMethod === "USDC"
      ? dd.shortfallNeedSwapBuffer(
          formatTokenAmount(selectedShortfall, shortfallDecimals, "0", 6),
          shortfallSymbol,
        )
      : dd.shortfallNeed(
          formatTokenAmount(selectedShortfall, shortfallDecimals, "0", 6),
          shortfallSymbol,
        );
  const initialPositionMinimumMessage =
    initialPositionValueGuard.message ??
    dd.initialPositionMinimumFallback(
      MIN_INITIAL_POSITION_USD.toLocaleString(),
    );

  const sgctlRequiredAmount = affordability.requiredByMethod.SGCTL ?? 0n;
  const sgctlShortfall =
    sgctlRequiredAmount > stakedGctlBalance
      ? sgctlRequiredAmount - stakedGctlBalance
      : 0n;
  const sgctlExistingStakeUsed = React.useMemo(() => {
    if (runtimeSelectedCurrency !== "SGCTL") return 0n;
    return stakedGctlBalance < sgctlRequiredAmount
      ? stakedGctlBalance
      : sgctlRequiredAmount;
  }, [runtimeSelectedCurrency, sgctlRequiredAmount, stakedGctlBalance]);
  const sgctlFundingBreakdown = React.useMemo(() => {
    if (
      runtimeSelectedCurrency !== "SGCTL" ||
      sgctlExistingStakeUsed <= 0n ||
      sgctlShortfall <= 0n
    ) {
      return null;
    }

    const existingStakeLabel = formatTokenAmount(
      sgctlExistingStakeUsed,
      6,
      "0",
      6,
    );
    const shortfallLabel = formatTokenAmount(sgctlShortfall, 6, "0", 6);

    if (selectedPaymentMethod === "USDC") {
      return dd.sgctlFundingFromUsdc(existingStakeLabel, shortfallLabel);
    }

    if (selectedPaymentMethod === "ETH") {
      return dd.sgctlFundingFromEth(existingStakeLabel, shortfallLabel);
    }

    if (selectedPaymentMethod === "GCTL") {
      return dd.sgctlFundingFromGctl(existingStakeLabel, shortfallLabel);
    }

    return null;
  }, [
    dd,
    formatTokenAmount,
    runtimeSelectedCurrency,
    selectedPaymentMethod,
    sgctlExistingStakeUsed,
    sgctlShortfall,
  ]);
  const showStakedSgctlOption =
    runtimeSelectedCurrency === "SGCTL" &&
    sgctlRequiredAmount > 0n &&
    stakedGctlBalance >= sgctlRequiredAmount;
  const sgctlSourceMode = React.useMemo<SgctlSourceMode | null>(() => {
    if (runtimeSelectedCurrency !== "SGCTL") return null;
    if (selectedPaymentMethod === "SGCTL") return "staked";
    if (sgctlShortfall <= 0n) return "staked";
    if (selectedPaymentMethod === "GCTL") return "wallet_gctl";
    if (selectedPaymentMethod === "ETH") return "mint_eth";
    return "mint_usdc";
  }, [runtimeSelectedCurrency, selectedPaymentMethod, sgctlShortfall]);
  const isPreparingWalletAuthorization = React.useMemo(() => {
    if (!isConnected) return false;

    if (runtimeSelectedCurrency !== "SGCTL") {
      return isWalletClientLoading || !walletClient;
    }

    if (sgctlSourceMode === "staked") {
      return (
        isSignerLoading || isWalletClientLoading || (!signer && !walletClient)
      );
    }

    return isSignerLoading || !signer;
  }, [
    isConnected,
    isSignerLoading,
    isWalletClientLoading,
    runtimeSelectedCurrency,
    sgctlSourceMode,
    signer,
    walletClient,
  ]);
  const sgctlPreparationCutoffGuard = React.useMemo(
    () =>
      getSgctlPreparationCutoffGuard({
        selectedCurrency: runtimeSelectedCurrency,
        sgctlSource: sgctlSourceMode,
        fractionCreatedAt: effectiveApplication?.activeFraction?.createdAt,
        nowMs: launchpadNowMs,
      }),
    [
      effectiveApplication?.activeFraction?.createdAt,
      launchpadNowMs,
      runtimeSelectedCurrency,
      sgctlSourceMode,
    ],
  );

  React.useEffect(() => {
    if (runtimeSelectedCurrency !== "SGCTL") return;
    if (sgctlPreparationCutoffGuard.isBlocked) {
      if (showStakedSgctlOption && selectedPaymentMethod !== "SGCTL") {
        setSelectedPaymentMethod("SGCTL");
      }
      return;
    }
    if (showStakedSgctlOption && selectedPaymentMethod === "GCTL") {
      setSelectedPaymentMethod("SGCTL");
    }
    if (!showStakedSgctlOption && selectedPaymentMethod === "SGCTL") {
      setSelectedPaymentMethod("GCTL");
    }
  }, [
    runtimeSelectedCurrency,
    selectedPaymentMethod,
    sgctlPreparationCutoffGuard.isBlocked,
    showStakedSgctlOption,
  ]);

  React.useEffect(() => {
    if (
      runtimeSelectedCurrency !== "SGCTL" ||
      !sgctlPreparationCutoffGuard.isBlocked ||
      !showStakedSgctlOption ||
      selectedPaymentMethod === "SGCTL"
    ) {
      return;
    }

    setSelectedPaymentMethod("SGCTL");
  }, [
    runtimeSelectedCurrency,
    selectedPaymentMethod,
    sgctlPreparationCutoffGuard.isBlocked,
    showStakedSgctlOption,
  ]);

  const ctaLabel = !isSubmitting && isPreparingWalletAuthorization
    ? dd.ctaPreparingWallet
    : isCheckingInitialPositionEligibility
      ? dd.ctaCheckingEligibility
      : sgctlPreparationCutoffGuard.isBlocked
        ? dd.ctaStakedSgctlOnly
      : initialPositionValueGuard.isBlocked
        ? dd.ctaMinimumToStart(
            initialPositionValueGuard.minimumUsd.toLocaleString(),
          )
        : showShortfallInCta
          ? disabledCtaLabel
          : runtimeSelectedCurrency === "SGCTL"
            ? sgctlSourceMode === "staked"
              ? dd.ctaConfirmDelegation
              : sgctlSourceMode === "wallet_gctl"
                ? dd.ctaStakeAndDelegate
                : dd.ctaMintStakeDelegate
            : runtimeSelectedCurrency === "GLW"
              ? selectedPaymentMethod !== "GLW"
                ? dd.ctaSwapAndDelegate
                : dd.ctaConfirmDelegation
              : dd.ctaConfirmPurchase;

  const launchpadTotalShares = React.useMemo(
    () =>
      effectiveApplication
        ? resolveLaunchpadDelegationUnitCount(effectiveApplication)
        : 0,
    [effectiveApplication],
  );
  const estimatedRewardsBreakdown = React.useMemo(
    () =>
      calculateEstimatedRewardsBreakdown(
        quantity,
        effectiveApplication?.activeFraction ?? null,
        rewardScore ?? null,
        runtimeSelectedCurrency,
        launchpadTotalShares,
      ),
    [
      effectiveApplication?.activeFraction,
      launchpadTotalShares,
      quantity,
      rewardScore,
      runtimeSelectedCurrency,
    ],
  );
  const estimatedRewards = estimatedRewardsBreakdown.totalGlwEquivalent;
  const isMultiAssetEstimatedRewards =
    estimatedRewardsBreakdown.pdSymbol === "SGCTL" &&
    estimatedRewardsBreakdown.pd > 0;
  const hasAnyEstimatedRewards =
    estimatedRewardsBreakdown.glw > 0 || estimatedRewardsBreakdown.pd > 0;

  // V2 points granted by this purchase: the balance delta since the
  // pre-purchase snapshot. Often still 0 when the success screen first
  // renders (the award is credited asynchronously on-chain).
  const v2PointsGranted =
    pointsBeforeRef.current != null && v2PointsBalance
      ? Math.max(0, v2PointsBalance.availablePoints - pointsBeforeRef.current)
      : 0;
  const estimatedRewardsUsdValue =
    estimatedRewardsBreakdown.glw * (glwSpotPrice || 0) +
    estimatedRewardsBreakdown.pd *
      (estimatedRewardsBreakdown.pdSymbol === "SGCTL"
        ? gctlPriceNumber || 0
        : glwSpotPrice || 0);

  const rewardsWeeksLabel = React.useMemo(() => {
    if (runtimeSelectedCurrency === "USDC") {
      const normalized = normalizeMinerWeeksRemainingDisplay(
        (rewardScore as MiningCenterScore | null | undefined)
          ?.weeksOfMinerLifeRemaining,
      );
      if (typeof normalized === "number" && normalized > 0) {
        return dd.weeklyForWeeks(String(Math.floor(normalized)));
      }
      return dd.weeklyFor99Weeks;
    }
    return dd.weeklyFor100Weeks;
  }, [dd, runtimeSelectedCurrency, rewardScore]);

  const maxQuantity = resolveFractionRemainingSteps(
    effectiveApplication?.activeFraction,
  );

  // Handlers
  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const nextQuantity = clampQuantity(prev + delta, 1, maxQuantity);
      setQuantityInput(nextQuantity.toString());
      return nextQuantity;
    });
  };

  const handleQuantityInput = (value: string) => {
    if (value === "") {
      setQuantityInput("");
      return;
    }

    if (!/^\d+$/.test(value)) {
      return;
    }

    const nextQuantity = parseQuantityInput(value, quantity, maxQuantity);
    setQuantity(nextQuantity);
    setQuantityInput(value);
  };

  const handleQuantityBlur = React.useCallback(() => {
    const val = parseInt(quantityInput, 10);
    if (isNaN(val) || val < 1) {
      setQuantity(1);
      setQuantityInput("1");
      return;
    }

    const nextQuantity = clampQuantity(val, 1, maxQuantity);
    setQuantity(nextQuantity);
    setQuantityInput(nextQuantity.toString());
  }, [maxQuantity, quantityInput]);

  React.useEffect(() => {
    if (quantityInput === "") return;
    const normalizedQuantity = clampQuantity(quantity, 1, maxQuantity);
    const normalizedInput = normalizedQuantity.toString();
    if (quantityInput !== normalizedInput) {
      setQuantityInput(normalizedInput);
    }
  }, [maxQuantity, quantity, quantityInput]);

  const handleSmartAccountCheck = async () => {
    if (!requiresSmartAccountCheck(runtimeSelectedCurrency)) {
      return true;
    }
    if (!signer || !walletClient || !address) return true;
    try {
      const status = await getSmartAccountStatus({
        address: address as `0x${string}`,
        chainId,
        walletClient,
        getBytecode: publicClient?.getBytecode,
      });
      if (
        status &&
        (status.isContractWallet ||
          status.isEip7702Delegated ||
          status.hasWalletAABatching)
      ) {
        setIsSmartAccountWarningOpen(true);
        return false;
      }
    } catch {
      // ignore error
    }
    return true;
  };

  const fractionsHook = usePatchedOffchainFractions(
    walletClient,
    publicClient,
    chainId,
  ); // Chain ID handled inside hook or env
  const sponsorMutation = useSponsorApplication();

  // Polling for splits to confirm purchase
  const { refetch: refetchSplits, summary: splitsSummary } = useFractionSplits({
    walletAddress: address || null,
    fractionId: application?.activeFraction?.id || null,
    enabled: false, // We manually refetch
  });

  const updateStepStatus = (
    stepId: string,
    status: StepStatus,
    extras?: {
      txHash?: string;
      errorMessage?: string;
      deactivateStepIds?: string[];
      clearStartedAt?: boolean;
    },
  ) => {
    setTransactionSteps((prev) => {
      const updated = updateTransactionStepStatus(prev, stepId, status, extras);
      stepsRef.current = updated;
      return updated;
    });
  };

  const confirmPurchaseInSplits = React.useCallback(
    async (expectedAdditionalSteps: number) => {
      const initialPurchased = splitsSummary?.totalStepsPurchased || 0;
      let confirmed = false;

      for (let i = 0; i < 30; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const res = await refetchSplits();
        if (
          res.data &&
          hasConfirmedSplitPurchase(
            initialPurchased,
            res.data.summary.totalStepsPurchased,
            expectedAdditionalSteps,
          )
        ) {
          confirmed = true;
          break;
        }
      }

      if (!confirmed) {
        throw new Error(SPLIT_CONFIRMATION_DELAYED_MESSAGE);
      }
    },
    [refetchSplits, splitsSummary?.totalStepsPurchased],
  );

  const fetchFreshAvailableStake = React.useCallback(async () => {
    if (!address || !regionId) return null;
    const payload = await fetchWalletRegionAvailableStake(address, regionId);
    return parseAvailableStakeSnapshot(payload);
  }, [address, regionId]);

  const waitForStakeSyncBeforeDelegation = React.useCallback(
    async (requiredAmount: bigint) => {
      if (
        runtimeSelectedCurrency !== "SGCTL" ||
        !address ||
        !regionId ||
        requiredAmount <= 0n
      ) {
        return;
      }

      // The first 30s are usually spent waiting on block confirmation, so
      // front-loading 1s polling just burns requests. Use a staged schedule:
      // 0-30s: every 10s, 30-60s: every 5s, 60-90s: every 2s.
      const pollDelaysMs = [
        ...Array(3).fill(10_000),
        ...Array(6).fill(5_000),
        ...Array(15).fill(2_000),
      ];
      let hasFreshStakeRead = false;
      let lastRetriableError: unknown = null;
      let lastAvailableStake = 0n;

      await invalidateGctlQueries();
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.wallets.details(address),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.wallets.availableStake(address, regionId),
      });

      for (let attempt = 0; attempt <= pollDelaysMs.length; attempt += 1) {
        const [freshRegionStakeResult] = await Promise.allSettled([
          fetchFreshAvailableStake(),
          refetchAvailableStake().catch(() => null),
          refetchWalletDetails().catch(() => null),
        ]);

        if (freshRegionStakeResult.status === "fulfilled") {
          const freshRegionStake = freshRegionStakeResult.value;
          hasFreshStakeRead = true;
          lastAvailableStake = freshRegionStake?.availableStakedGctl ?? 0n;

          if (lastAvailableStake >= requiredAmount) {
            return;
          }
        } else if (
          isRetriableStakeSyncRefreshError(freshRegionStakeResult.reason)
        ) {
          lastRetriableError = freshRegionStakeResult.reason;
        } else {
          throw freshRegionStakeResult.reason;
        }

        if (attempt < pollDelaysMs.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, pollDelaysMs[attempt]),
          );
        }
      }

      if (!hasFreshStakeRead && lastRetriableError) {
        throw new Error(dd.stakeSyncUnableToVerify);
      }

      throw new Error(dd.stakeSyncBalanceUpdating);
    },
    [
      address,
      dd,
      fetchFreshAvailableStake,
      invalidateGctlQueries,
      queryClient,
      refetchAvailableStake,
      refetchWalletDetails,
      regionId,
      runtimeSelectedCurrency,
    ],
  );

  const delegateSgctlWithRetry = React.useCallback(
    async (params: {
      applicationId: string;
      fractionId: string;
      amount: bigint;
      signature: string;
      deadline: string;
      nonce: string;
      sourceMode: SgctlSourceMode | null;
    }) => {
      const maxAttempts = params.sourceMode === "staked" ? 1 : 3;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          return await getControlRouter().delegateSgctl({
            wallet: address as string,
            applicationId: params.applicationId,
            fractionId: params.fractionId,
            amount: params.amount.toString(),
            signature: params.signature,
            deadline: params.deadline,
            nonce: params.nonce,
          });
        } catch (error) {
          const shouldRetry =
            attempt < maxAttempts - 1 &&
            isInsufficientAvailableStakedError(error) &&
            params.sourceMode !== "staked";

          if (!shouldRetry) {
            throw error;
          }

          updateStepStatus("INDEX_STAKE", "confirming", {
            deactivateStepIds: ["DELEGATE_SGCTL"],
          });
          await waitForStakeSyncBeforeDelegation(params.amount);
          updateStepStatus("INDEX_STAKE", "completed");
          updateStepStatus("DELEGATE_SGCTL", "confirming");
        }
      }

      throw new Error("Failed to delegate SGCTL after stake sync retries.");
    },
    [address, waitForStakeSyncBeforeDelegation],
  );

  const invalidatePostSuccessQueries = React.useCallback(
    async (fractionId: string) => {
      const normalizedAddress = address?.toLowerCase() ?? null;

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["sponsor-listings"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["sponsor-listings-live-soon"],
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["reward-scores"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["mining-scores"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["splits-activity"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["rewards-breakdown"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["wallet-farms"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.fractions.splits(address, fractionId),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["wallet-rewards"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.impact.score(address),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.impact.glowWorth(address),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.impact.scoreBreakdown(address),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.impact.leaderboard(),
          refetchType: "none",
        }),
        // V2 points: refetch the balance + ledger so the success screen
        // reflects the points this purchase grants once they land.
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.v2.pointsBalance(address),
        }),
        // Prefix-invalidate so every ledger page refreshes; the 4-element
        // pointsLedger key ends in `null` and matches no limit-bearing query.
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.v2.pointsLedgerAll(address),
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.balances.tokens(chainId, address),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.fractions.splits(normalizedAddress, fractionId),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.wallets.farms(normalizedAddress ?? undefined),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.wallets.rewards(normalizedAddress ?? undefined),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.fractions.rewardsBreakdown({
            walletAddress: normalizedAddress,
          }),
          refetchType: "none",
        }),
      ]);

      if (runtimeSelectedCurrency === "SGCTL") {
        await invalidateGctlQueries();
      }
    },
    [
      address,
      chainId,
      invalidateGctlQueries,
      queryClient,
      runtimeSelectedCurrency,
    ],
  );

  const syncFreshPostSuccessCaches = React.useCallback(async () => {
    const normalizedAddress = address?.toLowerCase();
    if (!normalizedAddress) return;

    const sponsorQueryCache = queryClient.getQueryCache().findAll({
      queryKey: ["sponsor-listings"],
    });
    const sponsorResults = new Map<string, AuctionApplication[]>();

    for (const query of sponsorQueryCache) {
      const [, rawFilters] = query.queryKey as [string, Record<string, any>?];
      const filters = rawFilters ?? {};
      const cacheKey = JSON.stringify(filters);
      let fresh = sponsorResults.get(cacheKey);
      if (!fresh) {
        fresh = await fetchSponsorListings(filters);
        sponsorResults.set(cacheKey, fresh);
      }
      queryClient.setQueryData(query.queryKey, fresh);
    }

    const splitQueryCache = queryClient.getQueryCache().findAll({
      queryKey: ["splits-activity"],
    });
    const splitResults = new Map<string, SplitsActivityResponse>();

    for (const query of splitQueryCache) {
      const [, rawLimit, rawWalletAddress, rawFractionType] = query.queryKey as [
        string,
        number | undefined,
        string | undefined,
        "launchpad" | "mining-center" | undefined,
      ];

      const queryWallet = rawWalletAddress?.toLowerCase();
      if (queryWallet && queryWallet !== normalizedAddress) continue;

      const limit =
        typeof rawLimit === "number" && Number.isFinite(rawLimit)
          ? rawLimit
          : 50;
      const fractionType =
        rawFractionType === "launchpad" || rawFractionType === "mining-center"
          ? rawFractionType
          : undefined;
      const cacheKey = `${limit}:${fractionType ?? "all"}`;

      let fresh = splitResults.get(cacheKey);
      if (!fresh) {
        fresh = await fetchFreshSplitsActivityResponse({
          walletAddress: normalizedAddress,
          limit,
          fractionType,
        });
        splitResults.set(cacheKey, fresh);
      }
      queryClient.setQueryData(query.queryKey, fresh);
    }

    const walletFarmQueryCache = queryClient.getQueryCache().findAll({
      queryKey: ["wallet-farms"],
    });
    if (walletFarmQueryCache.length > 0) {
      const freshWalletFarms =
        await fetchFreshWalletFarmsResponse(normalizedAddress);

      for (const query of walletFarmQueryCache) {
        const [, rawWalletAddress] = query.queryKey as [
          string,
          string | undefined,
        ];
        const queryWallet = rawWalletAddress?.toLowerCase();
        if (queryWallet && queryWallet !== normalizedAddress) continue;
        queryClient.setQueryData(query.queryKey, freshWalletFarms);
      }
    }

    const rewardsBreakdownQueryCache = queryClient.getQueryCache().findAll({
      queryKey: ["rewards-breakdown"],
    });
    const rewardsBreakdownResults = new Map<string, RewardsBreakdownResponse | null>();

    for (const query of rewardsBreakdownQueryCache) {
      const [
        ,
        rawWalletAddress,
        rawFarmId,
        rawStartWeek,
        rawEndWeek,
      ] = query.queryKey as [
        string,
        string | null | undefined,
        string | null | undefined,
        number | undefined,
        number | undefined,
      ];

      const queryWallet = rawWalletAddress?.toLowerCase() ?? null;
      if (queryWallet && queryWallet !== normalizedAddress) continue;

      const cacheKey = JSON.stringify([
        queryWallet,
        rawFarmId ?? null,
        rawStartWeek ?? null,
        rawEndWeek ?? null,
      ]);

      let fresh = rewardsBreakdownResults.get(cacheKey);
      if (fresh === undefined) {
        fresh = await fetchFreshRewardsBreakdownResponse({
          walletAddress: rawWalletAddress ?? undefined,
          farmId: rawFarmId ?? undefined,
          startWeek: rawStartWeek,
          endWeek: rawEndWeek,
        });
        rewardsBreakdownResults.set(cacheKey, fresh);
      }

      queryClient.setQueryData(query.queryKey, fresh);
    }
  }, [address, queryClient]);

  const clearScheduledPostSuccessRefreshes = React.useCallback(() => {
    for (const timeoutId of postSuccessRefreshTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    postSuccessRefreshTimeoutsRef.current = [];
  }, []);

  const schedulePostSuccessRefreshes = React.useCallback(() => {
    clearScheduledPostSuccessRefreshes();

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          await syncFreshPostSuccessCaches();
        } catch {
          // Best effort only. Late projection passes should never surface
          // an additional error once the transaction is already successful.
        }
      })();
    }, 5_000);

    postSuccessRefreshTimeoutsRef.current.push(timeoutId);

    // The V2 points award lands asynchronously (BullMQ realtime), seconds after
    // the deposit tx commits, so a single post-success refresh would still show
    // "Pending". Re-poll the points balance + ledger a few times so the
    // credited number appears without a manual reload. (Timeouts are tracked in
    // the same ref, so they're cleared on close/unmount.)
    const lowered = address?.toLowerCase();
    if (lowered) {
      for (const delay of [3_000, 7_000, 12_000]) {
        const id = window.setTimeout(() => {
          void queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.v2.pointsBalance(lowered),
          });
          void queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.v2.pointsLedgerAll(lowered),
          });
        }, delay);
        postSuccessRefreshTimeoutsRef.current.push(id);
      }
    }
  }, [
    address,
    clearScheduledPostSuccessRefreshes,
    queryClient,
    syncFreshPostSuccessCaches,
  ]);

  React.useEffect(() => {
    if (open) return;
    clearScheduledPostSuccessRefreshes();
  }, [clearScheduledPostSuccessRefreshes, open]);

  React.useEffect(() => {
    return () => {
      clearScheduledPostSuccessRefreshes();
    };
  }, [clearScheduledPostSuccessRefreshes]);

  const applyOptimisticPostSuccessUpdates = React.useCallback(
    (params: {
      txHash: string;
      application: AuctionApplication;
      fallbackApplication?: AuctionApplication | null;
      quantity: number;
      amount: bigint;
      currency: DepositSelectedCurrency;
    }) => {
      const normalizedAddress = address?.toLowerCase();
      if (!normalizedAddress) return;

      queryClient.setQueriesData(
        { queryKey: ["sponsor-listings"], exact: false },
        (old: unknown) =>
          replaceApplicationInSponsorListings(old, params.application),
      );

      queryClient.setQueriesData(
        { queryKey: ["splits-activity"], exact: false },
        (old: unknown) =>
          prependSuccessfulSplitActivity(
            old as SplitsActivityResponse | undefined,
            {
              txHash: params.txHash,
              walletAddress: normalizedAddress,
              application:
                params.fallbackApplication ?? params.application,
              quantity: params.quantity,
              amount: params.amount,
              currency: params.currency,
            },
          ),
      );
    },
    [address, queryClient],
  );

  const handleConfirm = async () => {
    if (!isConnected || !effectiveApplication?.activeFraction) return;
    if (isCheckingInitialPositionEligibility) {
      toast.message(dd.toastCheckingEligibility);
      return;
    }
    if (initialPositionValueGuard.isBlocked) {
      toast.error(initialPositionMinimumMessage);
      return;
    }
    if (sgctlPreparationCutoffGuard.isBlocked) {
      toast.error(sgctlPreparationCutoffGuard.message);
      return;
    }
    if (isPreparingWalletAuthorization) {
      toast.message(
        runtimeSelectedCurrency === "SGCTL"
          ? dd.toastPreparingSigner
          : dd.toastPreparingConnection,
      );
      return;
    }

    if (submitInFlightRef.current || isSubmitting) return;
    submitInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      // Lock the CTA before any async preflight work so repeat clicks cannot queue
      // duplicate purchase flows while wallet checks and listing refreshes run.
      const isSafe = await handleSmartAccountCheck();
      if (!isSafe) return;

      const currentApplication =
        (await fetchLatestApplication()) ?? effectiveApplication;
      const activeFraction = currentApplication?.activeFraction;
      if (!currentApplication || !activeFraction) return;

      setLiveApplication(currentApplication);

      const availableSteps = resolveFractionRemainingSteps(activeFraction);
      if (availableSteps <= 0) {
        toast.error(dd.toastListingNoLongerAvailable);
        return;
      }
      if (quantity > availableSteps) {
        setQuantity(availableSteps);
        setQuantityInput(availableSteps.toString());
        toast.error(dd.toastStepsRemaining(String(availableSteps)));
        return;
      }

      const isUnclaimedRewardsPayment =
        selectedPaymentMethod === "UNCLAIMED_REWARDS";
      const isSwapDelegate =
        runtimeSelectedCurrency === "GLW" &&
        selectedPaymentMethod !== "GLW" &&
        !isUnclaimedRewardsPayment;
      const currentDelegationStepAtomic = resolveDelegationStepAtomic({
        activeFraction,
        applicationPriceQuotes: currentApplication.applicationPriceQuotes,
        selectedCurrency: runtimeSelectedCurrency,
      });
      const currentAffordability = calculateAffordability({
        activeFraction,
        delegationStepAtomic: currentDelegationStepAtomic,
        quantity,
        selectedCurrency: runtimeSelectedCurrency,
        selectedPaymentMethod,
        glwSpotPrice,
        gctlSpotPrice: gctlPriceNumber,
        ethSpotPrice,
        glwBalance: glwBalance ?? 0n,
        gctlBalance: gctlWalletBalance,
        stakedGctlBalance,
        usdcBalance: usdcBalance ?? 0n,
        ethBalance: ethBalance ?? 0n,
        unclaimedGlwBalance: unclaimedGlw.totalGlwWei,
      });
      const currentSgctlRequiredAmount =
        currentAffordability.requiredByMethod.SGCTL ?? 0n;
      const currentSgctlShortfall =
        currentSgctlRequiredAmount > stakedGctlBalance
          ? currentSgctlRequiredAmount - stakedGctlBalance
          : 0n;

      setPhase("processing");
      setErrorMessage(null);

      const userAddress = address as `0x${string}`;

      const steps = initializeTransactionSteps(
        runtimeSelectedCurrency,
        selectedPaymentMethod,
        {
          sgctlSource: sgctlSourceMode ?? undefined,
        },
      );
      stepsRef.current = steps;
      setTransactionSteps(steps);

      if (runtimeSelectedCurrency === "SGCTL") {
        if (!signer && !walletClient) {
          throw new Error("Wallet signer not available");
        }
        if (!Number.isFinite(controlChainId)) {
          throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
        }
        if (!regionId) {
          throw new Error("Region not available for this application");
        }

        if (sgctlSourceMode === "wallet_gctl") {
          await stakeExistingGctlToRegion({
            regionId,
            amountAtomic: currentSgctlShortfall,
            stepIds: {
              sign: "STAKE_GCTL",
              submit: "STAKE_GCTL",
            },
            updateStepStatus,
          });
          updateStepStatus("STAKE_GCTL", "completed");
        } else if (sgctlSourceMode === "mint_usdc") {
          const requiredUsdc = currentAffordability.requiredByMethod.USDC;
          if (requiredUsdc == null || requiredUsdc <= 0n) {
            throw new Error("Unable to determine the USDC amount required");
          }
          await mintAndStakeGctlToRegion({
            regionId,
            sourceCurrency: "USDC",
            amountAtomic: requiredUsdc,
            stepIds: {
              checkAllowance: "MINT_AND_STAKE_GCTL",
              approve: "MINT_AND_STAKE_GCTL",
              mintAndStake: "MINT_AND_STAKE_GCTL",
            },
            updateStepStatus,
          });
          updateStepStatus("MINT_AND_STAKE_GCTL", "completed");
        } else if (sgctlSourceMode === "mint_eth") {
          const requiredUsdc = currentAffordability.requiredByMethod.USDC;
          if (requiredUsdc == null || requiredUsdc <= 0n) {
            throw new Error("Unable to determine the USDC amount required");
          }
          updateStepStatus("SWAP_ETH_TO_USDC", "waiting_signature");
          const mintResult = await mintAndStakeGctlToRegion({
            regionId,
            sourceCurrency: "ETH",
            targetUsdcAmountAtomic: requiredUsdc,
            stepIds: {
              swapEthToUsdc: "SWAP_ETH_TO_USDC",
              checkAllowance: "MINT_AND_STAKE_GCTL",
              approve: "MINT_AND_STAKE_GCTL",
              mintAndStake: "MINT_AND_STAKE_GCTL",
            },
            updateStepStatus,
          });
          await refetchBalances();
          updateStepStatus("MINT_AND_STAKE_GCTL", "completed");
        }

        if (sgctlSourceMode !== "staked") {
          updateStepStatus("INDEX_STAKE", "confirming");
          await waitForStakeSyncBeforeDelegation(currentSgctlRequiredAmount);
          updateStepStatus("INDEX_STAKE", "completed");
        }

        updateStepStatus("DELEGATE_SGCTL", "waiting_signature");
        const latestNonce = await getControlRouter().fetchLastNonce(
          address as string,
        );
        const nonce = (Number(latestNonce) + 1).toString();
        // 24h window so the signed payload survives idle tabs / queued retries.
        // The nonce + per-wallet uniqueness guarantee prevents replay; deadline
        // length is purely a "submit by when" bound. Server caps at 7 days.
        const deadline = Math.floor(
          Date.now() / 1000 + 24 * 60 * 60,
        ).toString();
        const signatureMessage = buildDelegateSgctlMessage({
          nonce,
          amount: currentSgctlRequiredAmount.toString(),
          applicationId: currentApplication.id,
          fractionId: activeFraction.id,
          deadline,
        });

        const delegateTypes = delegateSgctlEIP712Types as unknown as Record<
          string,
          any[]
        >;
        const signature = signer
          ? await signer.signTypedData(
              stakeControlEIP712Domain(controlChainId),
              delegateTypes,
              signatureMessage,
            )
          : await walletClient!.signTypedData({
              account: userAddress,
              domain: stakeControlEIP712Domain(controlChainId),
              types: delegateTypes as any,
              primaryType: "DelegateSgctl",
              message: signatureMessage as any,
            });

        if (!signature) {
          throw new Error("Failed to sign SGCTL delegation");
        }

        updateStepStatus("DELEGATE_SGCTL", "confirming");
        const delegationResult = await delegateSgctlWithRetry({
          applicationId: currentApplication.id,
          fractionId: activeFraction.id,
          amount: currentSgctlRequiredAmount,
          signature,
          deadline,
          nonce,
          sourceMode: sgctlSourceMode,
        });
        updateStepStatus("DELEGATE_SGCTL", "completed");
        updateStepStatus("CONFIRM_TX", "confirming");

        await confirmPurchaseInSplits(quantity);
        const confirmedApplication =
          (await fetchLatestApplication()) ?? currentApplication;
        setLiveApplication(confirmedApplication);
        setSuccessMetrics(
          calculateSuccessMetrics(
            activeFraction,
            quantity,
            runtimeSelectedCurrency,
          ),
        );

        await sponsorMutation.mutateAsync({
          applicationId: currentApplication.id,
          amount: currentSgctlRequiredAmount,
          currency: runtimeSelectedCurrency,
          txHash: delegationResult.delegationId,
          onSuccess: async () => {
            applyOptimisticPostSuccessUpdates({
              txHash: delegationResult.delegationId,
              application: confirmedApplication,
              fallbackApplication: currentApplication,
              quantity,
              amount: currentSgctlRequiredAmount,
              currency: runtimeSelectedCurrency,
            });
            await invalidatePostSuccessQueries(activeFraction.id);
            await syncFreshPostSuccessCaches();
            schedulePostSuccessRefreshes();
            updateStepStatus("CONFIRM_TX", "completed");
            setPhase("success");
            setTxHash(null);

            trackEvent("marketplace_deposit_success", {
              currency: runtimeSelectedCurrency,
              payment_method: selectedPaymentMethod,
              listing_type: "delegations",
              delegation_source: sgctlSourceMode,
              delegation_id: delegationResult.delegationId,
              application_id: currentApplication.id,
              fraction_id: activeFraction.id,
              quantity,
              tx_hash: null,
              farm_name: currentApplication.farmName ?? null,
              zone_name: currentApplication.zone?.name ?? null,
              referral_code:
                getStoredReferralAttribution()?.referralCode ?? null,
            });

            toast.success(dd.toastDelegationSuccess);
            onSuccess?.();
          },
        });

        return;
      }

      let requiredUsdc = 0n;
      if (selectedPaymentMethod === "ETH") {
        if (runtimeSelectedCurrency === "USDC") {
          requiredUsdc = BigInt(activeFraction.stepPrice) * BigInt(quantity);
        } else {
          const glwNeeded =
            (currentDelegationStepAtomic ?? 0n) * BigInt(quantity);
          const glwPrice = parseUnits(glwSpotPrice.toFixed(6), 6);
          const rawUsdcCost = (glwNeeded * glwPrice) / BigInt(1e18);
          requiredUsdc = (rawUsdcCost * 102n) / 100n;
        }
      }

      // --- 1. ETH Payment Handling (Swap to USDC) ---
      if (selectedPaymentMethod === "ETH") {
        if (requiredUsdc <= 0n) {
          throw new Error("Invalid USDC amount required for swap");
        }

        updateStepStatus("SWAP_ETH_TO_USDC", "waiting_signature");

        // Estimate ETH needed for the required USDC amount
        const probeWei = parseUnits("0.1", 18);
        const probeRes = await estimateEthToUsdc({
          amountInWei: probeWei,
          slippageBps: 100n,
        });

        if (!probeRes.ok) throw new Error("Failed to quote ETH to USDC");
        if (probeRes.val.amountOutUsdc <= 0n)
          throw new Error("Failed to quote ETH to USDC");

        // Calculate required ETH with buffer
        let amountInWei =
          (probeWei * requiredUsdc) / probeRes.val.amountOutUsdc;
        amountInWei = (amountInWei * 102n) / 100n; // +2% buffer

        // Refine estimate (simple retry loop)
        for (let i = 0; i < 3; i++) {
          const res = await estimateEthToUsdc({
            amountInWei,
            slippageBps: 100n,
          });
          if (res.ok && res.val.amountOutMinUsdc >= requiredUsdc) break;
          amountInWei = (amountInWei * 105n) / 100n; // +5% bump
        }

        updateStepStatus("SWAP_ETH_TO_USDC", "confirming");
        const swapRes = await swapEthToUsdc({
          amountInWei,
          slippageBps: 100n,
        });
        if (!swapRes.ok) throw new Error(swapRes.val);
        await refetchBalances();
        updateStepStatus("SWAP_ETH_TO_USDC", "completed");
      }

      // --- 2. Swap USDC to GLW (if delegating via swap) ---
      if (isSwapDelegate) {
        // Calculate needed GLW
        const glwNeeded =
          (currentDelegationStepAtomic ?? 0n) * BigInt(quantity);
        // Estimate USDC needed: GLW * Price * 1.02 (2% buffer)
        const glwPrice = parseUnits(glwSpotPrice.toFixed(6), 6);
        const usdcNeeded =
          (((glwNeeded * glwPrice) / BigInt(1e18)) * 102n) / 100n;

        // Swap USDC -> USDG
        updateStepStatus("SWAP_USDC_TO_USDG", "waiting_signature");
        updateStepStatus("SWAP_USDC_TO_USDG", "confirming");
        const usdcSwapRes = await swapUSDCToUSDG(usdcNeeded);
        if (!usdcSwapRes.ok) throw new Error(usdcSwapRes.val);
        updateStepStatus("SWAP_USDC_TO_USDG", "completed");

        // Swap USDG -> GLW (Uniswap)
        updateStepStatus("SWAP_USDG_TO_GLOW", "waiting_signature");
        updateStepStatus("SWAP_USDG_TO_GLOW", "confirming");
        const glowSwapRes = await swapUsdgToGlow({
          amount: usdcNeeded,
          slippagePercentTenThousandDenominator: 100n, // 1%
        });
        if (!glowSwapRes.ok) throw new Error(glowSwapRes.val);
        updateStepStatus("SWAP_USDG_TO_GLOW", "completed");

        // We should now have enough GLW.
        updateStepStatus("DELEGATE_GLW", "waiting_signature");
      } else if (isUnclaimedRewardsPayment) {
        if (claimSetSelection.shortfallGlwWei > 0n) {
          throw new Error(
            "Not enough unclaimed GLW to fund this delegation. Lower the amount or pick another payment method.",
          );
        }

        const fromAddress = getHotWalletAddress();
        const allSelectedWeeks = Array.from(
          new Set(
            [
              ...claimSetSelection.pdWeeks,
              ...claimSetSelection.inflationWeeks,
            ].map((w) => w.week),
          ),
        );

        const userProofsByWeek = new Map<number, ReadableLeafReward>();
        for (const week of allSelectedWeeks) {
          const data = await fetchWeeklyReportData(week);
          const proof = data.readableLeaves.find(
            (leaf) =>
              leaf.user.toLowerCase() === userAddress.toLowerCase(),
          );
          if (!proof) {
            throw new Error(
              `Missing merkle proof for week ${week}. Please retry in a moment.`,
            );
          }
          userProofsByWeek.set(week, proof);
        }

        if (claimSetSelection.pdWeeks.length > 0) {
          const pdWeeklyData = claimSetSelection.pdWeeks.map((item) => {
            const proof = userProofsByWeek.get(item.week)!;
            return {
              week: item.week,
              nonce: weekToNonce(item.week),
              v2Proof: proof.v2MerkleProof as `0x${string}`[],
              fromAddress,
              onchainAssetsEarned: proof.onchainAssetsEarned,
            };
          });
          const pdResult =
            await rewardsKernelWrapper.claimAllProtocolDepositsInOneTx(
              pdWeeklyData,
            );
          // The wrapper may report no new tx hash because every selected
          // week was already claimed on-chain (e.g., a previous attempt
          // landed but the user retried before the indexer caught up). That
          // is functionally success for the delegate-from-rewards path — the
          // GLW from those PD weeks is already in the wallet — so only fail
          // when the wrapper neither broadcast a tx nor saw matching
          // already-claimed weeks.
          const pdEffectiveCovered =
            pdResult.txHash != null ||
            pdResult.alreadyClaimedWeeks.length === pdWeeklyData.length;
          if (!pdEffectiveCovered) {
            throw new Error("Failed to claim protocol deposit rewards");
          }
        }

        for (const item of claimSetSelection.inflationWeeks) {
          const proof = userProofsByWeek.get(item.week)!;
          const inflationOnlyRewards: ClaimableReward[] = [
            {
              week: item.week,
              currency: "GLW",
              amount: "",
              amountRaw: proof.glowInflationEarned,
              type: "glowInflation",
            },
          ];
          const txHash = await rewardsKernelWrapper.claimWeekRewards(
            item.week,
            inflationOnlyRewards,
            weekToNonce(item.week),
            proof.v1MerkleProof as `0x${string}`[],
            proof.v2MerkleProof as `0x${string}`[],
            fromAddress,
            proof.glowInflationEarnedLeafWeight,
            undefined,
            {
              suppressWeekSuccessToast: true,
              throwOnUserRejected: true,
            },
          );
          if (!txHash) {
            throw new Error(
              `Failed to claim emission rewards for week ${item.week}`,
            );
          }
        }

        await refetchBalances();
        unclaimedGlw.refetch();

        updateStepStatus("BUY_FRACTIONS", "waiting_signature");
      } else {
        updateStepStatus("BUY_FRACTIONS", "waiting_signature");
      }

      // --- 3. Purchase Fractions (Delegate or Buy Miner) ---
      // Verify balance check skipped (handled by hook/metamask will fail if insufficient)
      // For "Swap & Delegate", we just bought GLW.
      // For "Buy Miner", we have USDC.

      const activeStepId = isSwapDelegate ? "DELEGATE_GLW" : "BUY_FRACTIONS";
      updateStepStatus(activeStepId, "confirming");

      const txHash = await withInternalRpcRetry(
        () =>
          fractionsHook.buyFractions({
            creator: activeFraction.owner,
            id: activeFraction.id,
            stepsToBuy: BigInt(quantity),
            minStepsToBuy: BigInt(quantity),
            refundTo: userAddress,
            creditTo: userAddress,
            useCounterfactualAddressForRefund: false,
          }),
        {
          maxRetries: 1,
          delayMs: 1500,
          onRetry: (attempt) => {
            trackEvent("rpc_internal_error_retry", {
              attempt,
              step: activeStepId,
              application_id: application?.id ?? null,
              fraction_id: activeFraction.id,
            });
          },
        },
      );

      updateStepStatus(activeStepId, "completed", { txHash });

      // --- 4. Confirm & Sponsor ---
      updateStepStatus("CONFIRM_TX", "confirming");
      setTxHash(txHash);

      const costBigInt =
        runtimeSelectedCurrency === "USDC"
          ? BigInt(activeFraction.stepPrice) * BigInt(quantity)
          : (currentDelegationStepAtomic ?? 0n) * BigInt(quantity);

      const optimisticApplication = updateApplicationAfterSuccessfulPurchase(
        currentApplication,
        quantity,
      );

      setLiveApplication(optimisticApplication);
      setSuccessMetrics(
        calculateSuccessMetrics(
          activeFraction,
          quantity,
          runtimeSelectedCurrency,
        ),
      );
      applyOptimisticPostSuccessUpdates({
        txHash,
        application: optimisticApplication,
        fallbackApplication: currentApplication,
        quantity,
        amount: costBigInt,
        currency: runtimeSelectedCurrency,
      });
      updateStepStatus("CONFIRM_TX", "completed", { txHash });
      setPhase("success");

      // USD ticket-size bucket for cohort analysis (whale vs retail).
      // Revenue itself is owned by the backend pol/revenue sync, not here,
      // to avoid double-counting in Umami's Revenue report.
      const usdTicket =
        runtimeSelectedCurrency === "USDC"
          ? Number(costBigInt) / 1e6
          : null;

      trackEvent("marketplace_deposit_success", {
        currency: runtimeSelectedCurrency,
        payment_method: selectedPaymentMethod,
        listing_type:
          runtimeSelectedCurrency === "USDC" ? "miners" : "delegations",
        application_id: currentApplication.id,
        fraction_id: activeFraction.id,
        quantity,
        tx_hash: txHash,
        farm_name: currentApplication.farmName ?? null,
        zone_name: currentApplication.zone?.name ?? null,
        amount_usd_bucket:
          usdTicket != null ? bucketUsd(usdTicket) : null,
        referral_code:
          getStoredReferralAttribution()?.referralCode ?? null,
      });

      toast.success(
        runtimeSelectedCurrency === "USDC"
          ? dd.toastMinersPurchased
          : dd.toastDelegationSuccess,
      );
      onSuccess?.();

      void (async () => {
        try {
          await confirmPurchaseInSplits(quantity);
          const confirmedApplication =
            (await fetchLatestApplication()) ?? optimisticApplication;
          setLiveApplication(confirmedApplication);

          await sponsorMutation.mutateAsync({
            applicationId: currentApplication.id,
            amount: costBigInt,
            currency: runtimeSelectedCurrency,
            txHash,
            onSuccess: async () => {
              await invalidatePostSuccessQueries(activeFraction.id);
              await syncFreshPostSuccessCaches();
              schedulePostSuccessRefreshes();
            },
          });
        } catch (backgroundError) {
          console.error(
            "Post-success split confirmation sync failed:",
            backgroundError,
          );
          Sentry.captureException(
            backgroundError instanceof Error
              ? backgroundError
              : new Error(String(backgroundError)),
            {
              tags: {
                marketplaceStage: "post_success_sync",
                delegationAsset:
                  application?.activeFraction?.delegationAsset ?? "none",
                delegationPhase:
                  application?.activeFraction?.delegationPhase ?? "none",
              },
              extra: {
                currency: runtimeSelectedCurrency,
                paymentMethod: selectedPaymentMethod,
                applicationId: currentApplication.id,
                fractionId: activeFraction.id,
                quantity,
                txHash,
              },
            },
          );

          schedulePostSuccessRefreshes();
        }
      })();
    } catch (e: any) {
      console.error(e);
      const rawMsg = getErrorMessage(e) || dd.processingTransactionFailedFallback;
      const errorTxHash =
        typeof e?.txHash === "string"
          ? e.txHash
          : typeof e?.cause?.txHash === "string"
            ? e.cause.txHash
            : null;

      // Check multiple places where viem might store the custom error name
      const errorName =
        e?.cause?.data?.errorName ||
        e?.cause?.name ||
        e?.name ||
        e?.data?.errorName ||
        "";
      const errorCode = getErrorCode(e);
      const isRpcInternal = isInternalRpcError(e);

      // Resolve currently active step first so step-specific error mappers can use it
      const currentSteps = stepsRef.current;
      const activeStep = currentSteps.find(
        (s) => s.status === "waiting_signature" || s.status === "confirming",
      );
      const isDelayedSplitConfirmation =
        isDelayedSplitConfirmationErrorMessage(rawMsg);

      if (isDelayedSplitConfirmation) {
        trackEvent("marketplace_deposit_confirmation_delayed", {
          currency: runtimeSelectedCurrency,
          payment_method: selectedPaymentMethod,
          listing_type:
            runtimeSelectedCurrency === "USDC" ? "miners" : "delegations",
          delegation_source: sgctlSourceMode,
          application_id: application?.id ?? null,
          fraction_id: application?.activeFraction?.id ?? null,
          quantity,
          tx_hash: errorTxHash ?? txHash ?? null,
          failed_step: activeStep?.id ?? null,
        });

        setTxHash(errorTxHash ?? txHash ?? null);
        setPhase("pending_confirmation");
        setErrorMessage(rawMsg);
        setIsInsufficientSharesError(false);
        return;
      }

      // Look up user-friendly error message from the mapping
      const knownError = CONTRACT_ERROR_MESSAGES[errorName];
      const errorConfig = knownError || findErrorInMessage(rawMsg);
      const swapVolatilityMessage = getSwapVolatilityErrorMessage(
        rawMsg,
        activeStep?.id,
      );
      const msg = isRpcInternal
        ? RPC_INTERNAL_ERROR_MESSAGE
        : errorConfig?.message || swapVolatilityMessage || rawMsg;
      const shouldRefresh = isRpcInternal
        ? false
        : (errorConfig?.shouldRefresh ?? false);

      if (shouldRefresh) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.listings.allSponsors,
        });
      }

      // Mark the current active step as error (using ref to avoid stale closure)
      if (activeStep) {
        updateStepStatus(activeStep.id, "error", { errorMessage: msg });
      } else if (currentSteps.length > 0) {
        // If no active step found, mark the first idle step as error
        const firstIdleStep = currentSteps.find((s) => s.status === "idle");
        if (firstIdleStep) {
          updateStepStatus(firstIdleStep.id, "error", { errorMessage: msg });
        }
      }

      const isUserRejected =
        rawMsg.includes("User rejected") || rawMsg.includes("user rejected");

      const hasCustomMessage = Boolean(errorConfig || swapVolatilityMessage);

      if (!isUserRejected) {
        trackEvent("marketplace_deposit_error", {
          currency: runtimeSelectedCurrency,
          payment_method: selectedPaymentMethod,
          listing_type:
            runtimeSelectedCurrency === "USDC" ? "miners" : "delegations",
          delegation_source: sgctlSourceMode,
          application_id: application?.id ?? null,
          fraction_id: application?.activeFraction?.id ?? null,
          quantity,
          failed_step: activeStep?.id ?? null,
          error_message: rawMsg.slice(0, 200),
          error_name: errorName || null,
        });

        // Report to Sentry
        const normalizedError =
          e instanceof Error ? e : new Error(String(rawMsg));
        Sentry.captureException(normalizedError, {
          tags: {
            marketplaceStage: "deposit",
            delegationAsset:
              application?.activeFraction?.delegationAsset ?? "none",
            delegationPhase:
              application?.activeFraction?.delegationPhase ?? "none",
          },
          extra: {
            currency: runtimeSelectedCurrency,
            paymentMethod: selectedPaymentMethod,
            delegationSource: sgctlSourceMode,
            applicationId: application?.id,
            fractionId: application?.activeFraction?.id,
            regionId,
            applicationPaymentCurrency: application?.paymentCurrency ?? null,
            activeFractionDelegationAsset:
              application?.activeFraction?.delegationAsset ?? null,
            activeFractionDelegationPhase:
              application?.activeFraction?.delegationPhase ?? null,
            delegationStepAtomic: delegationStepAtomic?.toString() ?? null,
            sgctlRequiredAmount:
              runtimeSelectedCurrency === "SGCTL"
                ? sgctlRequiredAmount.toString()
                : null,
            sgctlShortfall:
              runtimeSelectedCurrency === "SGCTL"
                ? sgctlShortfall.toString()
                : null,
            quantity,
            failedStep: activeStep?.id,
            errorName: errorName || null,
            errorCode: errorCode ?? null,
            isInternalRpcError: isRpcInternal,
            walletClientChainId: walletClient?.chain?.id ?? null,
            walletClientAccount: walletClient?.account?.address ?? null,
            connectorName: connector?.name ?? null,
            walletAddress: address,
          },
        });
      }

      setPhase("error");
      setErrorMessage(msg);
      setIsInsufficientSharesError(shouldRefresh);
      if (isUserRejected) {
        toast.error(dd.toastTransactionRejected);
      } else if (!hasCustomMessage) {
        toast.error(msg);
      }
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const farmLabelForShare = React.useMemo(() => {
    if (!application) return null;
    if (application.farmName) return application.farmName;
    return application.zone?.name ?? null;
  }, [application]);

  const farmImageUrlForShare = React.useMemo(() => {
    return application?.afterInstallPictures?.[0]?.url ?? null;
  }, [application]);

  const minerLifeRemainingForShare = React.useMemo(() => {
    if (selectedCurrency !== "USDC") return undefined;
    return (rewardScore as MiningCenterScore | null | undefined)
      ?.weeksOfMinerLifeRemaining;
  }, [rewardScore, selectedCurrency]);

  const shareUrl = React.useMemo(
    () =>
      generateShareUrl(
        runtimeSelectedCurrency,
        quantity,
        farmLabelForShare,
        Boolean(successMetrics),
        minerLifeRemainingForShare,
      ),
    [
      runtimeSelectedCurrency,
      quantity,
      farmLabelForShare,
      minerLifeRemainingForShare,
      successMetrics,
    ],
  );

  const handleShare = async () => {
    try {
      if (!shareUrl) return;

      const isSmallScreen =
        typeof window !== "undefined" &&
        window.matchMedia?.("(max-width: 768px)")?.matches;

      const shareTitle = farmLabelForShare
        ? dd.shareTitlePrefix(farmLabelForShare)
        : dd.shareTitleFallback;

      const shareText =
        runtimeSelectedCurrency === "USDC"
          ? dd.shareTextMiners(
              String(quantity),
              farmLabelForShare ?? dd.shareFarmFallback,
              APP_DOMAIN_PLAIN_TEXT,
            )
          : dd.shareTextDelegation(
              farmLabelForShare ?? dd.shareFarmFallback,
              runtimeSelectedCurrency === "SGCTL" ? "SGCTL" : "GLW",
              APP_DOMAIN_PLAIN_TEXT,
            );

      const canNativeShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function";

      if (isSmallScreen && canNativeShare) {
        trackEvent("marketplace_deposit_share_native_click", {
          currency: runtimeSelectedCurrency,
          application_id: application?.id ?? null,
          fraction_id: application?.activeFraction?.id ?? null,
          steps_to_buy: quantity,
          tx_hash: txHash ?? null,
          has_image: Boolean(farmImageUrlForShare),
        });

        if (farmImageUrlForShare && typeof navigator.canShare === "function") {
          try {
            const response = await fetch(farmImageUrlForShare);
            const blob = await response.blob();
            const fileExt =
              blob.type === "image/png"
                ? "png"
                : blob.type === "image/webp"
                  ? "webp"
                  : "jpg";

            const file = new File([blob], `glow-farm.${fileExt}`, {
              type: blob.type || "image/jpeg",
            });

            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: shareTitle,
                text: shareText,
                files: [file],
              });
              return;
            }
          } catch {
            // fall through to sharing without files
          }
        }

        await navigator.share({
          title: shareTitle,
          text: shareText,
        });
        return;
      }

      trackEvent("marketplace_deposit_share_x_click", {
        currency: runtimeSelectedCurrency,
        application_id: application?.id ?? null,
        fraction_id: application?.activeFraction?.id ?? null,
        steps_to_buy: quantity,
        tx_hash: txHash ?? null,
      });

      if (typeof window !== "undefined") {
        window.open(shareUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      console.error(e);
      toast.error(dd.toastUnableToShare);
    }
  };

  const successDetails: TransactionDetail[] =
    effectiveApplication?.activeFraction
      ? (() => {
          const totalCost =
            runtimeSelectedCurrency === "USDC"
              ? BigInt(effectiveApplication.activeFraction.stepPrice) *
                BigInt(quantity)
              : (delegationStepAtomic ?? 0n) * BigInt(quantity);

          const delegatedLabel =
            runtimeSelectedCurrency === "SGCTL"
              ? dd.successDetailTotalSgctlDelegated
              : dd.successDetailTotalGlwDelegated;

          return [
            {
              label: dd.successDetailQuantity,
              value: quantity.toString(),
            },
            {
              label:
                runtimeSelectedCurrency === "USDC"
                  ? dd.successDetailTotalUsdc
                  : delegatedLabel,
              value: formatNumber(
                parseFloat(
                  formatUnits(
                    totalCost,
                    DECIMALS_BY_TOKEN[runtimeSelectedCurrency],
                  ),
                ),
                0,
              ),
              unit: runtimeSelectedCurrency,
            },
          ];
        })()
      : [];

  const renderContent = () => {
    if (phase === "success") {
      const ringSize = isMobile ? 168 : 200;
      const ringStrokeWidth = isMobile ? 10 : 12;

      const filledAfterSteps = successMetrics
        ? Math.min(
            Math.max(0, Math.floor(successMetrics.totalSteps)),
            Math.max(
              0,
              Math.floor(successMetrics.filledBeforeSteps) +
                Math.floor(successMetrics.userSteps),
            ),
          )
        : 0;

      const leftAfterSteps = successMetrics
        ? Math.max(0, Math.floor(successMetrics.totalSteps) - filledAfterSteps)
        : 0;

      return (
        <div className="px-5 py-6 sm:px-6 sm:py-8 text-center space-y-3 sm:space-y-4">
          <div className="text-center space-y-2">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {runtimeSelectedCurrency === "USDC"
                ? dd.successPurchaseComplete
                : dd.successDelegationComplete}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {runtimeSelectedCurrency === "USDC"
                ? dd.successPurchaseSubtitle
                : dd.successDelegationSubtitle}
            </div>
          </div>

          {effectiveApplication?.activeFraction && successMetrics ? (
            <div className="flex flex-col items-center">
              <SegmentedCircleProgress
                totalSteps={successMetrics.totalSteps}
                filledBeforeSteps={successMetrics.filledBeforeSteps}
                userSteps={successMetrics.userSteps}
                size={ringSize}
                strokeWidth={ringStrokeWidth}
                label={
                  <span className="text-3xl sm:text-4xl font-bold tracking-tight font-mono">
                    {filledAfterSteps}/{successMetrics.totalSteps}
                  </span>
                }
                sublabel={
                  <span className="text-[11px] sm:text-xs text-muted-foreground">
                    {dd.successLeft(String(leftAfterSteps))}
                  </span>
                }
                otherColor={
                  runtimeSelectedCurrency === "USDC"
                    ? "rgba(32, 129, 226, 0.75)"
                    : "#C084FC"
                }
                userColor={
                  runtimeSelectedCurrency === "USDC"
                    ? "var(--color-miner)"
                    : "#4ADE80"
                }
                className="my-1 sm:my-2"
              />
              <div className="mt-2 sm:mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        runtimeSelectedCurrency === "USDC"
                          ? "rgba(32, 129, 226, 0.75)"
                          : "#C084FC",
                    }}
                  />
                  <span>{dd.successAlreadyFilled}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        runtimeSelectedCurrency === "USDC"
                          ? "var(--color-miner)"
                          : "#4ADE80",
                    }}
                  />
                  <span>{dd.successYourContribution}</span>
                </div>
              </div>
            </div>
          ) : null}

          {hasAnyEstimatedRewards ? (
            <div className="w-full rounded-xl bg-card border border-border/20 dark:border-border/40 overflow-hidden">
              {/* Projected Weekly Rewards */}
              <div className="px-5 py-4">
                <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest mb-2">
                  {dd.successProjectedWeeklyRewards}
                </div>
                <div className="flex justify-between items-end">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    {isMultiAssetEstimatedRewards ? (
                      <>
                        <span className="text-xl font-mono font-semibold text-foreground leading-none">
                          {estimatedRewardsBreakdown.pd.toLocaleString(
                            undefined,
                            {
                              maximumFractionDigits: 2,
                            },
                          )}
                        </span>
                        <span className="text-sm font-mono text-muted-foreground">
                          {estimatedRewardsBreakdown.pdSymbol}
                        </span>
                        <span className="text-sm font-mono text-muted-foreground">
                          +
                        </span>
                        <span className="text-2xl font-mono font-semibold text-foreground leading-none">
                          {estimatedRewardsBreakdown.glw.toLocaleString(
                            undefined,
                            {
                              maximumFractionDigits: 2,
                            },
                          )}
                        </span>
                        <span className="text-sm font-mono text-muted-foreground">
                          GLW
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-mono font-semibold text-foreground leading-none">
                          {estimatedRewards.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-sm font-mono text-muted-foreground">
                          GLW
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-sm font-mono text-muted-foreground/60 dark:text-muted-foreground/80">
                      ≈ $
                      {estimatedRewardsUsdValue.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Glow Points + Watts (V2) - estimated totals (actual points once credited) */}
              {address ? (
                <div className="px-5 py-4 border-t border-border/20 dark:border-border/40 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <div className="relative">
                    <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest mb-3">
                      {dd.previewWhatYouEarn}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Points */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 shrink-0 rounded-full bg-green-500/10 dark:bg-[#D1FF4D]/10 ring-1 ring-green-500/20 dark:ring-[#D1FF4D]/20 flex items-center justify-center">
                          <Sparkles className="h-4 w-4 text-green-600 dark:text-[#D1FF4D]" />
                        </div>
                        <div className="min-w-0 leading-tight">
                          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                            {dd.previewPointsPerUnit}
                          </div>
                          <span className="block text-lg md:text-xl font-bold font-mono text-green-600 dark:text-[#D1FF4D] leading-none">
                            {v2PointsGranted > 0
                              ? `+${v2PointsGranted.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}`
                              : previewPointsTotal != null
                                ? previewPointsTotal.toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })
                                : "-"}
                          </span>
                        </div>
                      </div>
                      {/* Watts */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 shrink-0 rounded-full bg-green-500/10 dark:bg-[#D1FF4D]/10 ring-1 ring-green-500/20 dark:ring-[#D1FF4D]/20 flex items-center justify-center">
                          <Zap className="h-4 w-4 text-green-600 dark:text-[#D1FF4D]" />
                        </div>
                        <div className="min-w-0 leading-tight">
                          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                            {dd.previewWattsPerUnit}
                          </div>
                          <span className="block text-lg md:text-xl font-bold font-mono text-green-600 dark:text-[#D1FF4D] leading-none">
                            {estimateQuery.isLoading
                              ? "…"
                              : previewWattsTotal != null
                                ? dd.previewEstWatts(
                                    previewWattsTotal.toLocaleString(undefined, {
                                      maximumFractionDigits: 1,
                                    }),
                                  )
                                : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/70 dark:text-muted-foreground/80">
                      {dd.successPointsCreditedBody(
                        runtimeSelectedCurrency === "USDC",
                        v2PointsGranted > 0,
                      )}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3">
            {successDetails.map((detail, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {detail.label}
                </span>
                <div className="text-right">
                  <span className="text-sm font-mono">{detail.value}</span>
                  {detail.unit && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {detail.unit}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-4">
            {shareUrl ? (
              <Button className="w-full" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                {dd.successShare}
              </Button>
            ) : null}
            <Button variant="outline" onClick={handleClose} className="w-full">
              {dd.successClose}
            </Button>
          </div>
        </div>
      );
    }

    if (
      phase === "processing" ||
      phase === "error" ||
      phase === "pending_confirmation"
    ) {
      const hasError = phase === "error";
      const isPendingConfirmation = phase === "pending_confirmation";

      return (
        <div className="px-6 py-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mx-auto mb-4">
              {hasError ? (
                <motion.div
                  className="h-14 w-14 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <X className="h-8 w-8 text-red-500" />
                </motion.div>
              ) : isPendingConfirmation ? (
                <motion.div
                  className="h-14 w-14 rounded-full bg-amber-500/15 flex items-center justify-center border border-amber-500/40"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <RefreshCw className="h-7 w-7 text-amber-500 animate-spin" />
                </motion.div>
              ) : (
                <motion.div
                  className="flex items-center justify-center"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <GlowSymbolAnimated className="size-12" />
                </motion.div>
              )}
            </div>
            <motion.div
              className="text-xl font-semibold text-foreground mb-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {hasError
                ? dd.processingTransactionFailed
                : isPendingConfirmation
                  ? dd.processingTransactionPending
                  : dd.processingTransactionInFlight}
            </motion.div>
            <motion.div
              className="text-muted-foreground text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {hasError
                ? dd.processingErrorBody
                : isPendingConfirmation
                  ? dd.processingPendingBody
                  : dd.processingActiveBody}
            </motion.div>
          </div>

          {/* Transaction Stepper */}
          {transactionSteps.length > 0 ? (
            <motion.div
              className="bg-muted/20 border border-border/50 rounded-2xl p-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              <TransactionStepper steps={transactionSteps} chainId={chainId} />
            </motion.div>
          ) : (hasError || isPendingConfirmation) && errorMessage ? (
            <motion.div
              className={cn(
                "p-3 rounded-xl",
                hasError
                  ? "bg-red-500/10 border border-red-500/20"
                  : "bg-amber-500/10 border border-amber-500/20",
              )}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p
                className={cn(
                  "text-sm break-words",
                  hasError ? "text-red-500" : "text-amber-600",
                )}
              >
                {hasError
                  ? errorMessage
                  : dd.processingPendingExplainer}
              </p>
            </motion.div>
          ) : null}

          {hasError && (
            <motion.div
              className="mt-5 flex gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                {dd.processingClose}
              </Button>
              <Button
                onClick={() => {
                  if (isInsufficientSharesError) {
                    queryClient.invalidateQueries({
                      queryKey: QUERY_KEYS.listings.allSponsors,
                    });
                  }
                  setPhase("review");
                  setTransactionSteps([]);
                  stepsRef.current = [];
                  setErrorMessage(null);
                  setIsInsufficientSharesError(false);
                }}
                className="flex-1"
              >
                {isInsufficientSharesError ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {dd.processingRefreshAndRetry}
                  </>
                ) : (
                  dd.processingTryAgain
                )}
              </Button>
            </motion.div>
          )}
          {isPendingConfirmation && (
            <motion.div
              className="mt-5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                variant="outline"
                onClick={handleClose}
                className="w-full"
              >
                {dd.processingClose}
              </Button>
            </motion.div>
          )}
        </div>
      );
    }

    // Default Review Phase
    return (
      <>
        <div className="px-6 pt-6 pb-3">
          <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
            {runtimeSelectedCurrency === "USDC"
              ? dd.reviewTitleMiners
              : runtimeSelectedCurrency === "SGCTL"
                ? dd.reviewTitleSgctl
                : dd.reviewTitleGlw}
          </DialogTitle>
          <div className="text-sm text-muted-foreground mt-1">
            {application?.farmName} • {application?.zone?.name}
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="space-y-5">
          {/* Quantity Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {dd.reviewQuantityLabel}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {dd.reviewQuantityAvailable(String(maxQuantity))}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setQuantity(maxQuantity);
                    setQuantityInput(maxQuantity.toString());
                  }}
                  className="text-xs font-medium text-glow-orange hover:text-glow-orange/80 transition-colors px-2 py-0.5 rounded-md hover:bg-glow-orange/10"
                >
                  {dd.reviewMaxButton}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 p-1 rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantityInput}
                onChange={(e) => handleQuantityInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={handleQuantityBlur}
                min={1}
                max={maxQuantity}
                className="flex-1 text-center font-mono text-xl font-medium bg-transparent border-none outline-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => handleQuantityChange(1)}
                disabled={quantity >= maxQuantity}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {initialPositionValueGuard.isBlocked ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
                {initialPositionMinimumMessage}
              </div>
            ) : null}
            {sgctlPreparationCutoffGuard.isBlocked ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
                {sgctlPreparationCutoffGuard.message}
              </div>
            ) : null}
          </div>

          {/* Estimated Rewards - Animated */}
          <div className="bg-muted/30 dark:bg-muted/50 rounded-2xl p-4 border border-border/20 dark:border-border/40 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <div className="relative flex justify-between items-end">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {dd.reviewEstWeeklyRewards}
                </div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  {isMultiAssetEstimatedRewards ? (
                    <>
                      <span className="text-lg md:text-2xl font-bold font-mono text-green-600 dark:text-[#D1FF4D]">
                        {estimatedRewardsBreakdown.pd.toLocaleString(
                          undefined,
                          {
                            maximumFractionDigits: 2,
                          },
                        )}
                      </span>
                      <span className="text-sm text-green-600/70 dark:text-[#D1FF4D]/70 font-medium">
                        SGCTL
                      </span>
                      <span className="text-sm text-green-600/70 dark:text-[#D1FF4D]/70 font-medium">
                        +
                      </span>
                      <AnimatePresence mode="popLayout">
                        <motion.span
                          key={`${estimatedRewardsBreakdown.glw}-${estimatedRewardsBreakdown.pd}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-lg md:text-2xl font-bold font-mono text-green-600 dark:text-[#D1FF4D]"
                        >
                          {estimatedRewardsBreakdown.glw.toLocaleString(
                            undefined,
                            {
                              maximumFractionDigits: 2,
                            },
                          )}
                        </motion.span>
                      </AnimatePresence>
                      <span className="text-sm text-green-600/70 dark:text-[#D1FF4D]/70 font-medium">
                        GLW
                      </span>
                    </>
                  ) : (
                    <>
                      <AnimatePresence mode="popLayout">
                        <motion.span
                          key={`${estimatedRewardsBreakdown.glw}-${estimatedRewardsBreakdown.pd}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-lg md:text-2xl font-bold font-mono text-green-600 dark:text-[#D1FF4D]"
                        >
                          {estimatedRewards.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </motion.span>
                      </AnimatePresence>
                      <span className="text-sm text-green-600/70 dark:text-[#D1FF4D]/70 font-medium">
                        GLW
                      </span>
                    </>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground/80">
                  {rewardsWeeksLabel}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground/80 mb-1">
                  {dd.reviewValueLabel}
                </div>
                <div className="text-sm text-foreground/80 font-mono">
                  ≈ $
                  {estimatedRewardsUsdValue.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* What you'll earn - compact, animated (mirrors Est. Rewards) */}
          <div className="bg-muted/30 dark:bg-muted/50 rounded-2xl px-4 py-3 border border-border/20 dark:border-border/40 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <div className="relative grid grid-cols-2 gap-3">
              {/* Points (total, scales with quantity) */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 shrink-0 rounded-full bg-green-500/10 dark:bg-[#D1FF4D]/10 ring-1 ring-green-500/20 dark:ring-[#D1FF4D]/20 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-green-600 dark:text-[#D1FF4D]" />
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                    {dd.previewPointsPerUnit}
                  </div>
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={`pts-${previewPointsTotal ?? "na"}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="block text-lg md:text-xl font-bold font-mono text-green-600 dark:text-[#D1FF4D] leading-none"
                    >
                      {previewPointsTotal != null
                        ? previewPointsTotal.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })
                        : "-"}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
              {/* Watts (total estimate, scales with quantity) */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 shrink-0 rounded-full bg-green-500/10 dark:bg-[#D1FF4D]/10 ring-1 ring-green-500/20 dark:ring-[#D1FF4D]/20 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-green-600 dark:text-[#D1FF4D]" />
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                    {dd.previewWattsPerUnit}
                  </div>
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={`w-${estimateQuery.isLoading ? "load" : previewWattsTotal ?? "na"}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="block text-lg md:text-xl font-bold font-mono text-green-600 dark:text-[#D1FF4D] leading-none"
                    >
                      {estimateQuery.isLoading
                        ? "…"
                        : previewWattsTotal != null
                          ? dd.previewEstWatts(
                              previewWattsTotal.toLocaleString(undefined, {
                                maximumFractionDigits: 1,
                              }),
                            )
                          : "-"}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {runtimeSelectedCurrency === "USDC"
                ? dd.reviewSelectCurrency
                : dd.reviewDelegationSource}
            </label>
            <div className="space-y-2">
              {/* Option: GLW */}
              {(runtimeSelectedCurrency === "GLW" ||
                runtimeSelectedCurrency === "USDC") && (
                <PaymentOption
                  label={dd.paymentLabelGlw}
                  balance={
                    glwBalance
                      ? `${parseFloat(
                          formatUnits(glwBalance, 18),
                        ).toLocaleString()} GLW`
                      : "0 GLW"
                  }
                  icon={<TokenIcon symbol="GLW" />}
                  selected={selectedPaymentMethod === "GLW"}
                  onSelect={() => setSelectedPaymentMethod("GLW")}
                  disabled={runtimeSelectedCurrency === "USDC"}
                  isBalanceInsufficient={
                    isConnected &&
                    selectedPaymentMethod === "GLW" &&
                    !affordability.canSubmit
                  }
                  pricePreview={requiredDisplayByMethod.GLW}
                  previewLabel={
                    runtimeSelectedCurrency === "GLW"
                      ? dd.previewDelegationAmount
                      : undefined
                  }
                />
              )}
              {showUnclaimedRewardsOption && (
                <>
                  <PaymentOption
                    label={`Use unclaimed rewards (${parseFloat(
                      formatUnits(unclaimedGlw.totalGlwWei, 18),
                    ).toLocaleString()} GLW available)`}
                    balance={`${parseFloat(
                      formatUnits(unclaimedGlw.totalGlwWei, 18),
                    ).toLocaleString()} GLW unclaimed`}
                    icon={<TokenIcon symbol="GLW" />}
                    selected={
                      selectedPaymentMethod === "UNCLAIMED_REWARDS"
                    }
                    onSelect={() =>
                      setSelectedPaymentMethod("UNCLAIMED_REWARDS")
                    }
                    isBalanceInsufficient={
                      isConnected &&
                      selectedPaymentMethod === "UNCLAIMED_REWARDS" &&
                      !affordability.canSubmit
                    }
                    pricePreview={requiredDisplayByMethod.UNCLAIMED_REWARDS}
                    previewLabel={dd.previewDelegationAmount}
                  />
                  {selectedPaymentMethod === "UNCLAIMED_REWARDS" && (
                    <UnclaimedRewardsBreakdown
                      selection={claimSetSelection}
                    />
                  )}
                </>
              )}
              {runtimeSelectedCurrency === "SGCTL" &&
                showStakedSgctlOption && (
                <PaymentOption
                  label={dd.paymentLabelSgctl}
                  balance={dd.paymentSgctlInRegion(
                    formatTokenAmount(stakedGctlBalance, 6, "0", 6),
                  )}
                  icon={<TokenIcon symbol="GCTL" />}
                  selected={selectedPaymentMethod === "SGCTL"}
                  onSelect={() => setSelectedPaymentMethod("SGCTL")}
                  isBalanceInsufficient={
                    isConnected &&
                    selectedPaymentMethod === "SGCTL" &&
                    !affordability.canSubmit
                  }
                  pricePreview={requiredDisplayByMethod.SGCTL}
                  previewLabel={dd.previewDelegationAmount}
                />
              )}
              {runtimeSelectedCurrency === "SGCTL" &&
                !sgctlPreparationCutoffGuard.isBlocked &&
                !showStakedSgctlOption && (
                  <PaymentOption
                    label={dd.paymentLabelGctl}
                    balance={dd.paymentGctlWallet(
                      formatTokenAmount(gctlWalletBalance, 6, "0", 6),
                    )}
                    icon={<TokenIcon symbol="GCTL" />}
                    selected={selectedPaymentMethod === "GCTL"}
                    onSelect={() => setSelectedPaymentMethod("GCTL")}
                    isBalanceInsufficient={
                      isConnected &&
                      selectedPaymentMethod === "GCTL" &&
                      !affordability.canSubmit
                    }
                    pricePreview={requiredDisplayByMethod.GCTL}
                    previewLabel={dd.previewSourceAmount}
                  />
                )}
              {(runtimeSelectedCurrency !== "SGCTL" ||
                (!showStakedSgctlOption &&
                  !sgctlPreparationCutoffGuard.isBlocked)) && (
                <>
                  {/* Option: USDC */}
                  <PaymentOption
                    label={dd.paymentLabelUsdc}
                    balance={
                      usdcBalance
                        ? `${parseFloat(
                            formatUnits(usdcBalance, 6),
                          ).toLocaleString()} USDC`
                        : "0 USDC"
                    }
                    icon={<TokenIcon symbol="USDC" />}
                    selected={selectedPaymentMethod === "USDC"}
                    onSelect={() => setSelectedPaymentMethod("USDC")}
                    isBalanceInsufficient={
                      isConnected &&
                      selectedPaymentMethod === "USDC" &&
                      !affordability.canSubmit
                    }
                    pricePreview={requiredDisplayByMethod.USDC}
                    previewLabel={
                      runtimeSelectedCurrency === "SGCTL"
                        ? dd.previewSourceCost
                        : runtimeSelectedCurrency === "GLW"
                          ? dd.previewSwapCost
                          : undefined
                    }
                  />
                  {/* Option: ETH */}
                  <PaymentOption
                    label={dd.paymentLabelEth}
                    balance={
                      ethBalance
                        ? `${parseFloat(formatUnits(ethBalance, 18)).toFixed(
                            4,
                          )} ETH`
                        : "0 ETH"
                    }
                    icon={<TokenIcon symbol="ETH" />}
                    selected={selectedPaymentMethod === "ETH"}
                    onSelect={() => setSelectedPaymentMethod("ETH")}
                    isBalanceInsufficient={
                      isConnected &&
                      selectedPaymentMethod === "ETH" &&
                      !affordability.canSubmit
                    }
                    pricePreview={requiredDisplayByMethod.ETH}
                    previewLabel={
                      runtimeSelectedCurrency === "SGCTL"
                        ? dd.previewSourceCost
                        : runtimeSelectedCurrency === "GLW"
                          ? dd.previewSwapCost
                          : undefined
                    }
                  />
                </>
              )}
            </div>
            {sgctlFundingBreakdown ? (
              <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {sgctlFundingBreakdown}
              </div>
            ) : null}
          </div>
          </div>
        </div>

        <div className="px-5 pb-5 pt-4 border-t border-border/20 dark:border-border/40">
          {runtimeSelectedCurrency !== "USDC" && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-medium uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                {runtimeSelectedCurrency === "SGCTL"
                  ? dd.reviewYouDelegate
                  : dd.reviewDelegationAmount}
              </span>
              <div className="text-right text-sm font-semibold font-mono">
                {delegatedAmountLabel}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-5">
            <span className="text-sm font-mono font-medium uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              {runtimeSelectedCurrency === "SGCTL"
                ? dd.reviewSourceCost
                : runtimeSelectedCurrency === "GLW" &&
                    selectedPaymentMethod !== "GLW"
                  ? dd.reviewSwapCost
                  : dd.reviewTotal}
            </span>
            <div className="text-right">
              <div className="text-xl font-bold font-mono">
                {selectedPaymentMethod === "GLW" && requiredDisplayByMethod.GLW}
                {selectedPaymentMethod === "SGCTL" &&
                  requiredDisplayByMethod.SGCTL}
                {selectedPaymentMethod === "GCTL" &&
                  requiredDisplayByMethod.GCTL}
                {selectedPaymentMethod === "USDC" &&
                  `$${formatTokenAmount(
                    affordability.requiredByMethod.USDC,
                    6,
                    costInUSDC(quantity).toLocaleString(),
                  )}`}
                {selectedPaymentMethod === "ETH" && requiredDisplayByMethod.ETH}
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedPaymentMethod === "USDC"
                  ? dd.reviewStable
                  : dd.reviewApprox(costInUSDC(quantity).toLocaleString())}
              </div>
            </div>
          </div>

          <div className="relative">
            {!isConnected ? (
              <ConnectButton size="medium" variant="default" />
            ) : (
              <div className="space-y-2">
                <Button
                  className="w-full h-12"
                  onClick={handleConfirm}
                  disabled={
                    isSubmitting ||
                    isPreparingWalletAuthorization ||
                    isCheckingInitialPositionEligibility ||
                    sgctlPreparationCutoffGuard.isBlocked ||
                    initialPositionValueGuard.isBlocked ||
                    !affordability.canSubmit
                  }
                >
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {ctaLabel}
                </Button>
                {(() => {
                  if (selectedPaymentMethod !== "USDC") return null;
                  const usdcBalanceUsd =
                    usdcBalance != null
                      ? Number(formatUnits(usdcBalance, 6))
                      : 0;
                  const desiredUsdc = costInUSDC(quantity);
                  if (!Number.isFinite(desiredUsdc) || desiredUsdc <= 0)
                    return null;
                  if (desiredUsdc <= usdcBalanceUsd) return null;
                  const deficitUsd = desiredUsdc - usdcBalanceUsd;
                  // Floor at $20 to clear MoonPay/Coinbase Onramp minimums.
                  // Surplus stays in the user's wallet as USDC.
                  const MIN_CARD_FUND_USDC = 20;
                  const roundedDeficit = Math.ceil(deficitUsd * 100) / 100;
                  const cardFundAmount = Math.max(
                    MIN_CARD_FUND_USDC,
                    roundedDeficit,
                  ).toFixed(2);
                  const isMinimumApplied =
                    roundedDeficit < MIN_CARD_FUND_USDC;
                  return (
                    // Hidden on mobile: in-app dApp browsers silently block
                    // the on-ramp popup; card flow stays desktop-only.
                    <div className="hidden lg:block space-y-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleBuyWithCard(cardFundAmount)}
                        disabled={isSubmitting}
                        className="w-full h-11 gap-2 font-medium rounded-xl"
                      >
                        <CreditCard className="h-4 w-4" />
                        {t.wallet.buyAmountUsdcWithCard(cardFundAmount)}
                      </Button>
                      {isMinimumApplied && (
                        <p className="text-xs text-muted-foreground text-center">
                          {t.wallet.cardOnRampMinNotice}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md p-0 gap-0 overflow-hidden bg-card border border-border/40 text-foreground max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-[24px]"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {renderContent()}

        <SmartAccountWarningDialog
          open={isSmartAccountWarningOpen}
          onOpenChange={setIsSmartAccountWarningOpen}
        />
      </DialogContent>
    </Dialog>
  );
}

function PaymentOption({
  label,
  balance,
  icon,
  selected,
  onSelect,
  disabled,
  isBalanceInsufficient,
  pricePreview,
  previewLabel,
}: {
  label: string;
  balance: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  isBalanceInsufficient?: boolean;
  pricePreview: string;
  previewLabel?: string;
}) {
  const { t } = useLang();
  const dd = t.routes.depositDialog;
  if (disabled) return null;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors",
        selected
          ? "bg-muted/30 dark:bg-muted/50 border-border/40 dark:border-border/60"
          : "bg-transparent border-border/20 dark:border-border/40 hover:bg-muted/20 dark:hover:bg-muted/30 hover:border-border/40 dark:hover:border-border/60",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted/30 dark:bg-muted/50 flex items-center justify-center border border-border/20 dark:border-border/40">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div
            className={cn(
              "text-xs",
              isBalanceInsufficient ? "text-red-500" : "text-muted-foreground",
            )}
          >
            {dd.paymentBalancePrefix(balance)}
          </div>
        </div>
      </div>
      <div className="text-right">
        {previewLabel ? (
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 dark:text-muted-foreground/80">
            {previewLabel}
          </div>
        ) : null}
        <div className="text-sm font-mono font-medium text-foreground">
          {pricePreview}
        </div>
        {selected && (
          <div className="h-2 w-2 rounded-full bg-[color:var(--color-glow-orange)] ml-auto mt-1" />
        )}
      </div>
    </div>
  );
}

function UnclaimedRewardsBreakdown({
  selection,
}: {
  selection: ClaimSetSelection;
}) {
  const { pdWeeks, inflationWeeks, totalGlwWei, shortfallGlwWei, txCount } =
    selection;
  const totalGlw = parseFloat(formatUnits(totalGlwWei, 18));
  const hasAny = pdWeeks.length > 0 || inflationWeeks.length > 0;

  if (!hasAny && shortfallGlwWei === 0n) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/20 dark:bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
      {pdWeeks.length > 0 && (
        <div>
          Claiming protocol deposits from {pdWeeks.length} week
          {pdWeeks.length === 1 ? "" : "s"}
        </div>
      )}
      {inflationWeeks.length > 0 && (
        <div>
          Claiming emissions from {inflationWeeks.length} week
          {inflationWeeks.length === 1 ? "" : "s"}
        </div>
      )}
      <div className="text-foreground font-mono">
        Total: {totalGlw.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
        GLW, {txCount} signature{txCount === 1 ? "" : "s"}
        {" + 1 delegation tx"}
      </div>
      {shortfallGlwWei > 0n && (
        <div className="text-red-500">
          Short by{" "}
          {parseFloat(formatUnits(shortfallGlwWei, 18)).toLocaleString(
            undefined,
            { maximumFractionDigits: 4 },
          )}{" "}
          GLW. Lower the amount or use another payment method.
        </div>
      )}
    </div>
  );
}

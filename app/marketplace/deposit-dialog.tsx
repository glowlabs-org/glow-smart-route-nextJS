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
} from "lucide-react";
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
} from "@glowlabs-org/utils/browser";
import { useQueryClient } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";
import { useEthPrice } from "@/hooks/useEthPrice";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { useSponsorApplication, type AuctionApplication } from "@/hooks";
import {
  fetchWalletRegionAvailableStake,
  useWalletRegionAvailableStake,
  useWallets,
} from "@/hooks/control-wallets";
import { useGctlPreparationOrchestrator } from "@/hooks/useGctlPreparationOrchestrator";
import { ConnectButton } from "@/components/connect-button";
import { trackEvent } from "@/lib/telemetry";
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
import { EmissionsIcon, VaultIcon } from "@/components/impact-icons";

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
  calculateImpactPointsBreakdown,
  calculateSuccessMetrics,
  clampQuantity,
  coerceToBigInt,
  findErrorInMessage,
  getDefaultPaymentMethodForRuntimeCurrency,
  generateShareUrl,
  getErrorCode,
  getErrorMessage,
  hasConfirmedSplitPurchase,
  isDelayedSplitConfirmationErrorMessage,
  getSwapVolatilityErrorMessage,
  initializeTransactionSteps,
  isInternalRpcError,
  isRetriableStakeSyncRefreshError,
  parseAvailableStakeSnapshot,
  parseQuantityInput,
  requiresSmartAccountCheck,
  resolveDelegationStepAtomic,
  resolveRuntimeSelectedCurrency,
  SPLIT_CONFIRMATION_DELAYED_MESSAGE,
  updateTransactionStepStatus,
  withInternalRpcRetry,
  type DepositPaymentMethod,
  type DepositSelectedCurrency,
  type SgctlSourceMode,
  type SuccessMetrics,
  type TransactionStep,
} from "./deposit-dialog-utils";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { useIsMobile } from "@/hooks/use-mobile";
import { hubGet } from "@/lib/api/hub-client";

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
  });
  const { availableStake, refetchAvailableStake } = useWalletRegionAvailableStake({
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

  const fetchLatestApplication = React.useCallback(async () => {
    if (!application?.id) return application;

    const filters =
      selectedCurrency === "USDC"
        ? ({ includeFilled: true, type: "mining-center" } as const)
        : ({ includeFilled: true } as const);

    const listings = await queryClient.fetchQuery({
      queryKey: QUERY_KEYS.listings.sponsor(filters),
      staleTime: 0,
      queryFn: async () =>
        hubGet<AuctionApplication[]>(
          "/applications/sponsor-listings-applications",
          {
            params: filters,
          },
        ),
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
    }
  }, [open, runtimeSelectedCurrency]);

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
    ],
  );

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
    } as const;
  }, [
    affordability.balances.GCTL,
    affordability.requiredByMethod,
    ethBalance,
    glwBalance,
    stakedGctlBalance,
    usdcBalance,
  ]);

  const selectedShortfall = shortfallByMethod[selectedPaymentMethod];
  const shortfallDecimals =
    selectedPaymentMethod === "ETH" || selectedPaymentMethod === "GLW" ? 18 : 6;
  const showShortfallInCta =
    isConnected &&
    !isSubmitting &&
    !affordability.canSubmit &&
    selectedShortfall > 0n;
  const disabledCtaLabel = `Need +${formatTokenAmount(
    selectedShortfall,
    shortfallDecimals,
    "0",
    6,
  )} ${selectedPaymentMethod}${
    runtimeSelectedCurrency === "GLW" && selectedPaymentMethod === "USDC"
      ? " (swap buffer)"
      : ""
  }`;

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
      return `This uses your available regional stake of ${existingStakeLabel} SGCTL, then mints and stakes ${shortfallLabel} more from USDC.`;
    }

    if (selectedPaymentMethod === "ETH") {
      return `This uses your available regional stake of ${existingStakeLabel} SGCTL, then mints and stakes ${shortfallLabel} more from ETH.`;
    }

    if (selectedPaymentMethod === "GCTL") {
      return `This uses your available regional stake of ${existingStakeLabel} SGCTL, then stakes ${shortfallLabel} more from your wallet GCTL balance.`;
    }

    return null;
  }, [
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
    if (!isConnected || runtimeSelectedCurrency !== "SGCTL") return false;

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

  React.useEffect(() => {
    if (runtimeSelectedCurrency !== "SGCTL") return;
    if (showStakedSgctlOption && selectedPaymentMethod === "GCTL") {
      setSelectedPaymentMethod("SGCTL");
    }
    if (!showStakedSgctlOption && selectedPaymentMethod === "SGCTL") {
      setSelectedPaymentMethod("GCTL");
    }
  }, [runtimeSelectedCurrency, selectedPaymentMethod, showStakedSgctlOption]);

  const estimatedRewardsBreakdown = React.useMemo(
    () =>
      calculateEstimatedRewardsBreakdown(
        quantity,
        application?.activeFraction ?? null,
        rewardScore ?? null,
      ),
    [quantity, application?.activeFraction, rewardScore],
  );
  const estimatedRewards = estimatedRewardsBreakdown.totalGlwEquivalent;
  const isMultiAssetEstimatedRewards =
    estimatedRewardsBreakdown.pdSymbol === "SGCTL" &&
    estimatedRewardsBreakdown.pd > 0;
  const hasAnyEstimatedRewards =
    estimatedRewardsBreakdown.glw > 0 || estimatedRewardsBreakdown.pd > 0;
  const estimatedRewardsUsdValue =
    estimatedRewardsBreakdown.glw * (glwSpotPrice || 0) +
    estimatedRewardsBreakdown.pd *
      (estimatedRewardsBreakdown.pdSymbol === "SGCTL"
        ? gctlPriceNumber || 0
        : glwSpotPrice || 0);

  // Estimated weekly impact points based on GLOW-IMPACT-SCORE.md rules:
  // - Emissions: +1 point per GLW earned in emission rewards
  // - Vault bonus: +0.005 points per week per GLW delegated (launchpad only)
  const impactPointsBreakdown = React.useMemo(
    () =>
      calculateImpactPointsBreakdown(
        quantity,
        effectiveApplication?.activeFraction ?? null,
        rewardScore ?? null,
        costInGLW,
        { includeVaultBonus: runtimeSelectedCurrency === "GLW" },
      ),
    [
      quantity,
      effectiveApplication?.activeFraction,
      rewardScore,
      costInGLW,
      runtimeSelectedCurrency,
    ],
  );

  const maxQuantity = effectiveApplication?.activeFraction?.remainingSteps ?? 0;

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
    [refetchSplits, splitsSummary?.totalStepsPurchased]
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

      const maxAttempts = 45;
      const delayMs = 2000;
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

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
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

        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      if (!hasFreshStakeRead && lastRetriableError) {
        throw new Error(
          "Unable to verify your recent stake right now. Please wait a few seconds and retry.",
        );
      }

      throw new Error(
        `Your recent stake is still indexing in Control. Required: ${requiredAmount.toString()}. Available: ${lastAvailableStake.toString()}.`,
      );
    },
    [
      address,
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
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.fractions.rewardsBreakdown({
            walletAddress: address,
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.wallets.farms(address),
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.fractions.splits(address, fractionId),
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.wallets.rewards(address),
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.impact.score(address),
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.impact.glowWorth(address),
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.impact.scoreBreakdown(address),
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.impact.leaderboard(),
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.balances.tokens(chainId, address),
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

  const handleConfirm = async () => {
    if (!isConnected || !effectiveApplication?.activeFraction) return;
    if (isPreparingWalletAuthorization) {
      toast.message("Preparing wallet signer...");
      return;
    }

    if (submitInFlightRef.current || isSubmitting) return;
    submitInFlightRef.current = true;

    try {
      // Block duplicate taps before React has time to commit the disabled button state.
      const isSafe = await handleSmartAccountCheck();
      if (!isSafe) return;

      const currentApplication =
        (await fetchLatestApplication()) ?? effectiveApplication;
      const activeFraction = currentApplication?.activeFraction;
      if (!currentApplication || !activeFraction) return;

      setLiveApplication(currentApplication);

      const availableSteps = Math.max(
        0,
        Math.floor(activeFraction.remainingSteps ?? 0),
      );
      if (availableSteps <= 0) {
        toast.error("This listing is no longer available.");
        return;
      }
      if (quantity > availableSteps) {
        setQuantity(availableSteps);
        setQuantityInput(availableSteps.toString());
        toast.error(
          `Only ${availableSteps} step${availableSteps === 1 ? "" : "s"} remaining for this listing.`,
        );
        return;
      }

      const isSwapDelegate =
        runtimeSelectedCurrency === "GLW" && selectedPaymentMethod !== "GLW";
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
      });
      const currentSgctlRequiredAmount =
        currentAffordability.requiredByMethod.SGCTL ?? 0n;
      const currentSgctlShortfall =
        currentSgctlRequiredAmount > stakedGctlBalance
          ? currentSgctlRequiredAmount - stakedGctlBalance
          : 0n;

      setIsSubmitting(true);
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
        const deadline = Math.floor(Date.now() / 1000 + 3600).toString();
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
        setSuccessMetrics(calculateSuccessMetrics(activeFraction, quantity));

        await sponsorMutation.mutateAsync({
          applicationId: currentApplication.id,
          amount: currentSgctlRequiredAmount,
          currency: runtimeSelectedCurrency,
          txHash: delegationResult.delegationId,
          onSuccess: () => {
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
            });

            toast.success("Delegation successful!");
            void invalidatePostSuccessQueries(activeFraction.id);
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

      await confirmPurchaseInSplits(quantity);

      setSuccessMetrics(calculateSuccessMetrics(activeFraction, quantity));

      const costBigInt =
        runtimeSelectedCurrency === "USDC"
          ? BigInt(activeFraction.stepPrice) * BigInt(quantity)
          : (currentDelegationStepAtomic ?? 0n) * BigInt(quantity);

      await sponsorMutation.mutateAsync({
        applicationId: currentApplication.id,
        amount: costBigInt,
        currency: runtimeSelectedCurrency,
        txHash: txHash,
        onSuccess: () => {
          updateStepStatus("CONFIRM_TX", "completed", { txHash });
          setPhase("success");

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
          });

          toast.success(
            runtimeSelectedCurrency === "USDC"
              ? "Miners purchased!"
              : "Delegation successful!",
          );

          void invalidatePostSuccessQueries(activeFraction.id);
          onSuccess?.();
        },
      });
    } catch (e: any) {
      console.error(e);
      const rawMsg = getErrorMessage(e) || "Transaction failed";
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
        toast.error("Transaction rejected");
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
        ? `Glow • ${farmLabelForShare}`
        : "Glow";

      const shareText =
        runtimeSelectedCurrency === "USDC"
          ? `I just bought ${quantity} miner${quantity > 1 ? "s" : ""} from ${
              farmLabelForShare ?? "a solar farm"
            } on @glowFND\n\n${APP_DOMAIN_PLAIN_TEXT}`
          : `I just helped fund ${
              farmLabelForShare ?? "a solar farm"
            } by delegating ${
              runtimeSelectedCurrency === "SGCTL" ? "SGCTL" : "GLW"
            } tokens.\n\nYou can do the same on ${APP_DOMAIN_PLAIN_TEXT}`;

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
      toast.error("Unable to share right now");
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
              ? "Total SGCTL Delegated"
              : "Total GLW Delegated";

          return [
            {
              label: "Quantity",
              value: quantity.toString(),
            },
            {
              label:
                runtimeSelectedCurrency === "USDC"
                  ? "Total USDC"
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
                ? "Purchase Complete!"
                : "Delegation Complete!"}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {runtimeSelectedCurrency === "USDC"
                ? "You helped accelerate real-world solar deployment."
                : "You just activated real-world solar rewards."}
            </div>
          </div>

          {application?.activeFraction && successMetrics ? (
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
                    {leftAfterSteps} left
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
                  <span>Already filled</span>
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
                  <span>Your contribution</span>
                </div>
              </div>
            </div>
          ) : null}

          {hasAnyEstimatedRewards ? (
            <div className="space-y-3">
              <div
                className={cn(
                  "w-full rounded-2xl p-4 border",
                  runtimeSelectedCurrency === "USDC"
                    ? "bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10 border-blue-500/20"
                    : "bg-gradient-to-r from-green-500/10 via-[#D1FF4D]/10 to-green-500/10 border-green-500/20",
                )}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Projected Weekly Rewards
                    </div>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      {isMultiAssetEstimatedRewards ? (
                        <>
                          <span
                            className={cn(
                              "text-xl sm:text-2xl font-bold font-mono",
                              runtimeSelectedCurrency === "USDC"
                                ? "text-blue-600 dark:text-cyan-400"
                                : "text-green-600 dark:text-[#D1FF4D]",
                            )}
                          >
                            {estimatedRewardsBreakdown.glw.toLocaleString(
                              undefined,
                              {
                                maximumFractionDigits: 2,
                              },
                            )}
                          </span>
                          <span
                            className={cn(
                              "text-sm font-medium",
                              runtimeSelectedCurrency === "USDC"
                                ? "text-blue-600/70 dark:text-cyan-400/70"
                                : "text-green-600/70 dark:text-[#D1FF4D]/70",
                            )}
                          >
                            GLW +
                          </span>
                          <span
                            className={cn(
                              "text-lg sm:text-xl font-bold font-mono",
                              runtimeSelectedCurrency === "USDC"
                                ? "text-blue-600 dark:text-cyan-400"
                                : "text-green-600 dark:text-[#D1FF4D]",
                            )}
                          >
                            {estimatedRewardsBreakdown.pd.toLocaleString(
                              undefined,
                              {
                                maximumFractionDigits: 2,
                              },
                            )}
                          </span>
                          <span
                            className={cn(
                              "text-sm font-medium",
                              runtimeSelectedCurrency === "USDC"
                                ? "text-blue-600/70 dark:text-cyan-400/70"
                                : "text-green-600/70 dark:text-[#D1FF4D]/70",
                            )}
                          >
                            SGCTL
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            className={cn(
                              "text-xl sm:text-2xl font-bold font-mono",
                              runtimeSelectedCurrency === "USDC"
                                ? "text-blue-600 dark:text-cyan-400"
                                : "text-green-600 dark:text-[#D1FF4D]",
                            )}
                          >
                            {estimatedRewards.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span
                            className={cn(
                              "text-sm font-medium",
                              runtimeSelectedCurrency === "USDC"
                                ? "text-blue-600/70 dark:text-cyan-400/70"
                                : "text-green-600/70 dark:text-[#D1FF4D]/70",
                            )}
                          >
                            GLW
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground/80 mb-1">
                      ≈ Value
                    </div>
                    <div className="text-sm text-foreground/80 font-mono">
                      $
                      {estimatedRewardsUsdValue.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {impactPointsBreakdown.total > 0 ? (
                <div className="w-full rounded-2xl p-4 border bg-gradient-to-r from-glow-orange/10 via-glow-orange-500/10 to-glow-orange/20 border-glow-orange/30">
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-xs font-medium text-left text-muted-foreground uppercase tracking-wider">
                      Est. Weekly Impact Points
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base md:text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                        +
                        {impactPointsBreakdown.total.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-sm font-medium text-amber-600/70 dark:text-amber-400/70">
                        pts
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Emissions Row */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner)]">
                          <EmissionsIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-muted-foreground">Emissions</span>
                      </div>
                      <span className="font-mono font-medium text-[color:var(--color-miner)]">
                        +
                        {impactPointsBreakdown.emissionPoints.toLocaleString(
                          undefined,
                          { maximumFractionDigits: 2 },
                        )}
                      </span>
                    </div>

                    {/* Vault Bonus Row (only for delegations) */}
                    {impactPointsBreakdown.vaultBonusPoints > 0 ? (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[color:var(--delegation-purple)]/10 text-[color:var(--delegation-purple)]">
                            <VaultIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-muted-foreground">
                            Vault Bonus
                          </span>
                        </div>
                        <span className="font-mono font-medium text-[color:var(--delegation-purple)]">
                          +
                          {impactPointsBreakdown.vaultBonusPoints.toLocaleString(
                            undefined,
                            { maximumFractionDigits: 2 },
                          )}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Miner bonus note */}
                  {runtimeSelectedCurrency === "USDC" ? (
                    <div className="mt-3 pt-2 border-t border-amber-500/20 text-[11px] text-muted-foreground/80">
                      <span className="text-[color:var(--color-miner)] font-medium">
                        3× miner bonus
                      </span>{" "}
                      applies at weekly rollover
                    </div>
                  ) : null}
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
                Share
              </Button>
            ) : null}
            <Button variant="outline" onClick={handleClose} className="w-full">
              Close
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
                  transition={{ type: "spring", duration: 0.5 }}
                >
                  <X className="h-8 w-8 text-red-500" />
                </motion.div>
              ) : isPendingConfirmation ? (
                <motion.div
                  className="h-14 w-14 rounded-full bg-amber-500/15 flex items-center justify-center border border-amber-500/40"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
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
                ? "Transaction Failed"
                : isPendingConfirmation
                  ? "Transaction Pending"
                  : "Processing Transaction"}
            </motion.div>
            <motion.div
              className="text-muted-foreground text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {hasError
                ? "There was an error processing your transaction."
                : isPendingConfirmation
                  ? "Your transaction was submitted, but Glow has not indexed it yet. Please wait for indexing to catch up before trying again."
                  : "Please wait while we process your transaction."}
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
                  : "The network transaction may already be mined. Glow will reflect it after the split indexer catches up. Do not submit the purchase again unless you have refreshed and confirmed nothing changed."}
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
                Close
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
                    Refresh & Retry
                  </>
                ) : (
                  "Try Again"
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
              <Button variant="outline" onClick={handleClose} className="w-full">
                Close
              </Button>
            </motion.div>
          )}
        </div>
      );
    }

    // Default Review Phase
    return (
      <>
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <DialogTitle className="text-xl font-semibold">
              {runtimeSelectedCurrency === "USDC"
                ? "Buy Miners"
                : runtimeSelectedCurrency === "SGCTL"
                  ? "Delegate SGCTL"
                  : "Delegate GLW"}
            </DialogTitle>
          </div>
          <div className="text-sm text-muted-foreground">
            {application?.farmName} • {application?.zone?.name}
          </div>
        </div>

        <div className="px-6 space-y-6">
          {/* Quantity Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground/80">
                Quantity
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {maxQuantity} available
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setQuantity(maxQuantity);
                    setQuantityInput(maxQuantity.toString());
                  }}
                  className="text-xs font-medium text-glow-orange hover:text-glow-orange/80 transition-colors px-2 py-0.5 rounded-md hover:bg-glow-orange/10"
                >
                  Max
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 p-1 rounded-xl bg-muted/50 border border-border/50">
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
          </div>

          {/* Estimated Rewards - Animated */}
          <div className="bg-muted/30 rounded-2xl p-4 border border-border/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <div className="relative flex justify-between items-end">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Est. Weekly Rewards
                </div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={`${estimatedRewardsBreakdown.glw}-${estimatedRewardsBreakdown.pd}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-lg md:text-2xl font-bold font-mono text-green-600 dark:text-[#D1FF4D]" // Glow Green-ish
                    >
                      {(isMultiAssetEstimatedRewards
                        ? estimatedRewardsBreakdown.glw
                        : estimatedRewards
                      ).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-sm text-green-600/70 dark:text-[#D1FF4D]/70 font-medium">
                    {isMultiAssetEstimatedRewards ? "GLW +" : "GLW"}
                  </span>
                  {isMultiAssetEstimatedRewards ? (
                    <>
                      <span className="text-lg md:text-xl font-bold font-mono text-green-600 dark:text-[#D1FF4D]">
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
                    </>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground/80 mb-1">
                  Value
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

          {/* Payment Method */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground/80">
              {runtimeSelectedCurrency === "USDC"
                ? "Select Currency"
                : "Delegation Source"}
            </label>
            <div className="space-y-2">
              {/* Option: GLW */}
              {(runtimeSelectedCurrency === "GLW" ||
                runtimeSelectedCurrency === "USDC") && (
                <PaymentOption
                  label="Glow (GLW)"
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
                      ? "Delegation amount"
                      : undefined
                  }
                />
              )}
              {runtimeSelectedCurrency === "SGCTL" && showStakedSgctlOption && (
                <PaymentOption
                  label="Staked (SGCTL)"
                  balance={`${formatTokenAmount(
                    stakedGctlBalance,
                    6,
                    "0",
                    6,
                  )} SGCTL in region`}
                  icon={<TokenIcon symbol="GCTL" />}
                  selected={selectedPaymentMethod === "SGCTL"}
                  onSelect={() => setSelectedPaymentMethod("SGCTL")}
                  isBalanceInsufficient={
                    isConnected &&
                    selectedPaymentMethod === "SGCTL" &&
                    !affordability.canSubmit
                  }
                  pricePreview={requiredDisplayByMethod.SGCTL}
                  previewLabel="Delegation amount"
                />
              )}
              {runtimeSelectedCurrency === "SGCTL" &&
                !showStakedSgctlOption && (
                  <PaymentOption
                    label="Control (GCTL)"
                    balance={`${formatTokenAmount(gctlWalletBalance, 6, "0", 6)} wallet`}
                    icon={<TokenIcon symbol="GCTL" />}
                    selected={selectedPaymentMethod === "GCTL"}
                    onSelect={() => setSelectedPaymentMethod("GCTL")}
                    isBalanceInsufficient={
                      isConnected &&
                      selectedPaymentMethod === "GCTL" &&
                      !affordability.canSubmit
                    }
                    pricePreview={requiredDisplayByMethod.GCTL}
                    previewLabel="Source amount"
                  />
                )}
              {/* Option: USDC */}
              <PaymentOption
                label="USD Coin (USDC)"
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
                    ? "Source cost"
                    : runtimeSelectedCurrency === "GLW"
                      ? "Swap cost"
                      : undefined
                }
              />
              {/* Option: ETH */}
              <PaymentOption
                label="Ethereum (ETH)"
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
                    ? "Source cost"
                    : runtimeSelectedCurrency === "GLW"
                      ? "Swap cost"
                      : undefined
                }
              />
            </div>
            {sgctlFundingBreakdown ? (
              <div className="rounded-xl border border-border/20 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {sgctlFundingBreakdown}
              </div>
            ) : null}
          </div>
        </div>

        <div className="p-6 bg-muted/20 border-t border-border mt-6">
          {runtimeSelectedCurrency !== "USDC" && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {runtimeSelectedCurrency === "SGCTL"
                  ? "You Delegate"
                  : "Delegation Amount"}
              </span>
              <div className="text-right text-sm font-semibold font-mono">
                {delegatedAmountLabel}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold">
              {runtimeSelectedCurrency === "SGCTL"
                ? "Source Cost"
                : runtimeSelectedCurrency === "GLW" &&
                    selectedPaymentMethod !== "GLW"
                  ? "Swap Cost"
                  : "Total"}
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
                  ? "Stable"
                  : `≈ $${costInUSDC(quantity).toLocaleString()}`}
              </div>
            </div>
          </div>

          <div className="relative">
            {!isConnected ? (
              <ConnectButton size="medium" variant="default" />
            ) : (
              <Button
                className="w-full"
                onClick={handleConfirm}
                disabled={
                  isSubmitting ||
                  isPreparingWalletAuthorization ||
                  !affordability.canSubmit
                }
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {!isSubmitting && isPreparingWalletAuthorization
                  ? "Preparing Wallet..."
                  : showShortfallInCta
                    ? disabledCtaLabel
                    : runtimeSelectedCurrency === "SGCTL"
                      ? sgctlSourceMode === "staked"
                        ? "Confirm Delegation"
                        : sgctlSourceMode === "wallet_gctl"
                          ? "Stake & Delegate"
                          : "Mint, Stake & Delegate"
                      : runtimeSelectedCurrency === "GLW"
                        ? selectedPaymentMethod !== "GLW"
                          ? "Swap & Delegate"
                          : "Confirm Delegation"
                        : "Confirm Purchase"}
              </Button>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="md:max-w-md p-0 gap-0 bg-background border border-border/20 text-foreground max-h-[90vh] overflow-y-auto overflow-x-hidden sm:rounded-3xl"
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
  if (disabled) return null;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200",
        selected
          ? "bg-glow-orange/5 border-glow-orange/40"
          : "bg-transparent border-border/20 hover:bg-glow-orange/5 hover:border-glow-orange/40",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border border-border/20">
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
            Balance: {balance}
          </div>
        </div>
      </div>
      <div className="text-right">
        {previewLabel ? (
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {previewLabel}
          </div>
        ) : null}
        <div className="text-sm font-medium text-foreground">
          {pricePreview}
        </div>
        {selected && (
          <div className="h-2 w-2 rounded-full bg-primary ml-auto mt-1" />
        )}
      </div>
    </div>
  );
}

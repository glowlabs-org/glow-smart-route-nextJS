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
  useOffchainFractions,
} from "@glowlabs-org/utils/browser";
import { useQueryClient } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";
import { useEthPrice } from "@/hooks/useEthPrice";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { useSponsorApplication, type AuctionApplication } from "@/hooks";
import { useWallets } from "@/hooks/control-wallets";
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
  type TransactionStep,
  type StepStatus,
} from "@/components/transaction-stepper";
import { EmissionsIcon, VaultIcon } from "@/components/impact-icons";

import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";
import {
  CONTRACT_ERROR_MESSAGES,
  RPC_INTERNAL_ERROR_MESSAGE,
  calculateAffordability,
  calculateCostInETH,
  calculateCostInGCTL,
  calculateCostInGLW,
  calculateCostInUSDC,
  calculateEstimatedRewards,
  calculateImpactPointsBreakdown,
  calculateSuccessMetrics,
  clampQuantity,
  findErrorInMessage,
  generateShareUrl,
  getErrorCode,
  getErrorMessage,
  getSwapVolatilityErrorMessage,
  initializeTransactionSteps,
  isInternalRpcError,
  parseQuantityInput,
  requiresSmartAccountCheck,
  resolveRuntimeSelectedCurrency,
  withInternalRpcRetry,
  type DepositPaymentMethod,
  type DepositSelectedCurrency,
  type SgctlSourceMode,
  type SuccessMetrics,
} from "./deposit-dialog-utils";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { useIsMobile } from "@/hooks/use-mobile";

export type LaunchpadRewardScore = {
  userWeeklyGlwRewards: string;
  userWeeklyPdRewards: string;
};

export type MiningCenterScore = {
  miningScore: number;
  weeklyGlwRewards?: string;
  weeklyGlwRewardsUsd?: string;
};

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

type Phase = "review" | "processing" | "success" | "error";

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
  const { signer } = useEthersSigner();
  const { data: walletClient } = useWalletClient();
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
  const runtimeSelectedCurrency = React.useMemo(
    () =>
      resolveRuntimeSelectedCurrency(
        selectedCurrency,
        application?.activeFraction ?? null
      ),
    [application?.activeFraction, selectedCurrency]
  );
  const regionId = application?.zone?.id ?? null;
  const controlChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID);

  const { walletDetails } = useWallets({
    walletAddress: address ?? undefined,
    enabled:
      open &&
      runtimeSelectedCurrency === "SGCTL" &&
      Boolean(address),
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

  const stakedGctlBalance = React.useMemo(() => {
    if (runtimeSelectedCurrency !== "SGCTL" || !regionId) return 0n;
    const rows = (walletDetails as any)?.regions ?? [];
    const row = rows.find(
      (item: any) => Number(item?.regionId ?? item?.id) === regionId
    );
    if (!row?.totalStaked) return 0n;
    try {
      return BigInt(row.totalStaked);
    } catch {
      return 0n;
    }
  }, [regionId, runtimeSelectedCurrency, walletDetails]);

  // State
  const [quantity, setQuantity] = React.useState<number>(1);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    React.useState<DepositPaymentMethod>(
      selectedCurrency === "GLW" ? "GLW" : "USDC"
    );
  const [isSmartAccountWarningOpen, setIsSmartAccountWarningOpen] =
    React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
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

  const costInGLW = React.useCallback(
    (qty: number) =>
      calculateCostInGLW(qty, application?.activeFraction ?? null),
    [application?.activeFraction]
  );

  const costInGCTL = React.useCallback(
    (qty: number) =>
      calculateCostInGCTL(qty, application?.activeFraction ?? null),
    [application?.activeFraction]
  );

  const costInUSDC = React.useCallback(
    (qty: number) =>
      calculateCostInUSDC(
        qty,
        application?.activeFraction ?? null,
        runtimeSelectedCurrency,
        glwSpotPrice,
        gctlPriceNumber
      ),
    [
      application?.activeFraction,
      gctlPriceNumber,
      glwSpotPrice,
      runtimeSelectedCurrency,
    ]
  );

  const costInETH = React.useCallback(
    (qty: number) =>
      calculateCostInETH(
        qty,
        application?.activeFraction ?? null,
        runtimeSelectedCurrency,
        glwSpotPrice,
        ethSpotPrice,
        gctlPriceNumber
      ),
    [
      application?.activeFraction,
      ethSpotPrice,
      gctlPriceNumber,
      glwSpotPrice,
      runtimeSelectedCurrency,
    ]
  );

  // Smart auto-selection of payment method on open/connect
  React.useEffect(() => {
    if (open && isConnected && application) {
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
        const requiredGctl = BigInt(application.activeFraction?.step ?? "0");
        const availableGctl = (gctlBalance ?? 0n) + stakedGctlBalance;

        if (availableGctl >= requiredGctl) {
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
    isConnected,
    ethBalance,
    gctlBalance,
    usdcBalance,
    glwBalance,
    runtimeSelectedCurrency,
    application,
    costInGLW,
    stakedGctlBalance,
  ]);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setQuantity(1);
      setIsSubmitting(false);
      setPhase("review");
      setTransactionSteps([]);
      stepsRef.current = [];
      setTxHash(null);
      setErrorMessage(null);
      setIsInsufficientSharesError(false);
      setSuccessMetrics(null);
    }
  }, [open]);

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
        glwSpotPrice,
        gctlSpotPrice: gctlPriceNumber,
        ethSpotPrice,
        glwBalance: glwBalance ?? 0n,
        gctlBalance: gctlBalance ?? 0n,
        stakedGctlBalance,
        usdcBalance: usdcBalance ?? 0n,
        ethBalance: ethBalance ?? 0n,
      }),
    [
      application?.activeFraction,
      gctlBalance,
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
    ]
  );

  const formatTokenAmount = React.useCallback(
    (
      amount: bigint | null,
      decimals: number,
      fallback: string,
      maxFractionDigitsOverride?: number
    ) => {
      if (amount == null) return fallback;
      const maxFractionDigits =
        maxFractionDigitsOverride ?? (decimals === 18 ? 4 : 2);
      return parseFloat(formatUnits(amount, decimals)).toLocaleString(
        undefined,
        {
          minimumFractionDigits: 0,
          maximumFractionDigits: maxFractionDigits,
        }
      );
    },
    []
  );

  const requiredDisplayByMethod = React.useMemo(
    () => ({
      GLW: `${formatTokenAmount(
        affordability.requiredByMethod.GLW,
        18,
        costInGLW(quantity).toLocaleString()
      )} GLW`,
      GCTL: `${formatTokenAmount(
        affordability.requiredByMethod.GCTL,
        6,
        costInGCTL(quantity).toLocaleString(),
        6
      )} GCTL`,
      USDC: `${formatTokenAmount(
        affordability.requiredByMethod.USDC,
        6,
        costInUSDC(quantity).toLocaleString()
      )} USDC`,
      ETH: `${formatTokenAmount(
        affordability.requiredByMethod.ETH,
        18,
        costInETH(quantity).toFixed(4)
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
    ]
  );

  const shortfallByMethod = React.useMemo(() => {
    const calcShortfall = (
      required: bigint | null,
      balance: bigint | null | undefined
    ) => {
      if (required == null) return 0n;
      const safeBalance = balance ?? 0n;
      return safeBalance >= required ? 0n : required - safeBalance;
    };

    return {
      GLW: calcShortfall(affordability.requiredByMethod.GLW, glwBalance),
      GCTL: calcShortfall(
        affordability.requiredByMethod.GCTL,
        affordability.balances.GCTL
      ),
      USDC: calcShortfall(affordability.requiredByMethod.USDC, usdcBalance),
      ETH: calcShortfall(affordability.requiredByMethod.ETH, ethBalance),
    } as const;
  }, [
    affordability.balances.GCTL,
    affordability.requiredByMethod,
    ethBalance,
    glwBalance,
    usdcBalance,
  ]);

  const selectedShortfall = shortfallByMethod[selectedPaymentMethod];
  const shortfallDecimals =
    selectedPaymentMethod === "ETH" || selectedPaymentMethod === "GLW"
      ? 18
      : 6;
  const showShortfallInCta =
    isConnected &&
    !isSubmitting &&
    !affordability.canSubmit &&
    selectedShortfall > 0n;
  const disabledCtaLabel = `Need +${formatTokenAmount(
    selectedShortfall,
    shortfallDecimals,
    "0",
    6
  )} ${selectedPaymentMethod}${
    runtimeSelectedCurrency === "GLW" && selectedPaymentMethod === "USDC"
      ? " (swap buffer)"
      : ""
  }`;

  const sgctlRequiredAmount = affordability.requiredByMethod.GCTL ?? 0n;
  const sgctlShortfall =
    sgctlRequiredAmount > stakedGctlBalance
      ? sgctlRequiredAmount - stakedGctlBalance
      : 0n;
  const sgctlSourceMode = React.useMemo<SgctlSourceMode | null>(() => {
    if (runtimeSelectedCurrency !== "SGCTL") return null;
    if (sgctlShortfall <= 0n) return "staked";
    if (selectedPaymentMethod === "GCTL") return "wallet_gctl";
    if (selectedPaymentMethod === "ETH") return "mint_eth";
    return "mint_usdc";
  }, [runtimeSelectedCurrency, selectedPaymentMethod, sgctlShortfall]);

  const estimatedRewards = React.useMemo(
    () =>
      calculateEstimatedRewards(
        quantity,
        application?.activeFraction ?? null,
        rewardScore ?? null
      ),
    [quantity, application?.activeFraction, rewardScore]
  );

  // Estimated weekly impact points based on GLOW-IMPACT-SCORE.md rules:
  // - Emissions: +1 point per GLW earned in emission rewards
  // - Vault bonus: +0.005 points per week per GLW delegated (launchpad only)
  const impactPointsBreakdown = React.useMemo(
    () =>
      calculateImpactPointsBreakdown(
        quantity,
        application?.activeFraction ?? null,
        rewardScore ?? null,
        costInGLW,
        { includeVaultBonus: runtimeSelectedCurrency === "GLW" }
      ),
    [
      quantity,
      application?.activeFraction,
      rewardScore,
      costInGLW,
      runtimeSelectedCurrency,
    ]
  );

  const maxQuantity = application?.activeFraction?.remainingSteps ?? 0;

  // Handlers
  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => clampQuantity(prev + delta, 1, maxQuantity));
  };

  const handleQuantityInput = (value: string) => {
    setQuantity(parseQuantityInput(value, quantity, maxQuantity));
  };

  const handleSmartAccountCheck = async () => {
    if (!requiresSmartAccountCheck(runtimeSelectedCurrency)) {
      return true;
    }
    if (!signer || !walletClient || !address) return true;
    try {
      const status = await getSmartAccountStatus({
        address: address as `0x${string}`,
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

  const fractionsHook = useOffchainFractions(
    walletClient,
    publicClient,
    chainId
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
    extras?: { txHash?: string; errorMessage?: string }
  ) => {
    setTransactionSteps((prev) => {
      const updated = prev.map((s) => {
        if (s.id === stepId) {
          return {
            ...s,
            status,
            startedAt:
              status === "waiting_signature" || status === "confirming"
                ? s.startedAt ?? Date.now()
                : s.startedAt,
            txHash: extras?.txHash ?? s.txHash,
            errorMessage: extras?.errorMessage ?? s.errorMessage,
          };
        }
        return s;
      });
      stepsRef.current = updated;
      return updated;
    });
  };

  const confirmPurchaseInSplits = React.useCallback(async () => {
    const initialPurchased = splitsSummary?.totalStepsPurchased || 0;
    let confirmed = false;

    for (let i = 0; i < 30; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const res = await refetchSplits();
      if (res.data && res.data.summary.totalStepsPurchased > initialPurchased) {
        confirmed = true;
        break;
      }
    }

    if (!confirmed) {
      console.warn(
        "Purchase confirmation timed out, but transaction was submitted."
      );
    }
  }, [refetchSplits, splitsSummary?.totalStepsPurchased]);

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
    [address, chainId, invalidateGctlQueries, queryClient, runtimeSelectedCurrency]
  );

  const handleConfirm = async () => {
    if (!isConnected || !application?.activeFraction) return;

    // Check smart account
    const isSafe = await handleSmartAccountCheck();
    if (!isSafe) return;

    const isSwapDelegate =
      runtimeSelectedCurrency === "GLW" && selectedPaymentMethod !== "GLW";

    try {
      setIsSubmitting(true);
      setPhase("processing");
      setErrorMessage(null);

      const { activeFraction } = application;
      const userAddress = address as `0x${string}`;

      const steps = initializeTransactionSteps(runtimeSelectedCurrency, selectedPaymentMethod, {
        sgctlSource: sgctlSourceMode ?? undefined,
      });
      stepsRef.current = steps;
      setTransactionSteps(steps);

      if (runtimeSelectedCurrency === "SGCTL") {
        if (!signer) {
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
            amountAtomic: sgctlShortfall,
            stepIds: {
              sign: "STAKE_GCTL",
              submit: "STAKE_GCTL",
            },
            updateStepStatus,
          });
        } else if (sgctlSourceMode === "mint_usdc") {
          const requiredUsdc = affordability.requiredByMethod.USDC;
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
        } else if (sgctlSourceMode === "mint_eth") {
          const requiredUsdc = affordability.requiredByMethod.USDC;
          if (requiredUsdc == null || requiredUsdc <= 0n) {
            throw new Error("Unable to determine the USDC amount required");
          }
          updateStepStatus("SWAP_ETH_TO_USDC", "waiting_signature");
          await mintAndStakeGctlToRegion({
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
        }

        updateStepStatus("DELEGATE_SGCTL", "waiting_signature");
        const latestNonce = await getControlRouter().fetchLastNonce(
          address as string
        );
        const nonce = (Number(latestNonce) + 1).toString();
        const deadline = Math.floor(Date.now() / 1000 + 3600).toString();
        const signatureMessage = buildDelegateSgctlMessage({
          nonce,
          amount: sgctlRequiredAmount.toString(),
          applicationId: application.id,
          fractionId: activeFraction.id,
          deadline,
        });

        const delegateTypes =
          delegateSgctlEIP712Types as unknown as Record<string, any[]>;
        const signature = await signer.signTypedData(
          stakeControlEIP712Domain(controlChainId),
          delegateTypes,
          signatureMessage
        );

        if (!signature) {
          throw new Error("Failed to sign SGCTL delegation");
        }

        updateStepStatus("DELEGATE_SGCTL", "confirming");
        const delegationResult = await getControlRouter().delegateSgctl({
          wallet: address as string,
          applicationId: application.id,
          fractionId: activeFraction.id,
          amount: sgctlRequiredAmount.toString(),
          signature,
          deadline,
          nonce,
        });
        updateStepStatus("DELEGATE_SGCTL", "completed");
        updateStepStatus("CONFIRM_TX", "confirming");

        await confirmPurchaseInSplits();
        setSuccessMetrics(calculateSuccessMetrics(activeFraction, quantity));

        await sponsorMutation.mutateAsync({
          applicationId: application.id,
          amount: sgctlRequiredAmount,
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
              application_id: application.id,
              fraction_id: activeFraction.id,
              quantity,
              tx_hash: null,
              farm_name: application.farmName ?? null,
              zone_name: application.zone?.name ?? null,
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
          const glwNeeded = BigInt(activeFraction.step) * BigInt(quantity);
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
        const glwNeeded = BigInt(activeFraction.step) * BigInt(quantity);
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
        }
      );

      updateStepStatus(activeStepId, "completed", { txHash });

      // --- 4. Confirm & Sponsor ---
      updateStepStatus("CONFIRM_TX", "confirming");
      setTxHash(txHash);

      await confirmPurchaseInSplits();

      setSuccessMetrics(calculateSuccessMetrics(activeFraction, quantity));

      const costBigInt =
        runtimeSelectedCurrency === "USDC"
          ? BigInt(activeFraction.stepPrice) * BigInt(quantity)
          : BigInt(activeFraction.step) * BigInt(quantity);

      await sponsorMutation.mutateAsync({
        applicationId: application.id,
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
            application_id: application.id,
            fraction_id: activeFraction.id,
            quantity,
            tx_hash: txHash,
            farm_name: application.farmName ?? null,
            zone_name: application.zone?.name ?? null,
          });

          toast.success(
            runtimeSelectedCurrency === "USDC"
              ? "Miners purchased!"
              : "Delegation successful!"
          );

          void invalidatePostSuccessQueries(activeFraction.id);
          onSuccess?.();
        },
      });
    } catch (e: any) {
      console.error(e);
      const rawMsg = getErrorMessage(e) || "Transaction failed";

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
        (s) => s.status === "waiting_signature" || s.status === "confirming"
      );

      // Look up user-friendly error message from the mapping
      const knownError = CONTRACT_ERROR_MESSAGES[errorName];
      const errorConfig = knownError || findErrorInMessage(rawMsg);
      const swapVolatilityMessage = getSwapVolatilityErrorMessage(
        rawMsg,
        activeStep?.id
      );
      const msg = isRpcInternal
        ? RPC_INTERNAL_ERROR_MESSAGE
        : errorConfig?.message || swapVolatilityMessage || rawMsg;
      const shouldRefresh = isRpcInternal
        ? false
        : errorConfig?.shouldRefresh ?? false;

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
        const normalizedError = e instanceof Error ? e : new Error(String(rawMsg));
        Sentry.captureException(normalizedError, {
          tags: { marketplaceStage: "deposit" },
          extra: {
            currency: runtimeSelectedCurrency,
            paymentMethod: selectedPaymentMethod,
            delegationSource: sgctlSourceMode,
            applicationId: application?.id,
            fractionId: application?.activeFraction?.id,
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

  const shareUrl = React.useMemo(
    () =>
      generateShareUrl(
        runtimeSelectedCurrency,
        quantity,
        farmLabelForShare,
        Boolean(successMetrics)
      ),
    [runtimeSelectedCurrency, farmLabelForShare, successMetrics, quantity]
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

  const successDetails: TransactionDetail[] = application?.activeFraction
    ? (() => {
        const totalCost =
          runtimeSelectedCurrency === "USDC"
            ? BigInt(application.activeFraction.stepPrice) * BigInt(quantity)
            : BigInt(application.activeFraction.step) * BigInt(quantity);

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
            label: runtimeSelectedCurrency === "USDC" ? "Total USDC" : delegatedLabel,
            value: formatNumber(
              parseFloat(
                formatUnits(
                  totalCost,
                  DECIMALS_BY_TOKEN[runtimeSelectedCurrency]
                )
              ),
              0
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
                Math.floor(successMetrics.userSteps)
            )
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

          {estimatedRewards > 0 ? (
            <div className="space-y-3">
              <div
                className={cn(
                  "w-full rounded-2xl p-4 border",
                  runtimeSelectedCurrency === "USDC"
                    ? "bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10 border-blue-500/20"
                    : "bg-gradient-to-r from-green-500/10 via-[#D1FF4D]/10 to-green-500/10 border-green-500/20"
                )}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Projected Weekly Rewards
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={cn(
                          "text-xl sm:text-2xl font-bold font-mono",
                          runtimeSelectedCurrency === "USDC"
                            ? "text-blue-600 dark:text-cyan-400"
                            : "text-green-600 dark:text-[#D1FF4D]"
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
                            : "text-green-600/70 dark:text-[#D1FF4D]/70"
                        )}
                      >
                        GLW
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground/80 mb-1">
                      ≈ Value
                    </div>
                    <div className="text-sm text-foreground/80 font-mono">
                      $
                      {(estimatedRewards * (glwSpotPrice || 0)).toLocaleString(
                        undefined,
                        { maximumFractionDigits: 2 }
                      )}
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
                          { maximumFractionDigits: 2 }
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
                            { maximumFractionDigits: 2 }
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

    if (phase === "processing" || phase === "error") {
      const hasError = phase === "error";

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
              {hasError ? "Transaction Failed" : "Processing Transaction"}
            </motion.div>
            <motion.div
              className="text-muted-foreground text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {hasError
                ? "There was an error processing your transaction."
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
          ) : hasError && errorMessage ? (
            /* Error message only when no steps exist */
            <motion.div
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-sm text-red-500 break-words">{errorMessage}</p>
            </motion.div>
          ) : null}

          {/* Error actions */}
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
                  onClick={() => setQuantity(maxQuantity)}
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
                type="number"
                value={quantity}
                onChange={(e) => handleQuantityInput(e.target.value)}
                onBlur={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (isNaN(val) || val < 1) {
                    setQuantity(1);
                  } else if (val > maxQuantity) {
                    setQuantity(maxQuantity);
                  }
                }}
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
                <div className="flex items-baseline gap-1.5">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={estimatedRewards}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-lg md:text-2xl font-bold font-mono text-green-600 dark:text-[#D1FF4D]" // Glow Green-ish
                    >
                      {estimatedRewards.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-sm text-green-600/70 dark:text-[#D1FF4D]/70 font-medium">
                    GLW
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground/80 mb-1">
                  Value
                </div>
                <div className="text-sm text-foreground/80 font-mono">
                  ≈ $
                  {(estimatedRewards * (glwSpotPrice || 0)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
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
                          formatUnits(glwBalance, 18)
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
                />
              )}
              {runtimeSelectedCurrency === "SGCTL" && (
                <PaymentOption
                  label="Control (GCTL)"
                  balance={`${formatTokenAmount(
                    gctlBalance ?? 0n,
                    6,
                    "0",
                    6
                  )} wallet • ${formatTokenAmount(
                    stakedGctlBalance,
                    6,
                    "0",
                    6
                  )} staked`}
                  icon={<TokenIcon symbol="GCTL" />}
                  selected={selectedPaymentMethod === "GCTL"}
                  onSelect={() => setSelectedPaymentMethod("GCTL")}
                  isBalanceInsufficient={
                    isConnected &&
                    selectedPaymentMethod === "GCTL" &&
                    !affordability.canSubmit
                  }
                  pricePreview={requiredDisplayByMethod.GCTL}
                />
              )}
              {/* Option: USDC */}
              <PaymentOption
                label="USD Coin (USDC)"
                balance={
                  usdcBalance
                    ? `${parseFloat(
                        formatUnits(usdcBalance, 6)
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
              />
              {/* Option: ETH */}
              <PaymentOption
                label="Ethereum (ETH)"
                balance={
                  ethBalance
                    ? `${parseFloat(formatUnits(ethBalance, 18)).toFixed(
                        4
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
              />
            </div>
          </div>
        </div>

        <div className="p-6 bg-muted/20 border-t border-border mt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold">Total</span>
            <div className="text-right">
              <div className="text-xl font-bold font-mono">
                {selectedPaymentMethod === "GLW" && requiredDisplayByMethod.GLW}
                {selectedPaymentMethod === "GCTL" && requiredDisplayByMethod.GCTL}
                {selectedPaymentMethod === "USDC" &&
                  `$${formatTokenAmount(
                    affordability.requiredByMethod.USDC,
                    6,
                    costInUSDC(quantity).toLocaleString()
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
                disabled={isSubmitting || !affordability.canSubmit}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {showShortfallInCta
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
}: {
  label: string;
  balance: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  isBalanceInsufficient?: boolean;
  pricePreview: string;
}) {
  if (disabled) return null;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200",
        selected
          ? "bg-glow-orange/5 border-glow-orange/40"
          : "bg-transparent border-border/20 hover:bg-glow-orange/5 hover:border-glow-orange/40"
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
              isBalanceInsufficient ? "text-red-500" : "text-muted-foreground"
            )}
          >
            Balance: {balance}
          </div>
        </div>
      </div>
      <div className="text-right">
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

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
  Zap,
  AlertCircle,
} from "lucide-react";
import { PointsIcon } from "@/components/impact-icons";
import { mainnet, sepolia } from "wagmi/chains";
import {
  useFundWallet,
  useLogin,
  usePrivy,
} from "@privy-io/react-auth";
import { capturePrivyWalletError } from "@/lib/privy-errors";
import { GlowSymbol } from "@/components/glow-symbol";
import { cn } from "@/lib/utils";
import { useAccount, useChainId, useSwitchChain, useConnectorClient } from "wagmi";
import { resolveWalletChainId, chainIdToName } from "@/lib/tos-chain";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { SegmentedCircleProgress } from "@/components/ui/circle-progress";
import { formatNumber } from "./utils";
import { formatUnits } from "viem";
import {
  DECIMALS_BY_TOKEN,
} from "@glowlabs-org/utils/browser";
import { useQueryClient } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";
import { useEthPrice } from "@/hooks/useEthPrice";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import {
  earlyAccessQueryDiscriminator,
  fetchSponsorListings,
  useRewardsBreakdown,
  useSponsorApplication,
  type AuctionApplication,
} from "@/hooks";
import { useMinerEarlyAccessSignature } from "@/hooks/v2-early-access";
import {
  useWalletRegionAvailableStake,
  useWallets,
} from "@/hooks/control-wallets";
import { useGctlPreparationOrchestrator } from "@/hooks/useGctlPreparationOrchestrator";
import { ConnectButton } from "@/components/connect-button";
import { trackEvent } from "@/lib/telemetry";
import { AnimatePresence, motion } from "framer-motion";
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
import { NetworkRequirementBanner } from "@/components/dialogs/network-requirement-banner";

import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";
import { usePatchedOffchainFractions } from "@/hooks/usePatchedOffchainFractions";
import {
  calculateAffordability,
  calculateCostInETH,
  calculateCostInGCTL,
  calculateCostInGLW,
  calculateCostInUSDC,
  calculateEstimatedRewardsBreakdown,
  calculateShortfall,
  clampQuantity,
  coerceToBigInt,
  getDefaultPaymentMethodForRuntimeCurrency,
  generateShareUrl,
  hasConfirmedSplitPurchase,
  getInitialPositionValueGuard,
  MIN_INITIAL_POSITION_USD,
  parseAvailableStakeSnapshot,
  parseQuantityInput,
  requiresSmartAccountCheck,
  resolveDelegationStepAtomic,
  resolveRuntimeSelectedCurrency,
  selectClaimSetForGlwDelegation,
  SPLIT_CONFIRMATION_DELAYED_MESSAGE,
  updateTransactionStepStatus,
  type ClaimSetSelection,
  type DepositPaymentMethod,
  type SgctlSourceMode,
  type SuccessMetrics,
  type TransactionStep,
} from "./deposit-dialog-utils";
import { useUnclaimedGlwForDelegation } from "@/hooks/useUnclaimedGlwForDelegation";
import { useRewardsKernelWrapper } from "@/hooks/useRewardsKernelWrapper";
import { QUERY_KEYS } from "@/hooks/query-keys";
import {
  usePostSuccessSync,
} from "@/hooks/usePostSuccessSync";
import { useStakeSyncDelegation } from "@/hooks/useStakeSyncDelegation";
import {
  useDepositConfirm,
  type Phase,
} from "@/hooks/useDepositConfirm";
import { useV2PointsBalance, useV2PointsRates } from "@/hooks/v2-points";
import { useEstimatedAllocation } from "@/hooks/v2-impact";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  resolveGlwRemainingSteps,
  resolveSgctlRemainingUnits,
} from "@/hooks/hub-listings";
import { resolveLaunchpadDelegationUnitCount } from "@/utils/launchpad-rewards";
import { isBeforePublicVisibleAt } from "@/utils/launchpad-card-legs";
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

type DepositDialogProps =
  | {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      application: AuctionApplication | null;
      // GLW and sGCTL are both launchpad delegation legs; the caller picks the
      // explicit leg (no more phase-driven auto-flip). sGCTL entry points are
      // only surfaced by the card when the wallet is eligible.
      selectedCurrency: "GLW" | "SGCTL";
      rewardScore?: LaunchpadRewardScore | null;
      onSuccess?: () => void;
      evergreen?: never;
    }
  | {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      application: AuctionApplication | null;
      selectedCurrency: "USDC";
      rewardScore?: MiningCenterScore | null;
      onSuccess?: () => void;
      /**
       * When buying a PRIVATE evergreen listing, the pre-buy refetch must query
       * the evergreen surface (the public miner feed excludes evergreen rows),
       * else it would miss the listing and fall back to stale data.
       */
      evergreen?: boolean;
    };

// Icon Helpers (module scope so the component identity is stable across renders)
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

// Zero-width spaces keep the share text from auto-linking the domain.
const APP_DOMAIN_PLAIN_TEXT = "app.\u200Bglow.\u200Borg";

// Token balance (atomic bigint, or null) -> JS number; 0 when absent.
const toNum = (balance: bigint | null | undefined, decimals: number) =>
  balance ? parseFloat(formatUnits(balance, decimals)) : 0;

export function DepositDialog({
  open,
  onOpenChange,
  application,
  selectedCurrency,
  rewardScore,
  onSuccess,
  evergreen,
}: DepositDialogProps) {
  const { t } = useLang();
  const dd = t.routes.depositDialog;
  const { isConnected, address, connector } = useAccount();
  // V2 early access: reuse the module-scoped signature unlocked in the
  // marketplace view (never prompts here). When present, the pre-buy refetch
  // resolves the wallet's EARLY listing (correct inventory/pricing/asset) so an
  // entitled holder doesn't fall back to the public-bucket listing.
  const { header: earlyAccessHeader } = useMinerEarlyAccessSignature();
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
  // Wrong-network detection. wagmi's useChainId() tracks the app's configured
  // chain, so a wallet on an unconfigured network (e.g. BNB) is invisible to it.
  // Resolve the wallet's actual chain straight from the connector/provider.
  const { data: connectorClient } = useConnectorClient();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const expectedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 1;
  const [activeWalletChainId, setActiveWalletChainId] = React.useState<
    number | undefined
  >(chainId);
  React.useEffect(() => {
    if (!isConnected) {
      setActiveWalletChainId(undefined);
      return;
    }
    let cancelled = false;
    void resolveWalletChainId({
      connectorClient: connectorClient as
        | {
            request?: (args: {
              method: string;
              params?: unknown[];
            }) => Promise<unknown>;
          }
        | undefined,
      signerProvider: signer?.provider as
        | {
            send?: (method: string, params: unknown[]) => Promise<unknown>;
            getNetwork?: () => Promise<{ chainId?: unknown }>;
          }
        | undefined,
      fallbackChainId: chainId,
    }).then((resolved) => {
      if (!cancelled && typeof resolved === "number") {
        setActiveWalletChainId(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isConnected, connectorClient, signer, chainId]);
  const effectiveWalletChainId = activeWalletChainId ?? chainId;
  const isWrongNetwork =
    isConnected &&
    typeof effectiveWalletChainId === "number" &&
    effectiveWalletChainId !== expectedChainId;
  const expectedNetworkLabel = chainIdToName(expectedChainId);
  const connectedNetworkLabel =
    typeof effectiveWalletChainId === "number"
      ? chainIdToName(effectiveWalletChainId)
      : "";
  const networkRequirementCopy = React.useMemo(
    () => ({
      title: t.wallet.networkRequirementTitle,
      connected: t.wallet.networkRequirementConnected,
      disconnected: t.wallet.networkRequirementDisconnected,
      wrong: t.wallet.networkRequirementWrong,
      switchTo: t.wallet.switchTo,
      switching: t.wallet.switching,
    }),
    [t.wallet],
  );
  const handleSwitchNetwork = React.useCallback(async () => {
    try {
      await switchChain({ chainId: expectedChainId });
      toast.success(t.wallet.switchedTo(expectedNetworkLabel));
    } catch (switchError) {
      console.error(
        "Failed to switch network in deposit dialog:",
        switchError,
      );
      toast.error(t.wallet.failedToSwitchNetwork);
    }
  }, [switchChain, expectedChainId, expectedNetworkLabel, t.wallet]);
  const { swapEthToUsdc, estimateEthToUsdc } = useSwapETHToUSDC();
  const { swapUSDCToUSDG } = useSwapUSDCToUSDG();
  const { swap: swapUsdgToGlow } = useSwap({
    tokenA_address: addresses.usdg,
    tokenB_address: addresses.glow,
  });
  const [liveApplication, setLiveApplication] =
    React.useState<AuctionApplication | null>(null);
  const effectiveApplication = liveApplication ?? application;
  // Mining-center fills are POINTS-ONLY (no watts / no farm impact); identify by
  // the active fraction's type, never by payment currency (USDC-paid GLW
  // delegations still earn watts).
  const isMiningCenter =
    effectiveApplication?.activeFraction?.type === "mining-center";
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

  const {
    invalidatePostSuccessQueries,
    syncFreshPostSuccessCaches,
    schedulePostSuccessRefreshes,
    applyOptimisticPostSuccessUpdates,
  } = usePostSuccessSync({
    open,
    address,
    chainId,
    runtimeSelectedCurrency,
    invalidateGctlQueries,
  });

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

  // V2 points: snapshot the wallet's balance before the purchase so the
  // success screen can show the points this action granted. The award is
  // credited asynchronously once the on-chain delegation is processed, so
  // the delta may still be 0 at the moment the success screen renders;
  // invalidating the balance query lets it update live.
  const { data: v2PointsBalance } = useV2PointsBalance(address);
  const pointsBeforeRef = React.useRef<number | null>(null);
  // The quantity actually submitted, captured at confirm time. The live
  // `quantity` can go stale/negative during the post-purchase listing refetch,
  // so the success card uses this snapshot to show what was delegated.
  const submittedQuantityRef = React.useRef<number | null>(null);

  const fetchLatestApplication = React.useCallback(async () => {
    if (!application?.id) return application;

    const filters =
      selectedCurrency === "USDC"
        ? evergreen
          ? ({
              includeFilled: true,
              type: "mining-center",
              evergreen: true,
            } as const)
          : ({ includeFilled: true, type: "mining-center" } as const)
        : ({ includeFilled: true } as const);

    const listings = await queryClient.fetchQuery({
      // Match the `useSponsorListings` early-access discriminator EXACTLY so the
      // entitled refetch shares the early bucket (not the public one).
      queryKey: [
        ...QUERY_KEYS.listings.sponsor(filters),
        earlyAccessQueryDiscriminator(earlyAccessHeader),
      ],
      staleTime: 0,
      queryFn: async () =>
        await fetchSponsorListings(filters, earlyAccessHeader),
    });

    return listings.find((item) => item.id === application.id) ?? application;
  }, [application, queryClient, selectedCurrency, earlyAccessHeader, evergreen]);

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
    // Prefer the server's quote-based points: it values the per-unit principal
    // at the application's locked GVE quote price -- the exact basis the award
    // uses -- so the preview equals what gets credited and does not drift with
    // the GLW/GCTL pool price (or the post-purchase listing refetch). The GLW
    // path uses estimatedPointsPerUnit; the sGCTL path uses
    // estimatedSgctlPointsPerUnit (sgctlStepAtomic valued at the locked quote,
    // not the live GCTL spot). Miner keeps the local rate*usd estimate until
    // its award path is quote-based too.
    const serverPerUnit =
      runtimeSelectedCurrency === "GLW"
        ? estimateQuery.data?.estimatedPointsPerUnit
        : runtimeSelectedCurrency === "SGCTL"
          ? estimateQuery.data?.estimatedSgctlPointsPerUnit
          : null;
    if (serverPerUnit != null && Number.isFinite(serverPerUnit)) {
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

  // Prefer the server's per-asset deposit-share watts (the basis that matches
  // funded computeFarmAllocation attribution), picked by the delegated asset the
  // same way serverPerUnit picks points above: GLW -> estimatedGlwWattsPerUnit,
  // sGCTL -> estimatedSgctlWattsPerUnit. Fall back to the headline
  // estimatedWattsPerUnit, which the backend already sets to the delegated
  // asset's value (or the total_steps estimate pre-funding, per wattsBasis).
  const previewWattsPerUnit =
    (runtimeSelectedCurrency === "GLW"
      ? estimateQuery.data?.estimatedGlwWattsPerUnit
      : runtimeSelectedCurrency === "SGCTL"
        ? estimateQuery.data?.estimatedSgctlWattsPerUnit
        : null) ??
    estimateQuery.data?.estimatedWattsPerUnit ??
    null;
  // Totals scale with the selected quantity (what the user actually earns). On
  // the success screen the live `quantity` can transiently go stale/negative
  // during the post-purchase listing refetch, so use the submitted snapshot
  // there; clamp to >= 0 so the estimate never renders negative.
  const previewQuantity = Math.max(
    0,
    phase === "success" && submittedQuantityRef.current != null
      ? submittedQuantityRef.current
      : quantity,
  );
  const previewPointsTotal =
    previewPointsPerUnit != null ? previewPointsPerUnit * previewQuantity : null;
  const previewWattsTotal =
    previewWattsPerUnit != null ? previewWattsPerUnit * previewQuantity : null;

  // Smart auto-selection of payment method on open/connect
  React.useEffect(() => {
    if (open && effectiveApplication) {
      if (runtimeSelectedCurrency === "GLW") {
        // Delegation: Prefer GLW if enough, else USDC, else ETH
        const costGLW = costInGLW(1);
        const glwBalNum = toNum(glwBalance, 18);
        const usdcBalNum = toNum(usdcBalance, 6);

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
      submittedQuantityRef.current = null;
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

  // Per-unit affordability (quantity = 1) so the Max button can default to the
  // largest number of units the wallet can actually afford in the selected
  // payment method, instead of the listing's full remaining steps.
  const affordabilityPerUnit = React.useMemo(
    () =>
      calculateAffordability({
        activeFraction: application?.activeFraction ?? null,
        quantity: 1,
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
      runtimeSelectedCurrency,
      selectedPaymentMethod,
      stakedGctlBalance,
      glwSpotPrice,
      usdcBalance,
      ethBalance,
      unclaimedGlw.totalGlwWei,
    ],
  );

  // Hide a swap option entirely when the connected wallet cannot cover even ONE
  // unit in that asset: a swap that can never fund a single unit should not be
  // offered. Uses the spot-priced 1-unit cost (the same basis as the row's
  // preview). When disconnected or the cost is not yet known, keep it visible.
  const ethBalanceNum = toNum(ethBalance, 18);
  const ethOneUnitCost = costInETH(1);
  const showEthOption =
    !isConnected ||
    !Number.isFinite(ethOneUnitCost) ||
    ethOneUnitCost <= 0 ||
    ethBalanceNum >= ethOneUnitCost;

  // If ETH was auto-selected (e.g. the sGCTL fallback) but is now hidden as
  // unaffordable, fall back to the currency's default method so the selection
  // never points at a hidden option.
  React.useEffect(() => {
    if (!showEthOption && selectedPaymentMethod === "ETH") {
      setSelectedPaymentMethod(
        getDefaultPaymentMethodForRuntimeCurrency(runtimeSelectedCurrency),
      );
    }
  }, [showEthOption, selectedPaymentMethod, runtimeSelectedCurrency]);

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

  // The Total row amount, in the selected payment asset. Extracted so the
  // Delegation Amount row above it can be hidden when the two are identical
  // (no swap: paying in the delegation asset itself), where the second row is
  // just redundant.
  // Same as requiredDisplayByMethod[method], except USDC renders as a $-prefixed
  // amount rather than the "... USDC" suffix form.
  const totalAmountLabel =
    selectedPaymentMethod === "USDC"
      ? `$${formatTokenAmount(
          affordability.requiredByMethod.USDC,
          6,
          costInUSDC(quantity).toLocaleString(),
        )}`
      : requiredDisplayByMethod[selectedPaymentMethod];

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
  React.useEffect(() => {
    if (runtimeSelectedCurrency !== "SGCTL") return;
    if (showStakedSgctlOption && selectedPaymentMethod === "GCTL") {
      setSelectedPaymentMethod("SGCTL");
    }
    if (!showStakedSgctlOption && selectedPaymentMethod === "SGCTL") {
      setSelectedPaymentMethod("GCTL");
    }
  }, [
    runtimeSelectedCurrency,
    selectedPaymentMethod,
    showStakedSgctlOption,
  ]);

  const ctaLabel = !isSubmitting && isPreparingWalletAuthorization
    ? dd.ctaPreparingWallet
    : isCheckingInitialPositionEligibility
      ? dd.ctaCheckingEligibility
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
        ? resolveLaunchpadDelegationUnitCount(
            effectiveApplication,
            // Use the explicit delegation leg (this dialog already knows the
            // currency) so the per-unit reward divisor matches the GLW leg's
            // unit count, not the sGCTL leg's. resolveDelegationCurrency()
            // returns "SGCTL" for dual-leg consolidated listings, which would
            // divide by the sGCTL unit count (~125) instead of the GLW count
            // (~22) and understate EST. WEEKLY REWARDS (5.0 -> 27 GLW).
            // "USDC" (mining-center) is not a delegation leg -> pass undefined
            // (the override is DelegationCurrency = "GLW" | "SGCTL").
            runtimeSelectedCurrency === "USDC"
              ? undefined
              : runtimeSelectedCurrency,
          )
        : 0,
    [effectiveApplication, runtimeSelectedCurrency],
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

  // Per-leg Max: sGCTL delegations cap on the sGCTL unit leg, GLW delegations
  // (and miner purchases, which ride the GLW step ledger) cap on the GLW leg.
  const maxQuantity =
    runtimeSelectedCurrency === "SGCTL"
      ? resolveSgctlRemainingUnits(effectiveApplication?.activeFraction)
      : resolveGlwRemainingSteps(effectiveApplication?.activeFraction);

  // sGCTL early-access gate (defense-in-depth): early access covers miners +
  // the GLW leg only. If an entitled wallet reached the sGCTL path before the
  // listing's PUBLIC visibleAt, block the buy — Control would reject it as "not
  // live yet" until the public 9 AM ET window. The card already disables the
  // sGCTL CTA early; this guards the dialog if it's opened another way.
  const sgctlNotYetOpen =
    runtimeSelectedCurrency === "SGCTL" &&
    isBeforePublicVisibleAt(effectiveApplication?.activeFraction);

  // The largest number of units the wallet can afford in the selected payment
  // method, capped by the listing's remaining steps. Drives the Max button.
  // Falls back to the availability cap when the per-unit cost isn't known yet
  // (e.g. a swap price still loading or no active fraction).
  const maxAffordableUnits = React.useMemo(() => {
    const perUnitCost =
      affordabilityPerUnit.requiredByMethod[selectedPaymentMethod];
    const balance = affordability.balances[selectedPaymentMethod];
    if (perUnitCost == null || perUnitCost <= 0n || balance == null) {
      return maxQuantity;
    }
    const affordable = Number(balance / perUnitCost);
    return clampQuantity(Math.min(maxQuantity, affordable), 1, maxQuantity);
  }, [
    affordabilityPerUnit.requiredByMethod,
    affordability.balances,
    selectedPaymentMethod,
    maxQuantity,
  ]);

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

  const { waitForStakeSyncBeforeDelegation, delegateSgctlWithRetry } =
    useStakeSyncDelegation({
      runtimeSelectedCurrency,
      address,
      regionId,
      invalidateGctlQueries,
      refetchAvailableStake,
      refetchWalletDetails,
      dd,
      updateStepStatus,
    });

  const { handleConfirm } = useDepositConfirm({
    application,
    onSuccess,
    quantity,
    selectedPaymentMethod,
    isSubmitting,
    txHash,
    setLiveApplication,
    setQuantity,
    setQuantityInput,
    setIsSubmitting,
    setPhase,
    setTransactionSteps,
    setTxHash,
    setErrorMessage,
    setIsInsufficientSharesError,
    setSuccessMetrics,
    submitInFlightRef,
    stepsRef,
    submittedQuantityRef,
    isConnected,
    address,
    connector,
    chainId,
    signer,
    walletClient,
    queryClient,
    glwSpotPrice,
    ethSpotPrice,
    usdcBalance,
    glwBalance,
    ethBalance,
    refetchBalances,
    swapEthToUsdc,
    estimateEthToUsdc,
    swapUSDCToUSDG,
    swapUsdgToGlow,
    stakeExistingGctlToRegion,
    mintAndStakeGctlToRegion,
    unclaimedGlw,
    rewardsKernelWrapper,
    claimSetSelection,
    invalidatePostSuccessQueries,
    syncFreshPostSuccessCaches,
    schedulePostSuccessRefreshes,
    applyOptimisticPostSuccessUpdates,
    waitForStakeSyncBeforeDelegation,
    delegateSgctlWithRetry,
    fractionsHook,
    sponsorMutation,
    effectiveApplication,
    runtimeSelectedCurrency,
    regionId,
    controlChainId,
    delegationStepAtomic,
    gctlPriceNumber,
    gctlWalletBalance,
    stakedGctlBalance,
    sgctlSourceMode,
    isCheckingInitialPositionEligibility,
    initialPositionValueGuard,
    initialPositionMinimumMessage,
    isPreparingWalletAuthorization,
    sgctlRequiredAmount,
    sgctlShortfall,
    fetchLatestApplication,
    handleSmartAccountCheck,
    updateStepStatus,
    confirmPurchaseInSplits,
    dd,
  });

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
            {hasExistingMinerOrDelegation && (
              <div className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-[color:var(--color-glow-green)]">
                {dd.successAddedToExisting}
              </div>
            )}
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
            <div className="w-full space-y-3">
              {/* Projected Weekly Rewards */}
              <div className="rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/30 dark:border-border/40 px-5 py-4">
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
                <div className="rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/30 dark:border-border/40 px-5 py-4 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <div className="relative">
                    <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest mb-3">
                      {dd.previewWhatYouEarn}
                    </div>
                    {/* Mining-center fills earn points only: hide the Watts column. */}
                    <div
                      className={`grid ${isMiningCenter ? "grid-cols-1" : "grid-cols-2"} gap-3`}
                    >
                      {/* Points */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 shrink-0 rounded-full bg-green-500/10 dark:bg-[#D1FF4D]/10 ring-1 ring-green-500/20 dark:ring-[#D1FF4D]/20 flex items-center justify-center">
                          <PointsIcon className="h-4 w-4 text-green-600 dark:text-[#D1FF4D]" />
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
                      {!isMiningCenter && (
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
                      )}
                    </div>
                    <p className="mt-3 text-left text-[11px] leading-relaxed text-muted-foreground/70 dark:text-muted-foreground/80">
                      {dd.successPointsCreditedBody(
                        isMiningCenter,
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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                {runtimeSelectedCurrency === "USDC"
                  ? dd.reviewTitleMiners
                  : runtimeSelectedCurrency === "SGCTL"
                    ? dd.reviewTitleSgctl
                    : dd.reviewTitleGlw}
              </DialogTitle>
              <div className="mt-1 truncate text-sm text-muted-foreground">
                {application?.farmName} • {application?.zone?.name}
              </div>
            </div>
            <NetworkRequirementBanner
              expectedNetworkLabel={expectedNetworkLabel}
              connectedNetworkLabel={connectedNetworkLabel}
              isConnected={isConnected}
              isWrongNetwork={isWrongNetwork}
              isSwitching={isSwitchingChain}
              onSwitchNetwork={handleSwitchNetwork}
              copy={networkRequirementCopy}
            />
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="space-y-4">
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
                    setQuantity(maxAffordableUnits);
                    setQuantityInput(maxAffordableUnits.toString());
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
            {/* Mining-center fills earn points only: hide the Watts column. */}
            <div
              className={`relative grid ${isMiningCenter ? "grid-cols-1" : "grid-cols-2"} gap-3`}
            >
              {/* Points (total, scales with quantity) */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 shrink-0 rounded-full bg-green-500/10 dark:bg-[#D1FF4D]/10 ring-1 ring-green-500/20 dark:ring-[#D1FF4D]/20 flex items-center justify-center">
                  <PointsIcon className="h-4 w-4 text-green-600 dark:text-[#D1FF4D]" />
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
              {!isMiningCenter && (
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
              )}
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
                !showStakedSgctlOption) && (
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
                  {/* Option: ETH (hidden when the wallet can't cover 1 unit) */}
                  {showEthOption && (
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
                  )}
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
          {runtimeSelectedCurrency !== "USDC" &&
            delegatedAmountLabel !== totalAmountLabel && (
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
              {/* Amount + the approx $ value inline in parens, so the value
                  does not take its own row. */}
              <div className="text-xl font-bold font-mono flex items-baseline justify-end gap-1.5 flex-wrap">
                <span>{totalAmountLabel}</span>
                <span className="text-xs font-medium text-muted-foreground">
                  (
                  {selectedPaymentMethod === "USDC"
                    ? dd.reviewStable
                    : dd.reviewApprox(costInUSDC(quantity).toLocaleString())}
                  )
                </span>
              </div>
            </div>
          </div>

          <div className="relative">
            {!isConnected ? (
              <ConnectButton size="medium" variant="default" />
            ) : isWrongNetwork ? (
              <div className="space-y-2">
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {t.wallet.wrongNetwork}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.wallet.wrongNetworkBody(
                      connectedNetworkLabel,
                      expectedNetworkLabel,
                    )}
                  </p>
                </div>
                <Button
                  className="w-full h-12"
                  onClick={handleSwitchNetwork}
                  disabled={isSwitchingChain}
                >
                  {isSwitchingChain && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isSwitchingChain
                    ? t.wallet.switching
                    : t.wallet.switchTo(expectedNetworkLabel)}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {sgctlNotYetOpen ? (
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                    {t.routes.launchpad.sgctlOpensAtPublicLaunch}
                  </p>
                ) : null}
                <Button
                  className="w-full h-12"
                  onClick={handleConfirm}
                  disabled={
                    isSubmitting ||
                    isPreparingWalletAuthorization ||
                    isCheckingInitialPositionEligibility ||
                    initialPositionValueGuard.isBlocked ||
                    sgctlNotYetOpen ||
                    !affordability.canSubmit
                  }
                >
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {sgctlNotYetOpen
                    ? t.routes.launchpad.sgctlOpensAtPublicLaunch
                    : ctaLabel}
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

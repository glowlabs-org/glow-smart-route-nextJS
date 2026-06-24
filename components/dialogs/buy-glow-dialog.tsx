"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  Copy,
  CreditCard,
  ExternalLink,
  HelpCircle,
  Loader2,
  Minus,
  Plus,
  X,
  Wallet,
  TrendingUp,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { GlowSymbolAnimated } from "@/components/glow-symbol-animated";
import {
  usePurchaseGlow,
  SmartBalancingAmounts,
} from "@/hooks/usePurchaseGlow";
import { useDebouncedAsync } from "@/hooks/useDebouncedAsync";
import { useSwapUSDCToUSDG } from "@/hooks/useSwapUSDCToUSDG";
import { useSwap } from "@/hooks/useSwap";
import { useEarlyLiquidityPrice } from "@/hooks/useEarlyLiquidityPrice";
import { addresses } from "@/web3/constants/addresses";
import { formatUnits, parseUnits, walletActions, type WalletClient } from "viem";
import { DECIMALS_BY_TOKEN } from "@glowlabs-org/utils/browser";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/utils/formatPrice";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { GlowSymbol } from "../glow-symbol";
import { trackEvent } from "@/lib/telemetry";
import { bucketUsd } from "@/lib/telemetry-buckets";
import { getStoredReferralAttribution } from "@/lib/referral-attribution";
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import {
  useAccount,
  useBalance,
  useChainId,
  useConnectorClient,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { useWalletTokenBalances } from "@/hooks/useWalletTokenBalances";
import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";
import { useEthPrice } from "@/hooks/useEthPrice";
import { useImpactWalletStats } from "@/hooks/hub-impact";
import {
  useEvergreenMiners,
  useMiningScore,
  getMiningScoreForApplication,
  type AuctionApplication,
} from "@/hooks";
import { usePatchedOffchainFractions } from "@/hooks/usePatchedOffchainFractions";
import { FallbackImage } from "@/components/ui/fallback-image";
import { normalizeMinerWeeksRemainingDisplay } from "@/lib/mining-score";
import {
  TransactionStepper,
  type TransactionStep,
  type StepStatus,
} from "@/components/transaction-stepper";
import { SmartAccountWarningDialog } from "@/components/wallet/smart-account-warning-dialog";
import { getSmartAccountStatus } from "@/web3/web3/utils/detectSmartAccount";
import {
  useConnectWallet,
  useFundWallet,
  useLogin,
  usePrivy,
} from "@privy-io/react-auth";
import { capturePrivyWalletError } from "@/lib/privy-errors";
import { useLang } from "@/lib/i18n";
import { NetworkRequirementBanner } from "@/components/dialogs/network-requirement-banner";
import { chainIdToName, resolveWalletChainId } from "@/lib/tos-chain";

const ONE_E18 = 1_000_000_000_000_000_000n;
const POINTS_PER_GLW_WORTH_SCALED6 = 1_000n;

function trimToDecimals(value: string, decimals: number) {
  if (!value) return "";
  const [i, f = ""] = value.split(".");
  if (!f) return i;
  return `${i}.${f.slice(0, Math.max(0, decimals))}`;
}

function formatLocaleAmount(value: string, maxFractionDigits: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
  });
}

function glwWeiToPointsScaled6(glwWei: bigint) {
  return (glwWei * POINTS_PER_GLW_WORTH_SCALED6) / ONE_E18;
}

function formatPointsScaled6(pointsScaled6: bigint, maxFractionDigits = 2) {
  const sign = pointsScaled6 < 0n ? "-" : "";
  const v = pointsScaled6 < 0n ? -pointsScaled6 : pointsScaled6;
  const i = v / 1_000_000n;

  if (maxFractionDigits <= 0) return `${sign}${i}`;

  const fFull = (v % 1_000_000n).toString().padStart(6, "0");
  const f = fFull.slice(0, Math.min(6, maxFractionDigits));
  return `${sign}${i}.${f}`;
}

function getWeeksInRange(weekRange: { startWeek: number; endWeek: number }) {
  const raw = weekRange.endWeek - weekRange.startWeek + 1;
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, raw);
}

function formatUsdAmount(
  value: number,
  {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  }: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {},
) {
  if (!Number.isFinite(value)) return "$0";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits,
    maximumFractionDigits,
  })}`;
}

// ApplicationMiningScore.weeklyGlwRewards is GLW wei (18-dec) as a string.
function parseWeeklyGlwRewards(weeklyGlwRewards?: string | null) {
  if (!weeklyGlwRewards) return null;
  try {
    const value = Number(
      formatUnits(BigInt(weeklyGlwRewards), DECIMALS_BY_TOKEN["GLW"]),
    );
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function formatMinerWeeksRemainingLabel(weeks?: number | null) {
  const resolvedWeeks = normalizeMinerWeeksRemainingDisplay(weeks) ?? 99;
  return `${resolvedWeeks} week${resolvedWeeks === 1 ? "" : "s"}`;
}

// Compact stat cell used inside the "From a miner" card (mirrors the
// launchpad / mining-center card's reward + price tiles).
function CheckoutStat({
  label,
  value,
  subvalue,
  isLoading,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  subvalue?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/20 dark:border-border/40 bg-card p-3",
        className,
      )}
    >
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {isLoading ? (
        <Skeleton className="h-6 w-24" />
      ) : (
        <div className="text-base font-semibold leading-none text-foreground tabular-nums">
          {value}
        </div>
      )}
      {subvalue && !isLoading && (
        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
          {subvalue}
        </div>
      )}
    </div>
  );
}

interface BuyGlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usdcBalance: bigint | null;
  glowSpotPrice: number;
  source?: string;
  defaultUsdcAmount?: string;
  onSuccess?: () => void;
}

type Phase = "input" | "processing" | "success" | "error";
type PayToken = "USDC" | "USDG" | "ETH";

const TOKEN_ICON_SRC_BY_SYMBOL = {
  ETH: "/images/tokens/eth.svg",
  USDC: "/images/tokens/usdc.svg",
  USDG: "/images/tokens/usdg.svg",
} as const;

function TokenIcon({ symbol }: { symbol: "ETH" | "GLW" | "USDC" | "USDG" }) {
  if (symbol === "GLW") {
    return (
      <div className="h-6 w-6 rounded-full bg-emerald-500/10 dark:bg-[color:var(--color-glow-green)]/10 border border-emerald-500/30 dark:border-[color:var(--color-glow-green)]/30 flex items-center justify-center">
        <GlowSymbol className="h-4 w-4" />
      </div>
    );
  }
  if (symbol === "USDG") {
    return (
      <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
        U
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

function PaymentOption({
  label,
  balance,
  icon,
  selected,
  onSelect,
  disabled,
  isLoading,
}: {
  label: string;
  balance: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  if (disabled) return null;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
        selected
          ? "bg-muted/50 dark:bg-muted/60 border-border/40"
          : "bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40 hover:bg-muted/40 dark:hover:bg-muted/60 hover:border-border/30",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          {isLoading ? (
            <Skeleton className="h-3.5 w-16 mt-0.5" />
          ) : (
            <div className="text-xs text-muted-foreground">{balance}</div>
          )}
        </div>
      </div>
      {selected && (
        <div className="h-4 w-4 rounded-full bg-[#4ADE80]/20 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-[#4ADE80]" />
        </div>
      )}
    </div>
  );
}

export function BuyGlowDialog({
  open,
  onOpenChange,
  usdcBalance,
  glowSpotPrice,
  source,
  defaultUsdcAmount,
  onSuccess,
}: BuyGlowDialogProps) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [phase, setPhase] = React.useState<Phase>("input");
  // Evergreen miner listings power the right "From a miner" option. Gated by
  // `enabled: open` so the private (?evergreen=true) surface is only queried
  // when the dialog is actually open, not on every page that mounts it.
  const { applications: evergreenMiners, refetch: refetchEvergreen } =
    useEvergreenMiners({ filters: { paymentCurrency: "USDC" }, enabled: open });
  // Mining score (est. weekly rewards + weeks of miner life) for the single
  // evergreen miner card. Called unconditionally; gated by `enabled: open` and
  // self-disables when there are no applications.
  const { miningScoreMap, isLoading: isMiningScoresLoading } = useMiningScore({
    applications: evergreenMiners,
    enabled: open,
  });
  const hasEvergreenMiners = evergreenMiners.length > 0;
  // Which of the two options is active (drives the shared payment + button).
  const [mode, setMode] = React.useState<"glw" | "miner">("glw");
  const [minerQty, setMinerQty] = React.useState<number>(1);
  const [minerBusy, setMinerBusy] = React.useState(false);
  const [payToken, setPayToken] = React.useState<PayToken>("USDC");
  const [inputAmount, setInputAmount] = React.useState<string>("");
  const [smartAmounts, setSmartAmounts] =
    React.useState<SmartBalancingAmounts>();
  const [estimatedGlw, setEstimatedGlw] = React.useState<string>("");
  const [lastEstimatedAmount, setLastEstimatedAmount] =
    React.useState<string>("");
  const [transactionSteps, setTransactionSteps] = React.useState<
    TransactionStep[]
  >([]);
  const stepsRef = React.useRef<TransactionStep[]>([]);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const hasPrefilledForOpenRef = React.useRef(false);
  const wasOpenRef = React.useRef(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: connectorClient } = useConnectorClient();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [isSmartAccountWarningOpen, setIsSmartAccountWarningOpen] =
    React.useState(false);

  const checkSmartAccountBeforeBuy =
    React.useCallback(async (): Promise<boolean> => {
      if (!address || !walletClient) return false;

      try {
        const status = await getSmartAccountStatus({
          address: address as `0x${string}`,
          chainId,
          walletClient,
          getBytecode: publicClient?.getBytecode,
        });

        const isSmartAccount =
          status &&
          (status.isContractWallet ||
            status.isEip7702Delegated ||
            status.hasWalletAABatching);

        if (isSmartAccount) {
          setIsSmartAccountWarningOpen(true);
          return true;
        }

        return false;
      } catch (error) {
        console.error("Smart account check failed:", error);
        return false;
      }
    }, [address, chainId, walletClient, publicClient?.getBytecode]);

  const { connectWallet } = useConnectWallet({
    onError: (error) => {
      console.error("Failed to open connect modal:", error);
    },
  });

  const openConnectModal = React.useCallback(() => {
    connectWallet();
  }, [connectWallet]);

  // ----- "From a miner" option (single private evergreen listing) -----
  const selectedMiner = React.useMemo<AuctionApplication | null>(
    () => evergreenMiners[0] ?? null,
    [evergreenMiners],
  );
  const selectedMinerFraction = selectedMiner?.activeFraction ?? null;
  const minerUnitPriceUsd = selectedMinerFraction?.stepPrice
    ? Number(formatUnits(BigInt(selectedMinerFraction.stepPrice), 6))
    : 0;
  const minerRemaining = selectedMinerFraction
    ? selectedMinerFraction.remainingSteps != null
      ? selectedMinerFraction.remainingSteps
      : Math.max(
          0,
          selectedMinerFraction.totalSteps - selectedMinerFraction.splitsSold,
        )
    : 0;
  const minerClampedQty = Math.max(1, Math.min(minerQty, minerRemaining || 1));
  const minerTotalUsd = minerUnitPriceUsd * minerClampedQty;
  // Est. rewards + weeks-of-earning for the evergreen miner card.
  const selectedMinerMiningScore = selectedMiner
    ? getMiningScoreForApplication(miningScoreMap, selectedMiner.id)
    : null;
  const minerWeeklyGlwRewards = React.useMemo(
    () => parseWeeklyGlwRewards(selectedMinerMiningScore?.weeklyGlwRewards),
    [selectedMinerMiningScore?.weeklyGlwRewards],
  );
  const minerWeeklyRewardsUsd =
    minerWeeklyGlwRewards != null && glowSpotPrice > 0
      ? minerWeeklyGlwRewards * glowSpotPrice
      : null;
  const minerWeeksRemainingLabel = formatMinerWeeksRemainingLabel(
    selectedMinerMiningScore?.weeksOfMinerLifeRemaining,
  );
  const selectedMinerImageSrc =
    selectedMiner?.afterInstallPictures?.[0]?.url ||
    "/images/sections/residential.jpg";
  // wagmi's useWalletClient() can stay undefined under Privy even while the
  // wallet is connected; useConnectorClient() is populated in that gap. Derive a
  // viem WalletClient from the connector (extend with walletActions) as a
  // fallback so the miner buy never hits "Signer not available".
  const fallbackWalletClient = React.useMemo<WalletClient | undefined>(() => {
    if (!connectorClient) return undefined;
    try {
      return connectorClient.extend(walletActions) as unknown as WalletClient;
    } catch {
      return undefined;
    }
  }, [connectorClient]);
  const minerFractionsHook = usePatchedOffchainFractions(
    walletClient ?? fallbackWalletClient,
    publicClient,
    chainId,
  );
  // Declared here (above handleBuyMiner) so the miner ETH->USDC swap can use it;
  // the GLW flow further below reuses the same instance.
  const { estimateEthToUsdc, estimateGasForSwapEthToUsdc, swapEthToUsdc } =
    useSwapETHToUSDC();

  const handleBuyMiner = React.useCallback(async () => {
    if (!isConnected || !address) {
      openConnectModal();
      return;
    }
    const fraction = selectedMiner?.activeFraction;
    if (!selectedMiner || !fraction?.owner || !fraction?.id) return;
    const qty = minerClampedQty;
    if (qty < 1) return;

    setMinerBusy(true);
    const payingWithEth = payToken === "ETH";
    const toastId = toast.loading(
      payingWithEth
        ? "Swapping ETH → USDC…"
        : `Buying ${qty} miner${qty > 1 ? "s" : ""}…`,
    );
    try {
      // Miners are priced in USDC. When paying with ETH, swap enough ETH to
      // cover the USDC cost first (mirrors the deposit-dialog flow), then buy
      // with the received USDC.
      if (payingWithEth) {
        const requiredUsdc = BigInt(fraction.stepPrice) * BigInt(qty);
        if (requiredUsdc <= 0n) throw new Error("Invalid miner price.");

        const probeWei = parseUnits("0.1", 18);
        const probeRes = await estimateEthToUsdc({
          amountInWei: probeWei,
          slippageBps: BigInt(100),
        });
        if (!probeRes.ok || probeRes.val.amountOutUsdc <= 0n) {
          throw new Error("Failed to quote ETH to USDC.");
        }

        // Scale the probe to the required USDC, add a 2% buffer, then refine so
        // the guaranteed minimum out still covers the purchase.
        let amountInWei =
          (probeWei * requiredUsdc) / probeRes.val.amountOutUsdc;
        amountInWei = (amountInWei * 102n) / 100n;
        for (let i = 0; i < 3; i++) {
          const res = await estimateEthToUsdc({
            amountInWei,
            slippageBps: BigInt(100),
          });
          if (res.ok && res.val.amountOutMinUsdc >= requiredUsdc) break;
          amountInWei = (amountInWei * 105n) / 100n;
        }

        const swapRes = await swapEthToUsdc({
          amountInWei,
          slippageBps: BigInt(100),
        });
        if (!swapRes.ok) throw new Error(String(swapRes.val));
        toast.loading(`Buying ${qty} miner${qty > 1 ? "s" : ""}…`, {
          id: toastId,
        });
      }

      const hash = await minerFractionsHook.buyFractions({
        creator: fraction.owner as `0x${string}`,
        id: fraction.id as `0x${string}`,
        stepsToBuy: BigInt(qty),
        minStepsToBuy: BigInt(qty),
        refundTo: address,
        creditTo: address,
        useCounterfactualAddressForRefund: false,
      });
      trackEvent("buy_miner_success", {
        application_id: selectedMiner.id,
        quantity: qty,
        pay_token: payToken,
        source,
      });
      toast.success(
        `Bought ${qty} miner${qty > 1 ? "s" : ""} on ${
          selectedMiner.farmName ?? "farm"
        }.`,
        { id: toastId },
      );
      setTxHash(hash);
      setMinerQty(1);
      await refetchEvergreen?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Miner purchase failed.";
      toast.error(message, { id: toastId });
    } finally {
      setMinerBusy(false);
    }
  }, [
    isConnected,
    address,
    selectedMiner,
    minerClampedQty,
    minerFractionsHook,
    openConnectModal,
    refetchEvergreen,
    source,
    payToken,
    estimateEthToUsdc,
    swapEthToUsdc,
  ]);

  // USDG only buys GLW; if it's selected when switching to the miner option,
  // fall back to USDC (miners accept USDC, or ETH swapped to USDC).
  React.useEffect(() => {
    if (mode === "miner" && payToken === "USDG") {
      setPayToken("USDC");
    }
  }, [mode, payToken]);

  const { authenticated: isPrivyAuthenticated } = usePrivy();
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
      fallbackChainId: chainId,
    }).then((resolved) => {
      if (!cancelled && typeof resolved === "number") {
        setActiveWalletChainId(resolved);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [chainId, connectorClient, isConnected]);

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
      console.error("Failed to switch network in buy GLW dialog:", switchError);
      toast.error(t.wallet.failedToSwitchNetwork);
    }
  }, [expectedChainId, expectedNetworkLabel, switchChain, t.wallet]);
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
    [privyFundWallet]
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
      trackEvent("buy_glw_card_click", {
        pay_token: payToken,
        usdc_amount: usdcAmount,
        privy_authenticated: isPrivyAuthenticated,
        source,
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
      payToken,
      isPrivyAuthenticated,
      privyLogin,
      triggerCardFund,
      source,
    ]
  );

  const impactWalletStatsQuery = useImpactWalletStats({
    enabled: open,
  });

  const {
    getSmartBalancingAmounts,
    purchaseGlowEarlyLiquidity,
    getGlowQuoteEarlyLiquidity,
    resetGlowPurchaseState,
    lastTxHashRef: glowLastTxHashRef,
    resetLastTxHash: resetGlowLastTxHash,
  } = usePurchaseGlow();

  const {
    swapUSDCToUSDG,
    lastTxHashRef: usdcToUsdgLastTxHashRef,
    resetLastTxHash: resetUsdcToUsdgLastTxHash,
  } = useSwapUSDCToUSDG();
  const {
    swap: swapUsdGToGlow,
    resetUniswapPurchaseState,
    lastTxHashRef: uniswapLastTxHashRef,
    resetLastTxHash: resetUniswapLastTxHash,
  } = useSwap({
    tokenA_address: addresses.usdg,
    tokenB_address: addresses.glow,
  });

  const { currentPrice: earlyLiquidityCurrentPrice } = useEarlyLiquidityPrice({
    enabled: open,
  });

  const { ethPrice } = useEthPrice();

  const usdcBalanceFormatted = React.useMemo(
    () =>
      usdcBalance ? formatUnits(usdcBalance, DECIMALS_BY_TOKEN.USDC) : "0",
    [usdcBalance],
  );

  const { usdgBalance, isLoading: isBalancesLoading } = useWalletTokenBalances(address);
  const usdcBalanceWei = usdcBalance ?? 0n;
  const usdgBalanceWei = usdgBalance ?? 0n;

  const usdgBalanceFormatted = React.useMemo(() => {
    if (!usdgBalance) return "0";
    return formatUnits(usdgBalance, DECIMALS_BY_TOKEN.USDG);
  }, [usdgBalance]);

  // Only offer USDG when the wallet actually holds some (it can't be funded
  // from within this dialog). Keep it visible while balances load to avoid a
  // flicker for holders.
  const showUsdgOption =
    usdgBalanceWei > 0n || (isConnected && isBalancesLoading);

  const isEthPayEnabled = chainId === 1 || chainId === 11155111;
  const ethBalanceQuery = useBalance({
    address,
    query: {
      enabled: Boolean(open && address && isEthPayEnabled),
    },
  });

  const ethBalanceFormatted = React.useMemo(() => {
    if (!ethBalanceQuery.data?.value) return "0";
    return ethBalanceQuery.data.formatted;
  }, [ethBalanceQuery.data?.formatted, ethBalanceQuery.data?.value]);

  const availablePayBalanceFormatted = React.useMemo(() => {
    if (payToken === "USDC") return usdcBalanceFormatted;
    if (payToken === "USDG") return usdgBalanceFormatted;
    return ethBalanceFormatted;
  }, [
    usdcBalanceFormatted,
    ethBalanceFormatted,
    payToken,
    usdgBalanceFormatted,
  ]);

  const ethBalanceWei = ethBalanceQuery.data?.value ?? null;

  const impactQuote = React.useMemo(() => {
    if (!estimatedGlw || Number(estimatedGlw) <= 0) return null;
    try {
      const deltaGlwWei = parseUnits(estimatedGlw, 18);
      const deltaPerWeekScaled6 = glwWeiToPointsScaled6(deltaGlwWei);
      const weekRange = impactWalletStatsQuery.data?.weekRange ?? null;
      const weeksInRange = weekRange ? getWeeksInRange(weekRange) : 1;
      const deltaTotalScaled6 = deltaPerWeekScaled6 * BigInt(weeksInRange);

      return {
        weekRange,
        weeksInRange,
        deltaPerWeekPoints: formatPointsScaled6(deltaPerWeekScaled6, 2),
        deltaTotalPoints: formatPointsScaled6(deltaTotalScaled6, 2),
      };
    } catch {
      return null;
    }
  }, [estimatedGlw, impactWalletStatsQuery.data?.weekRange]);

  const formatEthMaxFromWei = React.useCallback((valueWei: bigint) => {
    const raw = formatUnits(valueWei, 18);
    const [i, f = ""] = raw.split(".");
    const trimmed = f.slice(0, 6);
    return trimmed ? `${i}.${trimmed}` : i;
  }, []);

  const isBalanceInsufficient = React.useMemo(() => {
    if (!isConnected) return false;
    if (!inputAmount || Number(inputAmount) <= 0) return false;

    try {
      if (payToken === "USDC") {
        const requestedWei = parseUnits(
          trimToDecimals(inputAmount, DECIMALS_BY_TOKEN.USDC as number),
          DECIMALS_BY_TOKEN.USDC as number,
        );
        return requestedWei > usdcBalanceWei;
      }
      if (payToken === "USDG") {
        const requestedWei = parseUnits(
          trimToDecimals(inputAmount, DECIMALS_BY_TOKEN.USDG as number),
          DECIMALS_BY_TOKEN.USDG as number,
        );
        return requestedWei > usdgBalanceWei;
      }
      if (payToken === "ETH") {
        const requestedWei = parseUnits(trimToDecimals(inputAmount, 18), 18);
        return requestedWei > (ethBalanceWei ?? 0n);
      }
      return false;
    } catch {
      return false;
    }
  }, [
    inputAmount,
    isConnected,
    payToken,
    usdcBalanceWei,
    usdgBalanceWei,
    ethBalanceWei,
  ]);

  const estimateRunner = React.useCallback(
    async (amount: string, signal: AbortSignal) => {
      if (!amount || Number(amount) <= 0) {
        return { estimatedGlw: "", smartAmounts: undefined, forAmount: "" };
      }

      let usdgEquivalent = amount;
      if (payToken === "ETH") {
        if (!isEthPayEnabled) {
          return { estimatedGlw: "", smartAmounts: undefined, forAmount: "" };
        }
        const amountInWei = parseUnits(amount, 18);
        const quoteRes = await estimateEthToUsdc({
          amountInWei,
          slippageBps: BigInt(100),
        });
        if (!quoteRes.ok) {
          return { estimatedGlw: "", smartAmounts: undefined, forAmount: "" };
        }
        usdgEquivalent = formatUnits(quoteRes.val.amountOutUsdc, 6);
      }

      const result = await getSmartBalancingAmounts({
        amountUsdgIn: usdgEquivalent,
        earlyLiquidityCurrentPrice,
      });

      if (signal.aborted)
        return { estimatedGlw: "", smartAmounts: undefined, forAmount: "" };

      if (result.ok) {
        const amounts = result.val;
        const uniswapOut = Number(amounts.amount_out_uni || "0");
        const bondingOut = Number(amounts.amount_out_glow || "0");
        const totalOut = uniswapOut + bondingOut;

        return {
          estimatedGlw: totalOut.toString(),
          smartAmounts: amounts,
          forAmount: amount,
        };
      }

      return { estimatedGlw: "", smartAmounts: undefined, forAmount: "" };
    },
    [
      estimateEthToUsdc,
      getSmartBalancingAmounts,
      earlyLiquidityCurrentPrice,
      isEthPayEnabled,
      payToken,
    ],
  );

  const handleEstimateResult = React.useCallback(
    (result: {
      estimatedGlw: string;
      smartAmounts: SmartBalancingAmounts | undefined;
      forAmount: string;
    }) => {
      setEstimatedGlw(result.estimatedGlw);
      setSmartAmounts(result.smartAmounts);
      setLastEstimatedAmount(result.forAmount);
    },
    [],
  );

  const handleEstimateError = React.useCallback(() => {
    console.error("Failed to estimate");
    setEstimatedGlw("");
    setSmartAmounts(undefined);
  }, []);

  const estimateOptions = React.useMemo(
    () => ({
      delayMs: 300,
      onResult: handleEstimateResult,
      onError: handleEstimateError,
    }),
    [handleEstimateError, handleEstimateResult],
  );

  const { run: runEstimate, isRunning: isEstimating } = useDebouncedAsync(
    estimateRunner,
    estimateOptions,
  );

  React.useEffect(() => {
    if (!open) return;
    if (phase !== "input") return;
    if (!inputAmount || Number(inputAmount) <= 0) return;
    if (isEstimating) return;
    if (
      !Number.isFinite(earlyLiquidityCurrentPrice) ||
      earlyLiquidityCurrentPrice <= 0
    )
      return;
    if (payToken === "ETH" && !isEthPayEnabled) return;

    const hasQuoteForCurrentPrice =
      lastEstimatedAmount === inputAmount &&
      Boolean(smartAmounts) &&
      smartAmounts?.earlyLiquidityCurrentPrice === earlyLiquidityCurrentPrice;

    if (hasQuoteForCurrentPrice) return;
    runEstimate(inputAmount);
  }, [
    earlyLiquidityCurrentPrice,
    inputAmount,
    isEstimating,
    isEthPayEnabled,
    lastEstimatedAmount,
    open,
    payToken,
    phase,
    runEstimate,
    smartAmounts,
  ]);

  React.useEffect(() => {
    if (open && !wasOpenRef.current)
      trackEvent("buy_glw_dialog_open", { source });
    if (!open && wasOpenRef.current)
      trackEvent("buy_glw_dialog_close", { source });
    wasOpenRef.current = open;
  }, [open, source]);

  const handleInputChange = React.useCallback(
    (value: string) => {
      setInputAmount(value);

      if (!value || Number(value) <= 0) {
        setEstimatedGlw("");
        setSmartAmounts(undefined);
        return;
      }

      runEstimate(value);
    },
    [runEstimate],
  );

  const handlePayTokenChange = React.useCallback(
    (next: PayToken) => {
      setPayToken(next);
      hasPrefilledForOpenRef.current = false;
      setInputAmount("");
      setEstimatedGlw("");
      setSmartAmounts(undefined);
      setLastEstimatedAmount("");
      setTxHash(null);
      setErrorMessage(null);
      setTransactionSteps([]);
      stepsRef.current = [];

      trackEvent("buy_glw_pay_token_change", { pay_token: next, source });

      if (next === "USDC" && defaultUsdcAmount) {
        if (open && phase === "input") {
          hasPrefilledForOpenRef.current = true;
          handleInputChange(defaultUsdcAmount);
        }
      }
    },
    [defaultUsdcAmount, handleInputChange, open, phase, source],
  );

  React.useEffect(() => {
    if (!open) {
      hasPrefilledForOpenRef.current = false;
      return;
    }
    if (hasPrefilledForOpenRef.current) return;
    if (phase !== "input") return;
    if (inputAmount) return;

    if (!defaultUsdcAmount) return;
    if (payToken !== "USDC") return;
    hasPrefilledForOpenRef.current = true;
    handleInputChange(defaultUsdcAmount);
  }, [
    open,
    defaultUsdcAmount,
    phase,
    inputAmount,
    handleInputChange,
    payToken,
  ]);

  const pricePerGlw = React.useMemo(() => {
    if (payToken === "ETH") return null;
    if (!inputAmount || !estimatedGlw || Number(estimatedGlw) === 0)
      return null;
    return Number(inputAmount) / Number(estimatedGlw);
  }, [inputAmount, estimatedGlw, payToken]);

  const updateStepStatus = React.useCallback(
    (
      stepId: string,
      status: StepStatus,
      extras?: { txHash?: string; errorMessage?: string },
    ) => {
      setTransactionSteps((prev) => {
        const updated = prev.map((s) => {
          if (s.id === stepId) {
            return {
              ...s,
              status,
              startedAt:
                status === "waiting_signature" || status === "confirming"
                  ? (s.startedAt ?? Date.now())
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
    },
    [],
  );

  const handleBuyGlow = React.useCallback(async () => {
    if (!inputAmount || Number(inputAmount) <= 0 || !smartAmounts) {
      toast.error(t.buyGlow.toastEnterAmount);
      return;
    }

    if (!isConnected) {
      toast.error(t.buyGlow.toastConnectRequired);
      trackEvent("buy_glw_connect_required", { source });
      return;
    }

    if (isWrongNetwork) {
      toast.error(t.wallet.wrongNetworkBody(
        connectedNetworkLabel,
        expectedNetworkLabel,
      ));
      return;
    }

    if (inputAmount !== lastEstimatedAmount) {
      toast.error(t.buyGlow.toastEstimateUpdating);
      return;
    }

    const isBlocked = await checkSmartAccountBeforeBuy();
    if (isBlocked) {
      trackEvent("buy_glw_smart_account_blocked", { source });
      return;
    }

    try {
      let effectiveSmartAmounts: SmartBalancingAmounts = smartAmounts;
      let includeUsdcToUsdgSwap = payToken === "USDC" || payToken === "ETH";
      let usdcAmountToSwapToUsdg: bigint | null = null;

      if (payToken === "USDC") {
        const requestedWei = parseUnits(
          trimToDecimals(inputAmount, DECIMALS_BY_TOKEN.USDC as number),
          DECIMALS_BY_TOKEN.USDC as number,
        );
        if (requestedWei > usdcBalanceWei)
          throw new Error(t.buyGlow.errorInsufficientUsdc);

        usdcAmountToSwapToUsdg = requestedWei;
      }

      if (payToken === "USDG") {
        const requestedWei = parseUnits(
          trimToDecimals(inputAmount, DECIMALS_BY_TOKEN.USDG as number),
          DECIMALS_BY_TOKEN.USDG as number,
        );
        if (requestedWei > usdgBalanceWei)
          throw new Error(t.buyGlow.errorInsufficientUsdg);

        includeUsdcToUsdgSwap = false;
      }

      const bondingAllocationInitial =
        effectiveSmartAmounts.amount_in_glow_bonding_curve ?? BigInt(0);
      const bondingOutputInitial = Number(
        effectiveSmartAmounts.amount_out_glow || "0",
      );
      const hasBondingOutputInitial =
        bondingAllocationInitial > BigInt(0) && bondingOutputInitial > 0;

      // Build transaction steps
      const steps: TransactionStep[] = [];

      if (payToken === "ETH") {
        steps.push({
          id: "SWAP_ETH_TO_USDC",
          title: t.buyGlow.stepSwapEthToUsdcTitle,
          description: t.buyGlow.stepSwapEthToUsdcDescription,
          tokenFrom: "ETH",
          tokenTo: "USDC",
          status: "idle",
        });
      }

      if (includeUsdcToUsdgSwap) {
        steps.push({
          id: "SWAP_USDC_TO_USDG",
          title: t.buyGlow.stepSwapUsdcToUsdgTitle,
          description: t.buyGlow.stepSwapUsdcToUsdgDescription,
          tokenFrom: "USDC",
          tokenTo: "USDG",
          status: "idle",
        });
      }

      steps.push({
        id: "SWAP_USDG_TO_GLOW_ON_UNISWAP",
        title: t.buyGlow.stepSwapUsdgToGlwTitle,
        description: t.buyGlow.stepSwapUsdgToGlwDescription,
        tokenFrom: "USDG",
        tokenTo: "GLW",
        status: "idle",
      });

      if (hasBondingOutputInitial) {
        steps.push({
          id: "PURCHASING_GLOW",
          title: t.buyGlow.stepBondingTitle,
          description: t.buyGlow.stepBondingDescription,
          tokenFrom: "USDG",
          tokenTo: "GLW",
          status: "idle",
        });
      }

      steps.push({
        id: "DONE",
        title: t.buyGlow.stepConfirmTitle,
        description: t.buyGlow.stepConfirmDescription,
        status: "idle",
      });

      stepsRef.current = steps;
      setTransactionSteps(steps);
      setPhase("processing");
      setErrorMessage(null);

      trackEvent("buy_glw_submit_click", {
        pay_token: payToken,
        pay_amount: inputAmount,
        usdc_balance: usdcBalanceFormatted,
        usdg_balance: usdgBalanceFormatted,
        has_bonding_step: hasBondingOutputInitial,
        source,
      });

      if (payToken === "ETH") {
        if (!isEthPayEnabled)
          throw new Error(t.buyGlow.errorEthPayNotSupported);

        updateStepStatus("SWAP_ETH_TO_USDC", "waiting_signature");
        const swapEthRes = await swapEthToUsdc({
          amountInWei: parseUnits(inputAmount, 18),
          slippageBps: BigInt(100),
        });
        if (!swapEthRes.ok) {
          trackEvent("buy_glw_step_result", {
            step: "swap_eth_to_usdc",
            ok: false,
            error_message: String(swapEthRes.val),
            source,
          });
          throw new Error(String(swapEthRes.val));
        }
        trackEvent("buy_glw_step_result", {
          step: "swap_eth_to_usdc",
          ok: true,
          source,
        });
        updateStepStatus("SWAP_ETH_TO_USDC", "completed", {
          txHash: swapEthRes.val.txHash,
        });
        setTxHash(swapEthRes.val.txHash);

        usdcAmountToSwapToUsdg = swapEthRes.val.usdcReceived;

        const usdcReceivedFormatted = formatUnits(usdcAmountToSwapToUsdg, 6);
        const recomputeRes = await getSmartBalancingAmounts({
          amountUsdgIn: usdcReceivedFormatted,
          earlyLiquidityCurrentPrice,
        });
        if (!recomputeRes.ok) throw new Error(String(recomputeRes.val));
        effectiveSmartAmounts = recomputeRes.val;

        const bondingAllocation =
          effectiveSmartAmounts.amount_in_glow_bonding_curve ?? BigInt(0);
        const bondingOutput = Number(
          effectiveSmartAmounts.amount_out_glow || "0",
        );
        const hasBondingOutput =
          bondingAllocation > BigInt(0) && bondingOutput > 0;
        const uniswapOut = Number(effectiveSmartAmounts.amount_out_uni || "0");
        const bondingOut = Number(effectiveSmartAmounts.amount_out_glow || "0");
        setEstimatedGlw((uniswapOut + bondingOut).toString());
        setTransactionSteps((prev) => {
          const hasBondingState = prev.some((s) => s.id === "PURCHASING_GLOW");
          if (hasBondingOutput && !hasBondingState) {
            const doneIndex = prev.findIndex((s) => s.id === "DONE");
            const next = [...prev];
            const insertAt = doneIndex === -1 ? next.length : doneIndex;
            next.splice(insertAt, 0, {
              id: "PURCHASING_GLOW",
              title: "Purchase from Bonding Curve",
              description: "Purchasing GLW from bonding curve",
              tokenFrom: "USDG",
              tokenTo: "GLW",
              status: "idle",
            });
            stepsRef.current = next;
            return next;
          }
          if (!hasBondingOutput && hasBondingState) {
            const filtered = prev.filter((s) => s.id !== "PURCHASING_GLOW");
            stepsRef.current = filtered;
            return filtered;
          }
          return prev;
        });
      }

      if (usdcAmountToSwapToUsdg && usdcAmountToSwapToUsdg > 0n) {
        updateStepStatus("SWAP_USDC_TO_USDG", "waiting_signature");
        updateStepStatus("SWAP_USDC_TO_USDG", "confirming");
        const swapUsdcResult = await swapUSDCToUSDG(usdcAmountToSwapToUsdg);
        if (!swapUsdcResult.ok) {
          trackEvent("buy_glw_step_result", {
            step: "swap_usdc_to_usdg",
            ok: false,
            error_message: String(swapUsdcResult.val),
            source,
          });
          throw new Error(String(swapUsdcResult.val));
        }
        trackEvent("buy_glw_step_result", {
          step: "swap_usdc_to_usdg",
          ok: true,
          source,
        });
        updateStepStatus("SWAP_USDC_TO_USDG", "completed");
        if (usdcToUsdgLastTxHashRef.current)
          setTxHash(usdcToUsdgLastTxHashRef.current);
      } else {
        updateStepStatus("SWAP_USDC_TO_USDG", "completed");
      }

      const bondingAllocation =
        effectiveSmartAmounts.amount_in_glow_bonding_curve ?? BigInt(0);
      const bondingOutput = Number(
        effectiveSmartAmounts.amount_out_glow || "0",
      );
      const hasBondingOutput =
        bondingAllocation > BigInt(0) && bondingOutput > 0;
      const finalUniswapOut = Number(
        effectiveSmartAmounts.amount_out_uni || "0",
      );
      const finalBondingOut = Number(
        effectiveSmartAmounts.amount_out_glow || "0",
      );
      const finalEstimatedGlw = (finalUniswapOut + finalBondingOut).toString();

      const hasUniswapAllocation =
        effectiveSmartAmounts.amount_in_uni > BigInt(0);
      if (hasUniswapAllocation) {
        updateStepStatus("SWAP_USDG_TO_GLOW_ON_UNISWAP", "waiting_signature");
        updateStepStatus("SWAP_USDG_TO_GLOW_ON_UNISWAP", "confirming");
        const uniswapResult = await swapUsdGToGlow({
          amount: effectiveSmartAmounts.amount_in_uni,
          slippagePercentTenThousandDenominator: BigInt(100),
        });
        if (!uniswapResult.ok) {
          trackEvent("buy_glw_step_result", {
            step: "swap_usdg_to_glw_uniswap",
            ok: false,
            error_message: String(uniswapResult.val),
            source,
          });
          throw new Error(String(uniswapResult.val));
        }
        trackEvent("buy_glw_step_result", {
          step: "swap_usdg_to_glw_uniswap",
          ok: true,
          source,
        });
        updateStepStatus("SWAP_USDG_TO_GLOW_ON_UNISWAP", "completed");
        if (uniswapLastTxHashRef.current)
          setTxHash(uniswapLastTxHashRef.current);
      } else {
        updateStepStatus("SWAP_USDG_TO_GLOW_ON_UNISWAP", "completed");
      }

      if (hasBondingOutput) {
        updateStepStatus("PURCHASING_GLOW", "waiting_signature");
        updateStepStatus("PURCHASING_GLOW", "confirming");
        const incrementsToPurchase = Math.floor(bondingOutput * 100);
        const quoteResult =
          await getGlowQuoteEarlyLiquidity(incrementsToPurchase);
        if (!quoteResult.ok) {
          trackEvent("buy_glw_step_result", {
            step: "purchase_glw_bonding",
            ok: false,
            error_message: String(quoteResult.val),
            source,
          });
          throw new Error(String(quoteResult.val));
        }

        if (quoteResult.val > bondingAllocation) {
          console.warn(
            "Skipping bonding curve purchase due to insufficient USDG allocation",
            {
              bondingAllocation: bondingAllocation.toString(),
              bondingQuote: quoteResult.val.toString(),
            },
          );
          updateStepStatus("PURCHASING_GLOW", "completed");
          trackEvent("buy_glw_step_result", {
            step: "purchase_glw_bonding",
            ok: true,
            skipped: true,
            source,
          });
        } else {
          const purchaseResult = await purchaseGlowEarlyLiquidity({
            incrementsToPurchase,
            slippagePointsTenThousandths: BigInt(100),
          });
          if (!purchaseResult.ok) {
            trackEvent("buy_glw_step_result", {
              step: "purchase_glw_bonding",
              ok: false,
              error_message: String(purchaseResult.val),
              source,
            });
            throw new Error(String(purchaseResult.val));
          }
          updateStepStatus("PURCHASING_GLOW", "completed");
          trackEvent("buy_glw_step_result", {
            step: "purchase_glw_bonding",
            ok: true,
            skipped: false,
            source,
          });
          if (glowLastTxHashRef.current) setTxHash(glowLastTxHashRef.current);
        }
      }

      updateStepStatus("DONE", "confirming");
      updateStepStatus("DONE", "completed");

      setPhase("success");
      toast.success(t.buyGlow.toastPurchaseSuccess);
      // USD ticket-size bucket for cohort analysis. Revenue is owned by the
      // backend pol/revenue sync.
      const payUsd =
        payToken === "USDC" || payToken === "USDG"
          ? Number(inputAmount)
          : null;
      trackEvent("buy_glw_success", {
        pay_token: payToken,
        pay_amount: inputAmount,
        estimated_glw: finalEstimatedGlw,
        has_bonding_step: hasBondingOutput,
        source,
        amount_usd_bucket:
          payUsd != null && Number.isFinite(payUsd) ? bucketUsd(payUsd) : null,
        referral_code:
          getStoredReferralAttribution()?.referralCode ?? null,
      });
      onSuccess?.();
    } catch (error: any) {
      console.error("Purchase failed:", error);

      const msg = error?.message || t.buyGlow.toastTransactionFailed;

      const currentSteps = stepsRef.current;
      const activeStep = currentSteps.find(
        (s) => s.status === "waiting_signature" || s.status === "confirming",
      );
      if (activeStep) {
        updateStepStatus(activeStep.id, "error", { errorMessage: msg });
      } else if (currentSteps.length > 0) {
        const firstIdleStep = currentSteps.find((s) => s.status === "idle");
        if (firstIdleStep) {
          updateStepStatus(firstIdleStep.id, "error", { errorMessage: msg });
        }
      }

      setPhase("error");
      setErrorMessage(msg);

      const isUserRejected =
        msg.includes("User rejected") || msg.includes("user rejected");
      if (isUserRejected) {
        toast.error(t.buyGlow.toastTransactionRejected);
      } else {
        toast.error(msg);
      }

      trackEvent("buy_glw_error", {
        error_message: msg,
        source,
      });
    }
  }, [
    earlyLiquidityCurrentPrice,
    getSmartBalancingAmounts,
    inputAmount,
    smartAmounts,
    lastEstimatedAmount,
    payToken,
    swapUSDCToUSDG,
    swapUsdGToGlow,
    swapEthToUsdc,
    purchaseGlowEarlyLiquidity,
    getGlowQuoteEarlyLiquidity,
    updateStepStatus,
    onSuccess,
    usdcBalanceFormatted,
    usdgBalanceFormatted,
    isEthPayEnabled,
    isConnected,
    usdcBalanceWei,
    usdgBalanceWei,
    checkSmartAccountBeforeBuy,
    glowLastTxHashRef,
    usdcToUsdgLastTxHashRef,
    uniswapLastTxHashRef,
    source,
    t.buyGlow,
    t.wallet,
    isWrongNetwork,
    connectedNetworkLabel,
    expectedNetworkLabel,
  ]);

  const handleClose = React.useCallback(() => {
    if (address) {
      void (async () => {
        try {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ["wallet-token-balances", chainId, address],
            }),
            queryClient.invalidateQueries({
              queryKey: ["wallet-swaps", chainId, address],
            }),
            queryClient.invalidateQueries({
              queryKey: ["unclaimed-glw-rewards", address],
            }),
            queryClient.invalidateQueries({
              queryKey: ["impact-glow-score", address],
            }),
            queryClient.invalidateQueries({
              queryKey: ["impact-leaderboard"],
            }),
            queryClient.invalidateQueries({
              queryKey: ["impact-score-breakdown"],
            }),
            queryClient.invalidateQueries({
              queryKey: ["impact-glow-worth"],
            }),
          ]);
        } catch {}
      })();
    }

    onOpenChange(false);
    hasPrefilledForOpenRef.current = false;
    // setTimeout for dialog close animation
    setTimeout(() => {
      setPhase("input");
      setPayToken("USDC");
      setInputAmount("");
      setEstimatedGlw("");
      setSmartAmounts(undefined);
      setLastEstimatedAmount("");
      setTransactionSteps([]);
      stepsRef.current = [];
      setTxHash(null);
      setErrorMessage(null);
      resetUsdcToUsdgLastTxHash();
      resetUniswapLastTxHash();
      resetGlowLastTxHash();
      resetGlowPurchaseState();
      resetUniswapPurchaseState();
    }, 300);
  }, [
    address,
    chainId,
    onOpenChange,
    queryClient,
    resetGlowLastTxHash,
    resetGlowPurchaseState,
    resetUniswapLastTxHash,
    resetUniswapPurchaseState,
    resetUsdcToUsdgLastTxHash,
  ]);

  const copyTxHash = React.useCallback(() => {
    if (txHash) {
      navigator.clipboard.writeText(txHash);
      toast.success("Transaction ID copied to clipboard");
    }
  }, [txHash]);

  const handleRetry = React.useCallback(() => {
    setPhase("input");
    setErrorMessage(null);
    setTransactionSteps([]);
    stepsRef.current = [];
    resetGlowPurchaseState();
    resetUniswapPurchaseState();
  }, [resetGlowPurchaseState, resetUniswapPurchaseState]);

  const renderContent = () => {
    // SUCCESS PHASE
    if (phase === "success") {
      return (
        <div className="px-6 py-8 text-center space-y-6">
          {/* Success Icon */}
          <div className="w-16 h-16 bg-[#4ADE80]/10 rounded-full flex items-center justify-center mx-auto">
            <GlowSymbol className="size-8" />
          </div>

          {/* Hero Amount */}
          <div className="text-center">
            <div className="text-3xl font-semibold text-foreground tracking-tight mb-1">
              +
              {Number(estimatedGlw).toLocaleString("en-US", {
                maximumFractionDigits: 4,
              })}{" "}
              GLW
            </div>
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#4ADE80]/10 px-3 py-1.5 text-xs font-medium text-[#4ADE80]">
                <TrendingUp className="h-3 w-3" />
                {t.buyGlow.impactBoostedBadge}
              </div>
              <div className="text-xs text-muted-foreground max-w-[260px] mx-auto">
                {t.buyGlow.impactBoostedBody}
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4 text-left space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">{t.buyGlow.sentLabel}</span>
              <div className="text-right">
                <span className="text-foreground text-sm font-mono">
                  {Number(inputAmount).toLocaleString("en-US", {
                    maximumFractionDigits: 6,
                  })}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {payToken}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">{t.buyGlow.receivedLabel}</span>
              <div className="text-right">
                <span className="text-[#4ADE80] text-sm font-mono font-medium">
                  {Number(estimatedGlw).toLocaleString("en-US", {
                    maximumFractionDigits: 4,
                  })}
                </span>
                <span className="text-xs text-muted-foreground ml-2">GLW</span>
              </div>
            </div>

            {txHash && (
              <div className="pt-3 border-t border-border/20 dark:border-border/40">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    {t.buyGlow.transactionLabel}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm font-mono">
                      {`${txHash.slice(0, 6)}...${txHash.slice(-4)}`}
                    </span>
                    <button
                      onClick={copyTxHash}
                      className="p-1 hover:bg-muted/50 rounded transition-colors"
                    >
                      <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                    </button>
                    <a
                      href={`https://etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-muted/50 rounded transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button variant="outline" onClick={handleClose} className="w-full">
            {t.buyGlow.close}
          </Button>
        </div>
      );
    }

    // PROCESSING / ERROR PHASE
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
                  transition={{ duration: 0.15, ease: "easeOut" }}
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
              {hasError ? t.buyGlow.failedTitle : t.buyGlow.processingTitle}
            </motion.div>
            <motion.div
              className="text-muted-foreground text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {hasError ? t.buyGlow.failedBody : t.buyGlow.processingBody}
            </motion.div>
          </div>

          {/* Transaction Stepper */}
          {transactionSteps.length > 0 ? (
            <motion.div
              className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 rounded-xl p-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              <TransactionStepper steps={transactionSteps} chainId={chainId} />
            </motion.div>
          ) : hasError && errorMessage ? (
            <motion.div
              className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-sm text-destructive break-words">
                {errorMessage}
              </p>
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
                {t.buyGlow.close}
              </Button>
              <Button onClick={handleRetry} className="flex-1">
                {t.buyGlow.tryAgain}
              </Button>
            </motion.div>
          )}
        </div>
      );
    }

    // INPUT PHASE
    return (
      <>
        <div className="px-6 pt-8 pb-4 border-b border-border/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                {t.buyGlow.title}
              </DialogTitle>
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

        <div className="px-5 py-5 space-y-4">
          {/* Two options side by side: Buy GLW directly, or buy from a miner.
              Both are peer "cards": a header region (branded band / photo
              banner) over a body, so the two read as the same component. */}
          <div
            className={cn(
              "grid gap-4",
              hasEvergreenMiners ? "md:grid-cols-2" : "grid-cols-1",
            )}
          >
            {/* OPTION 1 — Buy GLW directly */}
            <div
              onClick={() => setMode("glw")}
              className={cn(
                "overflow-hidden rounded-2xl border bg-muted/30 dark:bg-muted/50 transition-colors",
                hasEvergreenMiners && "cursor-pointer",
                mode === "glw"
                  ? "border-foreground/30 ring-1 ring-foreground/15"
                  : "border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60",
              )}
            >
              {/* Header band (mirrors the miner photo banner height) */}
              <div className="relative flex h-32 flex-col justify-center gap-1 border-b border-border/20 dark:border-border/40 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#4ADE80]/25 bg-[#4ADE80]/10">
                  <GlowSymbol className="h-6 w-6" />
                </div>
                <div className="mt-1 min-w-0">
                  <h3 className="truncate text-base font-semibold text-foreground">
                    Buy GLW
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Buy directly from Uniswap pool
                  </p>
                </div>
                {hasEvergreenMiners && mode === "glw" && (
                  <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[#4ADE80]" />
                )}
              </div>

              {/* Body */}
              <div className="space-y-3 p-4">
                <div className="rounded-xl border border-border/20 dark:border-border/40 bg-card p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <Label
                      htmlFor="buy-amount"
                      className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {t.buyGlow.youPay}
                    </Label>
                    <div className="flex items-center gap-2">
                      {isConnected && (
                        <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                          {payToken === "ETH"
                            ? toFixedTruncate(
                                Number(ethBalanceFormatted || "0"),
                                4,
                              )
                            : formatLocaleAmount(
                                availablePayBalanceFormatted,
                                2,
                              )}{" "}
                          {payToken}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async (event) => {
                          event.stopPropagation();
                          setMode("glw");
                          if (!isConnected) {
                            trackEvent("buy_glw_connect_wallet_click", {
                              location: "dialog_max",
                              source,
                            });
                            openConnectModal();
                            return;
                          }

                          trackEvent("buy_glw_max_click", {
                            pay_token: payToken,
                            pay_balance: availablePayBalanceFormatted,
                            source,
                          });

                          if (payToken === "ETH") {
                            if (!ethBalanceWei) return;
                            try {
                              const probeWei =
                                ethBalanceWei > parseUnits("0.05", 18)
                                  ? parseUnits("0.05", 18)
                                  : ethBalanceWei;
                              const gasRes = await estimateGasForSwapEthToUsdc({
                                amountInWei: probeWei,
                                slippageBps: BigInt(100),
                              });
                              const feeWei = gasRes.ok
                                ? gasRes.val.estimatedFeeWei
                                : BigInt(0);
                              const bufferedFeeWei =
                                (feeWei * BigInt(12)) / BigInt(10);
                              const maxSpendWei =
                                ethBalanceWei > bufferedFeeWei
                                  ? ethBalanceWei - bufferedFeeWei
                                  : BigInt(0);
                              handleInputChange(
                                formatEthMaxFromWei(maxSpendWei),
                              );
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : t.buyGlow.toastFailedComputeMaxEth,
                              );
                            }
                            return;
                          }

                          handleInputChange(availablePayBalanceFormatted);
                        }}
                        className="h-7 rounded-full px-2.5 text-xs font-semibold"
                      >
                        {t.buyGlow.max}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      id="buy-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={inputAmount}
                      onFocus={() => setMode("glw")}
                      onChange={(e) => {
                        setMode("glw");
                        const value = e.target.value.replace(",", ".");
                        if (value === "" || /^\d*\.?\d*$/.test(value)) {
                          handleInputChange(value);
                        }
                      }}
                      className={cn(
                        "min-w-0 flex-1 border-0 bg-transparent p-0 text-xl font-bold tabular-nums placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0",
                        isConnected &&
                          Number(inputAmount) >
                            Number(availablePayBalanceFormatted)
                          ? "text-destructive"
                          : "text-foreground",
                      )}
                    />
                    <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border/20 dark:border-border/40 bg-muted/40 dark:bg-muted/60 px-2.5 py-1.5">
                      <TokenIcon symbol={payToken} />
                      <span className="text-sm font-semibold text-foreground">
                        {payToken}
                      </span>
                    </div>
                  </div>

                  {payToken === "ETH" &&
                    inputAmount &&
                    Number(inputAmount) > 0 &&
                    ethPrice > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {t.buyGlow.approximateUsd(
                          (Number(inputAmount) * ethPrice).toLocaleString(
                            "en-US",
                            { maximumFractionDigits: 2 },
                          ),
                        )}
                      </div>
                    )}

                  {isBalanceInsufficient && (
                    <div className="mt-2 text-xs font-medium text-destructive">
                      {t.buyGlow.insufficientBalance}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border/20 dark:border-border/40 bg-card p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t.buyGlow.youReceive}
                    </div>
                    {pricePerGlw && (
                      <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                        {t.buyGlow.pricePerGlw(pricePerGlw.toFixed(4))}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <AnimatePresence mode="popLayout">
                      {isEstimating ? (
                        <Skeleton key="estimating" className="h-7 w-28" />
                      ) : (
                        <motion.span
                          key={estimatedGlw || "0"}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-[color:var(--color-glow-green)]"
                        >
                          {estimatedGlw && Number(estimatedGlw) > 0
                            ? formatPrice(estimatedGlw, 2)
                            : "0"}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <span className="text-sm font-medium text-emerald-700/70 dark:text-[color:var(--color-glow-green)]/70">
                      GLW
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* OPTION 2 — Buy GLW from a miner (single private evergreen listing) */}
            {hasEvergreenMiners && selectedMiner && (
              <div
                onClick={() => setMode("miner")}
                className={cn(
                  "cursor-pointer overflow-hidden rounded-2xl border bg-muted/30 dark:bg-muted/50 transition-colors",
                  mode === "miner"
                    ? "border-foreground/30 ring-1 ring-foreground/15"
                    : "border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60",
                )}
              >
                {/* Photo banner — eyebrow + farm name + availability overlaid
                    on the image to save vertical space (keeps the card height
                    close to the GLW card). */}
                <div className="relative h-32 overflow-hidden border-b border-border/20 dark:border-border/40 bg-muted">
                  <FallbackImage
                    src={selectedMinerImageSrc}
                    widthForProxy={600}
                    quality={70}
                    alt={selectedMiner.farmName ?? selectedMiner.zone.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
                  <div className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                    {selectedMiner.zone.name}
                  </div>
                  {mode === "miner" && (
                    <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[#4ADE80] ring-4 ring-black/20" />
                  )}
                  <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/75">
                        From a miner
                      </div>
                      <h3 className="mt-0.5 truncate text-base font-semibold leading-tight text-white drop-shadow">
                        {selectedMiner.farmName ?? "Evergreen miner"}
                      </h3>
                    </div>
                    <div className="shrink-0 rounded-full bg-black/65 px-2.5 py-1 text-[11px] tabular-nums text-white backdrop-blur-sm">
                      {minerRemaining.toLocaleString()} available
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="space-y-3 p-4">
                  {/* Row 1: est. rewards + weeks left (paired to save height) */}
                  <div className="grid grid-cols-2 gap-2">
                    <CheckoutStat
                      isLoading={
                        isMiningScoresLoading && !selectedMinerMiningScore
                      }
                      label={
                        <span className="inline-flex items-center gap-1.5">
                          Est. rewards
                          <span className="group/help relative inline-flex">
                            <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                            <span className="absolute bottom-full left-1/2 z-50 mb-2 hidden w-60 -translate-x-1/2 group-hover/help:block">
                              <span className="block rounded-lg border border-border bg-popover px-3 py-2 text-xs font-normal normal-case tracking-normal text-popover-foreground shadow-lg">
                                Current weekly rate per miner. May decrease as
                                new regional farms dilute emissions.
                              </span>
                            </span>
                          </span>
                        </span>
                      }
                      value={
                        minerWeeklyGlwRewards != null
                          ? `${minerWeeklyGlwRewards.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} GLW`
                          : "0.00 GLW"
                      }
                      subvalue={
                        minerWeeklyRewardsUsd != null
                          ? `≈ ${formatUsdAmount(minerWeeklyRewardsUsd, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} / week`
                          : "≈ $0.00 / week"
                      }
                    />
                    <CheckoutStat
                      isLoading={
                        isMiningScoresLoading && !selectedMinerMiningScore
                      }
                      label="Weeks left"
                      value={minerWeeksRemainingLabel}
                    />
                  </div>

                  {/* Row 2: price-per-unit paired with the quantity stepper */}
                  <div className="grid grid-cols-2 gap-2">
                    <CheckoutStat
                      label="Price"
                      value={formatUsdAmount(minerUnitPriceUsd)}
                      subvalue="/ miner"
                    />
                    <div className="rounded-xl border border-border/20 dark:border-border/40 bg-card p-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Quantity
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMode("miner");
                            setMinerQty((q) => Math.max(1, q - 1));
                          }}
                          disabled={minerClampedQty <= 1}
                          aria-label="Decrease miner quantity"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/20 dark:border-border/40 text-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="text-base font-semibold tabular-nums">
                          {minerClampedQty}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMode("miner");
                            setMinerQty((q) =>
                              Math.min(minerRemaining || 1, q + 1),
                            );
                          }}
                          disabled={minerClampedQty >= minerRemaining}
                          aria-label="Increase miner quantity"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/20 dark:border-border/40 text-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SHARED Payment Method — a labelled section directly on the dialog
              surface so the muted option rows read with clear contrast (no
              muted-on-muted, per DIALOG-DESIGN-GUIDELINES contrast layering). */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
              {t.buyGlow.paymentMethod}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <PaymentOption
                label={t.buyGlow.usdcLabel}
                balance={
                  isConnected
                    ? `${formatLocaleAmount(usdcBalanceFormatted, 2)} USDC`
                    : t.buyGlow.connectWalletBalance
                }
                icon={<TokenIcon symbol="USDC" />}
                selected={payToken === "USDC"}
                onSelect={() => handlePayTokenChange("USDC")}
                isLoading={isConnected && isBalancesLoading}
              />
              {/* USDG only buys GLW directly; not offered for miners. */}
              {mode === "glw" && (
                <PaymentOption
                  label={t.buyGlow.usdgLabel}
                  balance={
                    isConnected
                      ? `${formatLocaleAmount(usdgBalanceFormatted, 2)} USDG`
                      : t.buyGlow.connectWalletBalance
                  }
                  icon={<TokenIcon symbol="USDG" />}
                  selected={payToken === "USDG"}
                  onSelect={() => handlePayTokenChange("USDG")}
                  isLoading={isConnected && isBalancesLoading}
                  disabled={!showUsdgOption}
                />
              )}
              {/* ETH works for both: GLW (swap path) and miners (ETH -> USDC). */}
              {isEthPayEnabled && (
                <PaymentOption
                  label={t.buyGlow.ethLabel}
                  balance={
                    isConnected
                      ? `${toFixedTruncate(
                          Number(ethBalanceFormatted || "0"),
                          4,
                        )} ETH`
                      : t.buyGlow.connectWalletBalance
                  }
                  icon={<TokenIcon symbol="ETH" />}
                  selected={payToken === "ETH"}
                  onSelect={() => handlePayTokenChange("ETH")}
                  isLoading={isConnected && ethBalanceQuery.isLoading}
                />
              )}
            </div>
          </div>

          {/* Order total — sits after the payment options (miner checkout). */}
          {mode === "miner" && (
            <div className="flex items-baseline justify-between rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 px-4 py-3">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
                Total
              </span>
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {formatUsdAmount(minerTotalUsd)}
              </span>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderFooter = () => {
    if (phase !== "input") return null;

    return (
      <div className="px-5 py-4 bg-muted/30 border-t border-border/40 shrink-0">
        <div className="relative">
          {!isConnected ? (
            <Button
              onClick={() => {
                trackEvent("buy_glw_connect_wallet_click", {
                  location: "dialog_footer",
                  source,
                });
                openConnectModal();
              }}
              className="w-full h-12 rounded-xl text-base font-medium"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {t.buyGlow.connectWallet}
            </Button>
          ) : isWrongNetwork ? (
            <div className="space-y-2">
              <Button
                className="w-full h-12 rounded-xl text-base font-medium"
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
          ) : mode === "miner" ? (
            <Button
              className="w-full h-12 rounded-xl text-base font-medium"
              onClick={handleBuyMiner}
              disabled={
                minerBusy || !selectedMinerFraction || minerRemaining < 1
              }
            >
              {minerBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {`Buy ${minerClampedQty} miner${
                minerClampedQty > 1 ? "s" : ""
              } · ${formatUsdAmount(minerTotalUsd)}`}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                className="w-full h-12 rounded-xl text-base font-medium"
                onClick={handleBuyGlow}
                disabled={
                  !inputAmount ||
                  Number(inputAmount) <= 0 ||
                  Number(inputAmount) > Number(availablePayBalanceFormatted) ||
                  !estimatedGlw ||
                  isEstimating ||
                  inputAmount !== lastEstimatedAmount
                }
              >
                {isEstimating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t.buyGlow.buyGlw}
              </Button>
              {(() => {
                if (payToken !== "USDC") return null;
                const usdcBalanceUsd =
                  usdcBalance != null
                    ? Number(formatUnits(usdcBalance, 6))
                    : 0;
                const desiredUsdc = Number(inputAmount);
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
                  roundedDeficit
                ).toFixed(2);
                const isMinimumApplied = roundedDeficit < MIN_CARD_FUND_USDC;
                return (
                  // Hidden on mobile: in-app dApp browsers silently block
                  // the on-ramp popup; card flow stays desktop-only.
                  <div className="hidden lg:block space-y-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleBuyWithCard(cardFundAmount)}
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
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "p-0 gap-0 bg-card border border-border/40 text-foreground overflow-hidden rounded-[24px] flex flex-col max-h-[85vh]",
          // Width fix: the base DialogContent ships an UNPREFIXED arbitrary
          // `max-w-[calc(100%-2rem)]` (≈ full viewport) that out-cascades any
          // responsive `md:max-w-*` override (twMerge keeps both; the unprefixed
          // arbitrary utility wins). A single unprefixed arbitrary `min()` value
          // is the only reliable fix: twMerge REPLACES the full-width base
          // utility, and the value itself encodes the responsive cap
          // (viewport-2rem on mobile, fixed ceiling on desktop). The two-option
          // checkout caps wider; the GLW-only case stays narrow.
          phase === "input" && hasEvergreenMiners
            ? "max-w-[min(calc(100vw-2rem),44rem)]"
            : "max-w-[min(calc(100vw-2rem),28rem)]",
        )}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {phase === "success"
              ? t.buyGlow.toastPurchaseSuccess
              : phase === "error"
                ? t.buyGlow.failedTitle
                : phase === "processing"
                  ? t.buyGlow.processingTitle
                  : t.buyGlow.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">{renderContent()}</div>
        {renderFooter()}
      </DialogContent>

      <SmartAccountWarningDialog
        open={isSmartAccountWarningOpen}
        onOpenChange={setIsSmartAccountWarningOpen}
        triggerCheck={false}
      />
    </Dialog>
  );
}

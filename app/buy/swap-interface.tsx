/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Result } from "ts-results";
import { useSwap } from "@/hooks/useSwap";
import { Input } from "@/components/ui/input";
import {
  useAccount,
  useDisconnect,
  useConnect,
  useWalletClient,
  usePublicClient,
  useBalance,
  useChainId,
  useConnectorClient,
  useSwitchChain,
} from "wagmi";
import { formatUnits, parseUnits, type Address } from "viem";
import { mainnet, sepolia } from "wagmi/chains";
import {
  useLogin,
  usePrivy,
} from "@privy-io/react-auth";
import { useCardOnramp } from "@/hooks/use-card-onramp";
import { capturePrivyWalletError } from "@/lib/privy-errors";
import { AlertTriangle, ArrowDownUp, CreditCard, Info, Settings } from "lucide-react";
import { useSwapUSDCToUSDG } from "@/hooks/useSwapUSDCToUSDG";
import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";
import { useER20Balances } from "@/hooks/useERC20Balances";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { ConnectButton } from "@/components/connect-button";
import {
  SmartBalancingAmounts,
  usePurchaseGlow,
} from "@/hooks/usePurchaseGlow";
import { formatPrice } from "@/utils/formatPrice";
import { UsdcToTokenDialog } from "@/components/usdc-to-token-dialog";
import { GlowToUsdcDialog } from "@/components/glow-to-usdc-dialog";
import { UsdgToUsdcRedemptionDialog } from "@/components/usdg-to-usdc-redemption-dialog";
import { toFixedTruncate } from "@/utils/toFixedTruncate";
import {
  parseSwapInputValue,
  toUnitsDecimal,
} from "@/utils/swap-input";
import { useDebouncedAsync } from "@/hooks/useDebouncedAsync";
import { Skeleton } from "@/components/ui/skeleton";
import { getOptimalUSDGAmountsWithFees } from "@/utils/glowSmartBalancing";
import { useRouter } from "next/navigation";
import { useUSDGRedemption } from "@/hooks/useUSDGRedemption";
import Decimal from "decimal.js";
import { forceDisconnect } from "@/utils/forceDisconnect";

import { cn } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";
import { StatsSidebar } from "./stats-sidebar";
import { SmartAccountWarningDialog } from "@/components/wallet/smart-account-warning-dialog";
import {
  getSmartAccountPreflight,
  isSmartAccountBlocked,
  type SmartAccountPreflight,
} from "@/web3/web3/utils/detectSmartAccount";
import { trackEvent } from "@/lib/telemetry";
import { useLang } from "@/lib/i18n";
import { tokens } from "./constants";
import {
  INVALID_WALLET_TX_RESPONSE_MESSAGE,
  isInvalidWalletTxResponseError,
} from "@/lib/normalize-tx-hash";
import {
  getReadableRpcErrorMessage,
  isInsufficientGasError,
  normalizeSwapFailureMessage,
} from "@/lib/rpc-error-utils";
import {
  computeGlowSwapPriceImpactPct,
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_SLIPPAGE_TOLERANCE,
  HIGH_SLIPPAGE_WARNING_THRESHOLD_PCT,
  MAX_SLIPPAGE_TOLERANCE_PCT,
  normalizeSlippageTolerance,
  parseSlippageTolerance,
  slippagePctToBps,
  computeAmountOutMin,
} from "@/lib/swap-slippage";
import { NetworkRequirementBanner } from "@/components/dialogs/network-requirement-banner";
import { chainIdToName, resolveWalletChainId } from "@/lib/tos-chain";
import { getExpectedChainId } from "@/lib/wallet-chain";
import {
  type CommittedSwapQuote,
  createSwapQuoteKey,
  isCurrentSwapQuote,
  SWAP_QUOTE_MAX_AGE_MS,
  validateSmartBalancingQuote,
} from "@/lib/swap-quote";
import { useEthGasPreflight } from "@/hooks/useEthGasPreflight";
import { estimateSwapGasUnits } from "@/lib/transaction-gas";
import {
  useLatestTransactionOperationGuard,
  useTransactionOperationGuard,
} from "@/hooks/useTransactionOperationGuard";
import {
  getTransactionOperationCancellation,
  isTransactionOperationCancelled,
  type AssertTransactionActive,
  type TransactionOperation,
} from "@/lib/transaction-operation";
import type { WalletRequestObserver } from "@/lib/wallet-request";

const defaultTokensEstimate = {
  GLOW: "",
  USDG: "",
  USDC: "",
  ETH: "",
};

const GLOW_PRICE_HARD_CAP = 3.9794;
const HIGH_SLIPPAGE_WARNING_THRESHOLD = new Decimal(
  HIGH_SLIPPAGE_WARNING_THRESHOLD_PCT
);

const swapTokens = {
  USDC: tokens.USDC,
  USDG: tokens.USDG,
  GLOW: tokens.GLOW,
  ETH: tokens.ETH,
} as const;

type SwapTokenLabel = keyof typeof swapTokens;
type SwapToken = (typeof swapTokens)[SwapTokenLabel];

interface SwapEstimateRequest {
  amount: string;
  quoteKey: string;
}

interface SwapDialogQuoteSnapshot {
  amount: string;
  amountToSell: string;
  selectedTokenSell: SwapToken;
  selectedTokenBuy: SwapToken;
  smartBalancingAmounts: SmartBalancingAmounts | undefined;
  slippageBps: bigint;
  quoteExpiresAt: number;
  expectedAccount: Address;
  minimumAmountOut: bigint;
  ethToUsdcMinimum?: bigint;
  smartAccountPreflight?: SmartAccountPreflight;
}

interface GlowExitQuoteSnapshot {
  amountToSell: string;
  estimatedOutputAmount: string;
  minimumUsdgOut: bigint;
  slippageBps: bigint;
  quoteExpiresAt: number;
  targetToken: "USDC" | "USDG";
  expectedAccount: Address;
  smartAccountPreflight?: SmartAccountPreflight;
}

interface RedemptionQuoteSnapshot {
  amountToRedeem: string;
  quoteExpiresAt: number;
  expectedAccount: Address;
  smartAccountPreflight?: SmartAccountPreflight;
}

function isSwapTokenLabel(value: string): value is SwapTokenLabel {
  return Object.prototype.hasOwnProperty.call(swapTokens, value);
}

function formatEthMaxFromWei(valueWei: bigint) {
  const raw = formatUnits(valueWei, 18);
  const [i, f = ""] = raw.split(".");
  const trimmed = f.slice(0, 6);
  return trimmed ? `${i}.${trimmed}` : i;
}

export function SwapInterface({
  glowPrice,
  marketCap,
  ethPriceInUSD,
  isDialog = false,
}: {
  glowPrice: string;
  marketCap: string;
  ethPriceInUSD: number | null;
  isDialog?: boolean;
}) {
  const { t } = useLang();
  const expectedChainId = getExpectedChainId();
  const [estimatedOutputAmount, setEstimatedOutputAmount] = useState<
    typeof defaultTokensEstimate
  >(defaultTokensEstimate);
  const [isTransitionStarted, startTransition] = React.useTransition();
  const [estimateQueueAmount, setEstimateQueueAmount] = useState<number>(0);
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [dialogQuote, setDialogQuote] = useState<SwapDialogQuoteSnapshot | null>(
    null,
  );
  const [isGlowToUsdcDialogOpen, setIsGlowToUsdcDialogOpen] =
    useState<boolean>(false);
  const [glowExitQuote, setGlowExitQuote] =
    useState<GlowExitQuoteSnapshot | null>(null);
  const [
    isUsdgToUsdcRedemptionDialogOpen,
    setIsUsdgToUsdcRedemptionDialogOpen,
  ] = useState<boolean>(false);
  const [redemptionQuote, setRedemptionQuote] =
    useState<RedemptionQuoteSnapshot | null>(null);
  const [amountToSell, setAmountToSell] = React.useState<string>("");
  const [selectedTokenSell, setSelectedTokenSell] = useState<SwapToken>(
    swapTokens.USDC
  );
  const [selectedTokenBuy, setSelectedTokenBuy] = useState<SwapToken>(
    swapTokens.GLOW
  );
  const [slippageTolerance, setSlippageTolerance] = useState(
    DEFAULT_SLIPPAGE_TOLERANCE
  );
  const [pendingTx, setPendingTx] = useState<boolean>(false);
  const beginPageTransactionOperation = useTransactionOperationGuard(true);
  const [tokenSellBalance, setTokenSellBalance] = useState<string>("0");
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null
  );
  const [estimateErrorMessage, setEstimateErrorMessage] = useState<
    string | null
  >(null);
  const { address, isConnected, isConnecting } = useAccount();
  const postDialogRefreshKey = `${selectedTokenSell.label}:${selectedTokenBuy.label}:${
    address?.toLowerCase() ?? "disconnected"
  }`;
  const beginPostDialogRefreshOperation =
    useLatestTransactionOperationGuard(true, postDialogRefreshKey);
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: expectedChainId });
  const chainId = useChainId();
  const { data: connectorClient } = useConnectorClient();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const isEthPayEnabled =
    expectedChainId === mainnet.id || expectedChainId === sepolia.id;
  const [activeWalletChainId, setActiveWalletChainId] = useState<
    number | undefined
  >(chainId);

  useEffect(() => {
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
    isConnected && effectiveWalletChainId !== expectedChainId;
  const expectedNetworkLabel = chainIdToName(expectedChainId);
  const connectedNetworkLabel = chainIdToName(effectiveWalletChainId);
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
      await switchChainAsync({ chainId: expectedChainId });
      toast.success(t.wallet.switchedTo(expectedNetworkLabel));
    } catch (error) {
      console.error("Failed to switch network in swap interface:", error);
      toast.error(t.wallet.failedToSwitchNetwork);
    }
  }, [expectedChainId, expectedNetworkLabel, switchChainAsync, t.wallet]);

  const { authenticated: isPrivyAuthenticated } = usePrivy();
  // Refs survive a render cycle so onComplete can reach the latest fund target
  // without causing the useLogin callback identity to change.
  const pendingCardFundRef = React.useRef<{
    address: `0x${string}`;
    amount: string;
  } | null>(null);
  const { triggerCardFund } = useCardOnramp();
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
      trackEvent("buy_card_click", {
        sell_token: selectedTokenSell.label,
        buy_token: selectedTokenBuy.label,
        usdc_amount: usdcAmount,
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
      selectedTokenSell.label,
      selectedTokenBuy.label,
      isPrivyAuthenticated,
      privyLogin,
      triggerCardFund,
    ]
  );
  const ethBalanceQuery = useBalance({
    address,
    chainId: expectedChainId,
    query: {
      enabled: Boolean(
        isConnected &&
          address &&
          selectedTokenSell.label === "ETH" &&
          isEthPayEnabled
      ),
    },
  });

  const ethBalanceFormatted = React.useMemo(() => {
    if (!ethBalanceQuery.data?.value) return "0";
    // wagmi formats as 18 decimals for native ETH
    return ethBalanceQuery.data.formatted;
  }, [ethBalanceQuery.data?.formatted, ethBalanceQuery.data?.value]);

  const slippageDecimal = React.useMemo(
    () => parseSlippageTolerance(slippageTolerance),
    [slippageTolerance]
  );
  const slippageBps = React.useMemo(
    () => slippagePctToBps(slippageTolerance, DEFAULT_SLIPPAGE_BPS),
    [slippageTolerance],
  );
  const hasValidSlippage = slippageDecimal !== null;
  const currentQuoteKey = React.useMemo(
    () =>
      createSwapQuoteKey({
        amount: amountToSell,
        sellToken: selectedTokenSell.label,
        buyToken: selectedTokenBuy.label,
        chainId: effectiveWalletChainId,
        slippageBps,
        priceBasis: selectedTokenBuy.label === "GLOW" ? glowPrice : null,
      }),
    [
      amountToSell,
      effectiveWalletChainId,
      glowPrice,
      selectedTokenBuy.label,
      selectedTokenSell.label,
      slippageBps,
    ],
  );
  const isHighSlippage = Boolean(
    slippageDecimal && slippageDecimal.gt(HIGH_SLIPPAGE_WARNING_THRESHOLD)
  );

  const setSlippageToleranceWithWarning = React.useCallback(
    (nextValue: string) => {
      const previous = parseSlippageTolerance(slippageTolerance);
      const next = parseSlippageTolerance(nextValue);
      setSlippageTolerance(nextValue);

      if (
        next &&
        next.gt(HIGH_SLIPPAGE_WARNING_THRESHOLD) &&
        (!previous || previous.lte(HIGH_SLIPPAGE_WARNING_THRESHOLD))
      ) {
        toast.warning(t.swap.toastHighSlippage, {
          description: t.swap.toastHighSlippageBody,
        });
      }
    },
    [slippageTolerance, t.swap]
  );

  // Add a general loading state check
  const isWalletLoading = isConnecting;

  const handleSwapDirection = React.useCallback(() => {
    const nextSell = selectedTokenBuy;
    const nextBuyCandidate = selectedTokenSell;
    const allowed = nextSell.allowedPairs as unknown as SwapTokenLabel[];
    if (allowed.length === 0) return;

    const nextBuy = allowed.includes(nextBuyCandidate.label as SwapTokenLabel)
      ? nextBuyCandidate
      : swapTokens[allowed[0]];

    setSelectedTokenSell(nextSell);
    setSelectedTokenBuy(nextBuy);
    setSmartBalancingAmounts(undefined);
    setAmountToSell("");
    setEstimatedOutputAmount(defaultTokensEstimate);
    setActionErrorMessage(null);
    setEstimateErrorMessage(null);
    setIsFeesLoading(false);
    setCommittedQuote(null);
    setEthToUsdcMinimumQuote(null);
  }, [selectedTokenBuy, selectedTokenSell]);

  const [smartBalancingAmounts, setSmartBalancingAmounts] = useState<
    SmartBalancingAmounts & {
      estimatedCostInUSDForEarlyLiquidity: string;
      estimatedCostInUSDForUniswap: string;
      estimatedTotalGasInUSD: string;
    }
  >();
  const [isFeesLoading, setIsFeesLoading] = useState<boolean>(false);
  const [committedQuote, setCommittedQuote] =
    useState<CommittedSwapQuote | null>(null);
  const [usdgWithdrawAmount, setUsdgWithdrawAmount] = useState<string>("0");
  const [estimatedWithdrawGas, setEstimatedWithdrawGas] = useState<string>("");
  const [ethToUsdcMinimumQuote, setEthToUsdcMinimumQuote] = useState<{
    key: string;
    amountOutMinUsdc: bigint;
  } | null>(null);

  const [isUsdcInRedemptionLoading, setIsUsdcInRedemptionLoading] =
    useState(false);
  const [usdcInRedemption, setUsdcInRedemption] = useState<number>(0);

  const [balancesLoading, setBalancesLoading] = useState<boolean>(true);
  const [isSmartAccountWarningOpen, setIsSmartAccountWarningOpen] =
    useState(false);

  const { signer, isLoading: isSignerLoading } = useEthersSigner({
    chainId: expectedChainId,
  });

  // Smart account check function
  const checkSmartAccountBeforeSwap = async (
    assertTransactionActive?: AssertTransactionActive,
  ): Promise<SmartAccountPreflight | null> => {
    const restrictedTokens = new Set(["USDG", "GLOW"]);
    const flowTouchesRestrictedToken =
      restrictedTokens.has(selectedTokenSell.label) ||
      restrictedTokens.has(selectedTokenBuy.label);

    if (!flowTouchesRestrictedToken) {
      return null;
    }
    if (!address || !walletClient) return null;

    try {
      const preflight = await getSmartAccountPreflight({
        address: address as `0x${string}`,
        chainId,
        walletClient,
        getBytecode: publicClient?.getBytecode,
      });
      assertTransactionActive?.();
      return preflight;
    } catch (error) {
      if (isTransactionOperationCancelled(error)) throw error;
      assertTransactionActive?.();
      console.error("Smart account check failed:", error);
      return null; // Allow the swap if check fails
    }
  };

  const createPageWalletRequestObserver = (
    assertTransactionActive: AssertTransactionActive,
  ): WalletRequestObserver => ({
    onEvent: (event) => {
      assertTransactionActive();
      trackEvent("wallet_request_lifecycle", {
        flow: "swap_page",
        action: event.action ?? null,
        request_phase: event.phase,
        wallet_method: event.method,
        request_id: event.requestId,
        elapsed_ms: event.elapsedMs,
        sell_token: selectedTokenSell.label,
        buy_token: selectedTokenBuy.label,
      });
    },
  });

  const {
    getSmartBalancingAmounts,
    estimateGasForPurchaseGlowEarlyLiquidity,
  } = usePurchaseGlow();
  const {
    swapUSDCToUSDG,
    estimateGasForswapUSDCToUSDG,
  } = useSwapUSDCToUSDG();
  const { estimateEthToUsdc, estimateGasForSwapEthToUsdc, swapEthToUsdc } =
    useSwapETHToUSDC();

  const { estimateGasForRedeemUSDG, getUSDCBalanceOfRedemptionContract } =
    useUSDGRedemption();

  const {
    getBalances,
    isReady,
    usdcBalance,
    setUsdcBalanceForSigner,
    usdgBalance,
    setUsdgBalanceForSigner,
    refreshBalances,
    glowBalance,
    hasError: erc20HasError,
    hasSigner,
  } = useER20Balances({
    signer,
  });

  // Network status check
  // Only flag a network issue once the signer hook has actually settled —
  // otherwise the brief "wallet connected but signer still resolving"
  // window on fresh page loads surfaces as a scary "Reconnect Wallet"
  // prompt even though nothing is broken.
  const hasWalletConnectionIssue =
    erc20HasError ||
    (!hasSigner && isConnected && !isSignerLoading && !balancesLoading);
  const hasNetworkIssues = isWrongNetwork || hasWalletConnectionIssue;

  const { run: debouncedEstimate, cancel: cancelEstimate } = useDebouncedAsync<
    SwapEstimateRequest,
    void
  >(
    async (request, signal) => {
      setEstimateQueueAmount((prev) => prev + 1);
      try {
        await estimateAmount(request, signal);
      } finally {
        setEstimateQueueAmount((prev) => prev - 1);
      }
    },
    { delayMs: 350 }
  );

  const updateAmountToSell = React.useCallback(
    (nextAmount: string) => {
      cancelEstimate();
      setEthToUsdcMinimumQuote(null);
      setCommittedQuote(null);
      setSmartBalancingAmounts(undefined);
      setEstimatedOutputAmount(defaultTokensEstimate);
      setEstimateErrorMessage(null);
      setActionErrorMessage(null);
      setIsFeesLoading(false);
      setAmountToSell(nextAmount);
    },
    [cancelEstimate],
  );

  const {
    swap,
    estimateOutputAmount,
    estimateGlowToUSDG,
    estimateGasForUniswap,
  } = useSwap({
    tokenA_address:
      selectedTokenSell.label === "ETH"
        ? swapTokens.USDG.address
        : selectedTokenSell.address,
    tokenB_address:
      selectedTokenSell.label === "ETH"
        ? swapTokens.GLOW.address
        : selectedTokenBuy.address,
  });

  const currentTokenEstimatedOutputAmount =
    estimatedOutputAmount[selectedTokenBuy.label];
  const hasCurrentQuote = isCurrentSwapQuote({
    quote: committedQuote,
    expectedKey: currentQuoteKey,
  });
  const requiresSmartBalancingQuote =
    selectedTokenBuy.label === "GLOW" &&
    (selectedTokenSell.label === "USDC" ||
      selectedTokenSell.label === "USDG" ||
      selectedTokenSell.label === "ETH");
  const hasValidSmartBalancingQuote = React.useMemo(() => {
    if (!requiresSmartBalancingQuote) return true;
    let budgetAtomic: bigint | undefined;
    if (selectedTokenSell.label !== "ETH") {
      try {
        budgetAtomic = parseUnits(amountToSell, 6);
      } catch {
        return false;
      }
    }
    return validateSmartBalancingQuote({
      quote: smartBalancingAmounts,
      budgetAtomic,
    }).ok;
  }, [
    amountToSell,
    requiresSmartBalancingQuote,
    selectedTokenSell.label,
    smartBalancingAmounts,
  ]);
  const hasActionableQuote = Boolean(
    hasValidSlippage &&
      hasCurrentQuote &&
      Number(currentTokenEstimatedOutputAmount) > 0 &&
      hasValidSmartBalancingQuote,
  );
  const isEstimateLoading =
    Boolean(
      amountToSell &&
        Number(amountToSell) > 0 &&
        hasValidSlippage &&
        !estimateErrorMessage &&
        (estimateQueueAmount !== 0 || !hasCurrentQuote),
    );
  const hasBondingAllocation = Boolean(
    smartBalancingAmounts &&
      smartBalancingAmounts.amount_in_glow_bonding_curve > 0n,
  );
  const reserveForPossibleBondingAllocation =
    hasBondingAllocation ||
    (selectedTokenSell.label === "ETH" && selectedTokenBuy.label === "GLOW") ||
    (selectedTokenBuy.label === "GLOW" && !hasCurrentQuote);
  const currentFlowGasUnits = React.useMemo(
    () =>
      estimateSwapGasUnits({
        sellToken: selectedTokenSell.label,
        buyToken: selectedTokenBuy.label,
        hasBondingAllocation: reserveForPossibleBondingAllocation,
      }),
    [
      reserveForPossibleBondingAllocation,
      selectedTokenBuy.label,
      selectedTokenSell.label,
    ],
  );
  const currentEthValueWei = React.useMemo(() => {
    if (selectedTokenSell.label !== "ETH") return 0n;
    try {
      return parseUnits(amountToSell, 18);
    } catch {
      return 0n;
    }
  }, [amountToSell, selectedTokenSell.label]);
  const fullFlowGasPreflight = useEthGasPreflight({
    estimatedGasUnits: currentFlowGasUnits,
    additionalRequiredWei: currentEthValueWei,
    safetyBps: 1_500,
    enabled:
      isConnected &&
      !isWrongNetwork &&
      selectedTokenSell.label === "ETH",
  });
  const hasInsufficientFullFlowGas =
    fullFlowGasPreflight.sufficient === false;
  const estimatedPriceImpactPct = React.useMemo(
    () =>
      computeGlowSwapPriceImpactPct({
        sellToken: selectedTokenSell.label,
        buyToken: selectedTokenBuy.label,
        sellAmount: amountToSell,
        buyAmount: currentTokenEstimatedOutputAmount,
        glowPriceUsd: glowPrice,
        ethPriceUsd: ethPriceInUSD,
      }),
    [
      amountToSell,
      currentTokenEstimatedOutputAmount,
      selectedTokenBuy.label,
      selectedTokenSell.label,
      glowPrice,
      ethPriceInUSD,
    ]
  );
  const shouldShowHighSlippageTradeWarning = Boolean(
    isHighSlippage &&
      estimatedPriceImpactPct &&
      estimatedPriceImpactPct.gt(HIGH_SLIPPAGE_WARNING_THRESHOLD)
  );
  const pricePerGlow =
    !isEstimateLoading &&
    (selectedTokenSell.label === "USDC" ||
      selectedTokenSell.label === "USDG") &&
    selectedTokenBuy.label === "GLOW"
      ? (() => {
          const usdIn = Number(amountToSell);
          const glowOut = Number(currentTokenEstimatedOutputAmount);
          if (!Number.isFinite(usdIn) || !Number.isFinite(glowOut)) return null;
          if (usdIn <= 0 || glowOut <= 0) return null;
          return usdIn / glowOut;
        })()
      : null;
  const exceedsGlowPriceCap =
    pricePerGlow !== null && pricePerGlow > GLOW_PRICE_HARD_CAP;
  const isGlowPriceHardCapped =
    selectedTokenBuy.label === "GLOW" &&
    (Number(glowPrice) >= GLOW_PRICE_HARD_CAP || exceedsGlowPriceCap);
  const glowLiquidityDisabledMessage =
    exceedsGlowPriceCap && pricePerGlow !== null
      ? `$${toFixedTruncate(
          pricePerGlow,
          6
        )} per GLW would require Early Liquidity, which is disabled right now.`
      : null;

  const openCurrentQuoteDialog = (
    smartAccountPreflight?: SmartAccountPreflight,
  ) => {
    const quoteIsCurrent = isCurrentSwapQuote({
      quote: committedQuote,
      expectedKey: currentQuoteKey,
      now: Date.now(),
    });
    if (
      pendingTx ||
      isWrongNetwork ||
      !hasValidSlippage ||
      !quoteIsCurrent ||
      !hasActionableQuote ||
      !committedQuote ||
      !address
    ) {
      toast.info(t.swap.quoteRefreshing);
      return false;
    }

    if (selectedTokenBuy.label === "GLOW") {
      let budgetAtomic: bigint | undefined;
      if (selectedTokenSell.label !== "ETH") {
        try {
          budgetAtomic = parseUnits(amountToSell, 6);
        } catch {
          toast.error(t.swap.quoteRefreshing);
          return false;
        }
      }
      const validation = validateSmartBalancingQuote({
        quote: smartBalancingAmounts,
        budgetAtomic,
      });
      if (!validation.ok) {
        toast.error(validation.error);
        return false;
      }
    }

    let minimumAmountOut: bigint;
    try {
      minimumAmountOut = computeAmountOutMin(
        parseUnits(currentTokenEstimatedOutputAmount, selectedTokenBuy.decimals),
        slippageBps,
      );
    } catch {
      toast.error(t.swap.quoteRefreshing);
      return false;
    }

    cancelPostDialogRefresh();
    setDialogQuote({
      amount: currentTokenEstimatedOutputAmount,
      amountToSell,
      selectedTokenSell,
      selectedTokenBuy,
      smartBalancingAmounts,
      slippageBps,
      quoteExpiresAt: committedQuote.quotedAt + SWAP_QUOTE_MAX_AGE_MS,
      expectedAccount: address,
      minimumAmountOut,
      ethToUsdcMinimum:
        ethToUsdcMinimumQuote?.key === currentQuoteKey
          ? ethToUsdcMinimumQuote.amountOutMinUsdc
          : undefined,
      smartAccountPreflight,
    });
    setIsDialogOpen(true);
    return true;
  };

  const openQuotedDialogAfterSmartAccountCheck = async () => {
    const operation = beginPageTransactionOperation();
    if (!operation) return;
    const { assertActive: assertTransactionActive } = operation;
    setPendingTx(true);
    try {
      const smartAccountPreflight = await checkSmartAccountBeforeSwap(
        assertTransactionActive,
      );
      assertTransactionActive();
      if (isSmartAccountBlocked(smartAccountPreflight?.status)) {
        setIsSmartAccountWarningOpen(true);
        trackEvent("buy_swap_blocked_smart_account", {
          sell_token: selectedTokenSell.label,
          buy_token: selectedTokenBuy.label,
        });
        return;
      }
      trackEvent("buy_usdc_to_token_dialog_open", {
        sell_token: selectedTokenSell.label,
        buy_token: selectedTokenBuy.label,
      });
      openCurrentQuoteDialog(smartAccountPreflight ?? undefined);
    } catch (error) {
      if (
        getTransactionOperationCancellation(error, assertTransactionActive)
      ) {
        return;
      }
      throw error;
    } finally {
      if (operation.finish()) setPendingTx(false);
    }
  };

  function handleResponseMessage(data: Result<unknown, string>) {
    if (data.ok) {
      toast.success(
        `$${selectedTokenSell.label} swaped successfully for ${toFixedTruncate(
          Number(currentTokenEstimatedOutputAmount),
          6
        )} ${selectedTokenBuy.label}`
      );
      setActionErrorMessage(null);
      trackEvent("buy_swap_result", {
        ok: true,
        sell_token: selectedTokenSell.label,
        buy_token: selectedTokenBuy.label,
      });
    } else {
      setActionErrorMessage(data.val);
      trackEvent("buy_swap_result", {
        ok: false,
        sell_token: selectedTokenSell.label,
        buy_token: selectedTokenBuy.label,
        error_message: data.val,
      });
    }
  }

  // Pure helpers live in utils/swap-input.ts for unit testing.
  // (kept here just as a local re-export to minimize call-site churn)

  function computeButtonProps(): {
    label: string;
    disabled: boolean;
    requiresQuote?: boolean;
    callback?: () => void | Promise<void>;
  } {
    if (isGlowPriceHardCapped) {
      return {
        label: t.swap.earlyLiquidityDisabled,
        disabled: true,
      };
    }
    if (isWrongNetwork) {
      return {
        label: t.wallet.switchTo(expectedNetworkLabel),
        disabled: isSwitchingChain,
        callback: handleSwitchNetwork,
      };
    }
    if (hasWalletConnectionIssue) {
      return {
        label: t.swap.reconnectWallet,
        disabled: false,
        callback: () => {
          forceDisconnect(disconnect, connectors);
        },
      };
    }
    if (!hasValidSlippage) {
      return {
        label: t.swap.invalidSlippage,
        disabled: true,
      };
    }
    if (Number(amountToSell) === 0) {
      return {
        label: t.swap.enterAnAmount,
        disabled: true,
      };
    } else if (Number(tokenSellBalance) < Number(amountToSell)) {
      if (selectedTokenSell.label === "ETH") {
        return {
          label: t.swap.insufficientEthBalance,
          disabled: true,
        };
      }
      if (selectedTokenSell.label === "USDC") {
        if (
          usdgBalance &&
          Number(formatUnits(usdgBalance, 6)) >= Number(amountToSell)
        ) {
          return {
            label: t.swap.buy,
            disabled: false,
            callback: () => {
              toast(t.swap.toastHasUsdg, {
                description: t.swap.toastUseUsdgInstead,
                duration: Infinity,
                action: {
                  label: t.swap.toastYes,
                  onClick: () => {
                    handleSelectTokenToSell("USDG");
                    setAmountToSell(amountToSell);
                  },
                },
                cancel: {
                  label: t.swap.toastNo,
                  onClick: () => {
                    void openQuotedDialogAfterSmartAccountCheck();
                    toast.dismiss();
                  },
                },
                position: "bottom-center",
              });
            },
          };
        }
        // fix ux show a modal or error instead
        return {
          label: t.swap.insufficientFunds,
          disabled: true,
          callback: () => {},
        };
      } else if (
        selectedTokenSell.label !== "USDG" &&
        selectedTokenBuy.label !== "GLOW"
      ) {
        return {
          label: t.swap.insufficientBalanceFor(selectedTokenSell.label),
          disabled: true,
        };
      } else {
        return {
          label: t.swap.convertUsdcToUsdg,
          disabled: false,
          callback: () => {
            handleSelectTokenToSell("USDC");
          },
        };
      }
    } else {
      if (selectedTokenSell.label === "USDC") {
        if (
          usdcBalance &&
          usdgBalance &&
          (() => {
            const amt = toUnitsDecimal(amountToSell, 6);
            return usdcBalance < amt && usdgBalance >= amt;
          })()
        ) {
          return {
            label: t.swap.swap,
            disabled: false,
            callback: () => {
              toast(t.swap.toastInsufficientUsdc, {
                description: t.swap.toastUseUsdgInstead,
                duration: Infinity,
                action: {
                  label: t.swap.toastYes,
                  onClick: () => {
                    handleSelectTokenToSell("USDG");
                    setAmountToSell(amountToSell);
                  },
                },
                cancel: {
                  label: t.swap.toastNo,
                  onClick: (e) => {
                    toast.dismiss();
                  },
                },
                position: "bottom-center",
              });
            },
          };
        }
        // For USDC -> USDG, show the dialog
        if (selectedTokenBuy.label === "USDG") {
          return {
            label: t.swap.swap,
            disabled: false,
            requiresQuote: true,
            callback: openQuotedDialogAfterSmartAccountCheck,
          };
        }
        // Otherwise (e.g., USDC -> GLOW), open the combined flow dialog
        return {
          label: t.swap.swap,
          disabled: false,
          requiresQuote: true,
          callback: openQuotedDialogAfterSmartAccountCheck,
        };
      } else if (
        selectedTokenSell.label === "USDG" &&
        selectedTokenBuy.label === "GLOW"
      ) {
        return {
          label: t.swap.swap,
          disabled: false,
          requiresQuote: true,
          callback: openQuotedDialogAfterSmartAccountCheck,
        };
      } else if (
        selectedTokenSell.label === "ETH" &&
        selectedTokenBuy.label === "GLOW"
      ) {
        return {
          label: t.swap.swap,
          disabled: false,
          requiresQuote: true,
          callback: openQuotedDialogAfterSmartAccountCheck,
        };
      } else if (
        selectedTokenSell.label === "GLOW" &&
        selectedTokenBuy.label === "USDC"
      ) {
        return {
          label: t.swap.swap,
          disabled: false,
          requiresQuote: true,
          callback: () => {
            handleBuy();
          },
        };
      } else if (
        selectedTokenSell.label === "GLOW" &&
        selectedTokenBuy.label === "USDG"
      ) {
        return {
          label: t.swap.swap,
          disabled: false,
          requiresQuote: true,
          callback: () => {
            handleBuy();
          },
        };
      } else {
        return {
          label: t.swap.swap,
          disabled: false,
          requiresQuote: true,
          callback: () => {
            handleBuy();
          },
        };
      }
    }
  }

  const handleBuy = async () => {
    if (pendingTx) return;
    if (
      !address ||
      !committedQuote ||
      isWrongNetwork ||
      !hasActionableQuote ||
      !isCurrentSwapQuote({
        quote: committedQuote,
        expectedKey: currentQuoteKey,
        now: Date.now(),
      })
    ) {
      toast.info(t.swap.quoteRefreshing);
      return;
    }
    if (
      selectedTokenSell.label === "ETH" &&
      (fullFlowGasPreflight.isChecking ||
        fullFlowGasPreflight.sufficient === false)
    ) {
      toast.error(t.swap.insufficientGasError);
      return;
    }

    const operation = beginPageTransactionOperation();
    if (!operation) return;
    const { assertActive: assertTransactionActive } = operation;
    setActionErrorMessage(null);
    setPendingTx(true);

    try {
      // This check crosses an RPC boundary, so it must belong to the same
      // operation generation as every write that follows it.
      const smartAccountPreflight = await checkSmartAccountBeforeSwap(
        assertTransactionActive,
      );
      assertTransactionActive();
      if (isSmartAccountBlocked(smartAccountPreflight?.status)) {
        setIsSmartAccountWarningOpen(true);
        trackEvent("buy_swap_blocked_smart_account", {
          sell_token: selectedTokenSell.label,
          buy_token: selectedTokenBuy.label,
        });
        return;
      }
      if (
        !isCurrentSwapQuote({
          quote: committedQuote,
          expectedKey: currentQuoteKey,
          now: Date.now(),
        })
      ) {
        throw new Error(t.swap.quoteRefreshing);
      }

      const amountIn = toUnitsDecimal(
        amountToSell,
        selectedTokenSell.decimals,
      );
      const reviewedMinimumOut = computeAmountOutMin(
        parseUnits(
          currentTokenEstimatedOutputAmount,
          selectedTokenBuy.decimals,
        ),
        slippageBps,
      );
      const quoteExpiresAt =
        committedQuote.quotedAt + SWAP_QUOTE_MAX_AGE_MS;
      if (
        selectedTokenBuy.label === "GLOW" &&
        selectedTokenSell.label === "USDG"
      ) {
        // Multi-leg GLW purchases must always run through the snapshotted
        // orchestrator so a failure cannot be retried from the middle.
        openCurrentQuoteDialog(smartAccountPreflight ?? undefined);
        return;
      } else if (
        selectedTokenBuy.label === "USDG" &&
        selectedTokenSell.label === "USDC"
      ) {
        const swapUSDCToUSDGRes = await swapUSDCToUSDG(amountIn, {
          expectedAccount: address,
          assertTransactionActive,
          smartAccountPreflight: smartAccountPreflight ?? undefined,
          walletRequest: createPageWalletRequestObserver(
            assertTransactionActive,
          ),
        });
        assertTransactionActive();
        handleResponseMessage(swapUSDCToUSDGRes);
      } else if (
        selectedTokenBuy.label === "USDC" &&
        selectedTokenSell.label === "USDG"
      ) {
        // Open the USDG to USDC redemption dialog instead of executing directly
        trackEvent("buy_usdg_redemption_dialog_open", {
          sell_token: selectedTokenSell.label,
          buy_token: selectedTokenBuy.label,
        });
        cancelPostDialogRefresh();
        setRedemptionQuote({
          amountToRedeem: amountToSell,
          quoteExpiresAt,
          expectedAccount: address,
          smartAccountPreflight: smartAccountPreflight ?? undefined,
        });
        setIsUsdgToUsdcRedemptionDialogOpen(true);
        return;
      } else if (
        selectedTokenSell.label === "GLOW" &&
        (selectedTokenBuy.label === "USDC" ||
          selectedTokenBuy.label === "USDG")
      ) {
        // Open the GLOW exit dialog instead of executing directly.
        trackEvent("buy_glow_to_usdc_dialog_open", {
          sell_token: selectedTokenSell.label,
          buy_token: selectedTokenBuy.label,
        });
        cancelPostDialogRefresh();
        setGlowExitQuote({
          amountToSell,
          estimatedOutputAmount: currentTokenEstimatedOutputAmount,
          minimumUsdgOut: reviewedMinimumOut,
          slippageBps,
          quoteExpiresAt,
          targetToken: selectedTokenBuy.label,
          expectedAccount: address,
          smartAccountPreflight: smartAccountPreflight ?? undefined,
        });
        setIsGlowToUsdcDialogOpen(true);
        return;
      } else if (
        selectedTokenSell.label === "ETH" &&
        selectedTokenBuy.label === "USDC"
      ) {
        const swapEthToUsdcRes = await swapEthToUsdc({
          amountInWei: amountIn,
          slippageBps,
          minimumAmountOutUsdc: reviewedMinimumOut,
          expectedAccount: address,
          assertTransactionActive,
          walletRequest: createPageWalletRequestObserver(
            assertTransactionActive,
          ),
        });
        assertTransactionActive();
        handleResponseMessage(swapEthToUsdcRes);
      } else {
        const swapRes = await swap({
          amount: amountIn,
          minimumAmountOut: reviewedMinimumOut,
          expectedAccount: address,
          assertTransactionActive,
          walletRequest: createPageWalletRequestObserver(
            assertTransactionActive,
          ),
        });
        assertTransactionActive();
        handleResponseMessage(swapRes);
      }
      await Promise.all([
        setUsdcBalanceForSigner(),
        setUsdgBalanceForSigner(),
      ]);
      assertTransactionActive();
      await getTokenSellBalance(assertTransactionActive);
      assertTransactionActive();
      startTransition(router.refresh);
    } catch (error: any) {
      if (
        getTransactionOperationCancellation(error, assertTransactionActive)
      ) {
        return;
      }

      let errorMessage = getReadableRpcErrorMessage(
        error,
        t.swap.transactionFailed
      );

      if (
        isInvalidWalletTxResponseError(error) ||
        isInvalidWalletTxResponseError(errorMessage)
      ) {
        errorMessage = INVALID_WALLET_TX_RESPONSE_MESSAGE;
      } else if (isInsufficientGasError(error) || isInsufficientGasError(errorMessage)) {
        // Spell out the constraint: gas is paid in ETH only, not USDC or other
        // tokens. Users with a USDC-only balance otherwise see a generic
        // "insufficient ETH for gas" line and don't know why their token
        // balance can't cover it.
        errorMessage = t.swap.insufficientGasErrorExplained;
      } else {
        errorMessage = normalizeSwapFailureMessage(errorMessage);
      }

      // Log critical swap errors to Sentry (skip user rejections)
      if (
        typeof window !== "undefined" &&
        !errorMessage.includes("User rejected") &&
        !errorMessage.includes("User denied")
      ) {
        const normalizedError =
          error instanceof Error ? error : new Error(errorMessage);
        Sentry.captureException(normalizedError, {
          tags: {
            swapFlow: "handleBuy",
            sellToken: selectedTokenSell.label,
            buyToken: selectedTokenBuy.label,
          },
          extra: {
            amountToSell,
            estimatedOutput: currentTokenEstimatedOutputAmount,
            slippageTolerance,
            errorMessage,
            errorCode: error?.code,
            errorReason: error?.reason,
          },
        });
      }

      // Prefer inline UI error for swap submit errors (avoid duplicating toast + UI).
      setActionErrorMessage(errorMessage);
      trackEvent("buy_swap_result", {
        ok: false,
        sell_token: selectedTokenSell.label,
        buy_token: selectedTokenBuy.label,
        error_message: errorMessage,
      });
    } finally {
      if (operation.finish()) setPendingTx(false);
    }
  };

  const getUniswapFees = async (amount_usdg_in_uniswap: number) => {
    if (amount_usdg_in_uniswap > 0) {
      const estimatedCostInUSDForUniswapResAfterAmountWithFees =
        await estimateGasForUniswap({
          amount: parseUnits(
            toFixedTruncate(Number(amount_usdg_in_uniswap), 6),
            6
          ),
          ethPriceInUSD,
        });

      if (estimatedCostInUSDForUniswapResAfterAmountWithFees.ok) {
        return estimatedCostInUSDForUniswapResAfterAmountWithFees.val;
      }
    }
    return "0";
  };

  const getGlowEarlyLiquidityFees = async (
    amount_out_glow_bonding_curve: number
  ) => {
    if (Number(amount_out_glow_bonding_curve) > 0) {
      const incrementsToPurchase = Math.floor(
        Number(amount_out_glow_bonding_curve) * 100
      );
      const res = await estimateGasForPurchaseGlowEarlyLiquidity({
        incrementsToPurchase,
        slippagePointsTenThousandths: BigInt(200),
        ethPriceInUSD,
      });
      if (res.ok) {
        return res.val;
      }
    }
    return "0";
  };

  const estimateAmount = async (
    { amount: amountStr, quoteKey }: SwapEstimateRequest,
    signal: AbortSignal,
  ) => {
    // Estimation is a read-only price quote and only needs the app's
    // publicClient (Alchemy). Don't block on the ethers signer resolving,
    // because (a) it can take several seconds to resolve on slow wallets
    // and (b) transient signer flickers would otherwise abort the estimate
    // mid-flow. Intentionally NO signer/isReady gate here.
    if (!publicClient) return;

    const clearQuotedState = () => {
      if (signal.aborted) return;
      setCommittedQuote(null);
      setEthToUsdcMinimumQuote(null);
      setSmartBalancingAmounts(undefined);
      setEstimatedOutputAmount(defaultTokensEstimate);
      setIsFeesLoading(false);
    };
    const commitCurrentQuote = () => {
      if (signal.aborted) return false;
      setCommittedQuote({ key: quoteKey, quotedAt: Date.now() });
      return true;
    };

    try {
      if (selectedTokenSell.label === "ETH") {
        if (!amountStr || amountStr === "0") {
          clearQuotedState();
          return;
        }
        if (!isEthPayEnabled) {
          clearQuotedState();
          return;
        }

        const slippageBps = slippagePctToBps(
          slippageTolerance,
          DEFAULT_SLIPPAGE_BPS
        );
        let ethWei: bigint;
        try {
          ethWei = parseUnits(amountStr, 18);
        } catch {
          clearQuotedState();
          if (!signal.aborted) {
            setEstimateErrorMessage("ETH supports at most 18 decimal places.");
          }
          return;
        }

        const ethQuoteRes = await estimateEthToUsdc({
          amountInWei: ethWei,
          slippageBps,
        });
        if (!ethQuoteRes.ok) {
          console.error(ethQuoteRes.val);
          if (!signal.aborted) {
            clearQuotedState();
            setEstimateErrorMessage(String(ethQuoteRes.val));
          }
          return;
        }
        if (signal.aborted) return;

        setEthToUsdcMinimumQuote({
          key: quoteKey,
          amountOutMinUsdc: ethQuoteRes.val.amountOutMinUsdc,
        });

        const usdcOut = formatUnits(ethQuoteRes.val.amountOutUsdc, 6);
        if (selectedTokenBuy.label === "USDC") {
          if (signal.aborted) return;
          setEstimateErrorMessage(null);
          setSmartBalancingAmounts(undefined);
          setEstimatedOutputAmount({
            ...defaultTokensEstimate,
            USDC: usdcOut,
          });
          commitCurrentQuote();
          return;
        }
        if (selectedTokenBuy.label !== "GLOW") {
          clearQuotedState();
          return;
        }

        const usdgEquivalent = usdcOut;
        const smartBalancingAmountsRes = await getSmartBalancingAmounts({
          amountUsdgIn: usdgEquivalent,
          earlyLiquidityCurrentPrice: Number(glowPrice),
          useEarlyLiquidity: false,
        });
        if (!smartBalancingAmountsRes.ok) {
          console.error(smartBalancingAmountsRes.val);
          if (!signal.aborted) {
            clearQuotedState();
            setEstimateErrorMessage(String(smartBalancingAmountsRes.val));
          }
          return;
        }
        if (signal.aborted) return;

        // Show the GLW quote immediately using the API's split. Fees and the
        // fee-aware split refinement are estimated in the background below.
        const apiUniOut = Number(smartBalancingAmountsRes.val.amount_out_uni);
        const apiBondingOut = Number(
          smartBalancingAmountsRes.val.amount_out_glow
        );
        const initialOutput =
          (Number.isFinite(apiUniOut) ? apiUniOut : 0) +
          (Number.isFinite(apiBondingOut) ? apiBondingOut : 0);

        setEstimateErrorMessage(null);
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: initialOutput.toString(),
        });
        setSmartBalancingAmounts({
          amount_in_glow_bonding_curve:
            smartBalancingAmountsRes.val.amount_in_glow_bonding_curve,
          amount_out_glow: toFixedTruncate(apiBondingOut, 18),
          amount_in_uni: smartBalancingAmountsRes.val.amount_in_uni,
          amount_out_uni: toFixedTruncate(apiUniOut, 18),
          uniswapGlowReserves: smartBalancingAmountsRes.val.uniswapGlowReserves,
          uniswapUSDGReserves: smartBalancingAmountsRes.val.uniswapUSDGReserves,
          earlyLiquidityCurrentPrice:
            smartBalancingAmountsRes.val.earlyLiquidityCurrentPrice,
          usdgToSpend: smartBalancingAmountsRes.val.usdgToSpend,
          estimatedCostInUSDForEarlyLiquidity: "0",
          estimatedCostInUSDForUniswap: "0",
          estimatedTotalGasInUSD: "0",
        });
        commitCurrentQuote();
        setIsFeesLoading(true);

        // Refine fees + split in the background — does not block the GLW quote.
        void (async () => {
          try {
            const usdcAmountWei = parseUnits(usdgEquivalent, 6);
            const [
              earlyLiquidityFeesInitial,
              uniswapFeesInitial,
              estimatedGasForswapUSDCToUSDGRes,
              ethGasRes,
            ] = await Promise.all([
              getGlowEarlyLiquidityFees(apiBondingOut),
              getUniswapFees(
                Number(
                  formatUnits(smartBalancingAmountsRes.val.amount_in_uni, 6)
                )
              ),
              estimateGasForswapUSDCToUSDG(usdcAmountWei, ethPriceInUSD),
              estimateGasForSwapEthToUsdc({
                amountInWei: ethWei,
                slippageBps,
              }),
            ]);
            if (signal.aborted) return;

            let estimatedGasForswapUSDCToUSDG = "0";
            if (estimatedGasForswapUSDCToUSDGRes.ok)
              estimatedGasForswapUSDCToUSDG =
                estimatedGasForswapUSDCToUSDGRes.val;

            let estimatedGasForSwapEthToUsdcUSD = "0";
            if (ethGasRes.ok && ethPriceInUSD) {
              const feeEth = Number(
                formatUnits(ethGasRes.val.estimatedFeeWei, 18)
              );
              estimatedGasForSwapEthToUsdcUSD = toFixedTruncate(
                feeEth * ethPriceInUSD,
                6
              );
            }

            const amountsWithFees = getOptimalUSDGAmountsWithFees({
              amount_glow_out_uniswap: apiUniOut,
              amount_glow_out_bonding_curve: apiBondingOut,
              fees: {
                uniswapFees: Number(uniswapFeesInitial),
                bondingCurveFees: Number(earlyLiquidityFeesInitial),
              },
              endingPriceIfBoth: Number(
                smartBalancingAmountsRes.val.earlyLiquidityCurrentPrice
              ),
              amount_usdg_in_uniswap: Number(
                formatUnits(smartBalancingAmountsRes.val.amount_in_uni, 6)
              ),
              amount_usdg_in_bonding_curve: Number(
                formatUnits(
                  smartBalancingAmountsRes.val.amount_in_glow_bonding_curve,
                  6
                )
              ),
              uniswapUSDGReserves: Number(
                smartBalancingAmountsRes.val.uniswapUSDGReserves
              ),
              uniswapGlowReserves: Number(
                smartBalancingAmountsRes.val.uniswapGlowReserves
              ),
              earlyLiquidityCurrentPrice: Number(glowPrice),
              usdgToSpend: Number(usdgEquivalent),
            });

            const [
              estimatedCostInUSDForUniswap,
              estimatedCostInUSDForEarlyLiquidityAmount,
            ] = await Promise.all([
              getUniswapFees(amountsWithFees.amount_usdg_in_uniswap),
              getGlowEarlyLiquidityFees(
                amountsWithFees.amount_out_glow_bonding_curve
              ),
            ]);
            if (signal.aborted) return;

            const estimatedTotalGasInUSD = toFixedTruncate(
              Number(estimatedCostInUSDForUniswap) +
                Number(estimatedCostInUSDForEarlyLiquidityAmount) +
                Number(estimatedGasForswapUSDCToUSDG) +
                Number(estimatedGasForSwapEthToUsdcUSD),
              6
            );

            setSmartBalancingAmounts({
              amount_in_glow_bonding_curve: parseUnits(
                toFixedTruncate(amountsWithFees.amount_usdg_in_bonding_curve, 6),
                6
              ),
              amount_out_glow: toFixedTruncate(
                amountsWithFees.amount_out_glow_bonding_curve,
                18
              ),
              amount_in_uni: parseUnits(
                toFixedTruncate(amountsWithFees.amount_usdg_in_uniswap, 6),
                6
              ),
              amount_out_uni: toFixedTruncate(
                amountsWithFees.amount_out_glow_uniswap,
                18
              ),
              uniswapGlowReserves:
                smartBalancingAmountsRes.val.uniswapGlowReserves,
              uniswapUSDGReserves:
                smartBalancingAmountsRes.val.uniswapUSDGReserves,
              earlyLiquidityCurrentPrice:
                smartBalancingAmountsRes.val.earlyLiquidityCurrentPrice,
              usdgToSpend: smartBalancingAmountsRes.val.usdgToSpend,
              estimatedCostInUSDForEarlyLiquidity:
                estimatedCostInUSDForEarlyLiquidityAmount,
              estimatedCostInUSDForUniswap,
              estimatedTotalGasInUSD,
            });

            const uniswapOutFresh = Number(
              amountsWithFees.amount_out_glow_uniswap
            );
            const bondingOutFresh = Number(
              amountsWithFees.amount_out_glow_bonding_curve
            );
            const finalOutput =
              (Number.isFinite(uniswapOutFresh) ? uniswapOutFresh : 0) +
              (Number.isFinite(bondingOutFresh) ? bondingOutFresh : 0);
            setEstimatedOutputAmount({
              ...defaultTokensEstimate,
              [selectedTokenBuy.label]: finalOutput.toString(),
            });
          } finally {
            if (!signal.aborted) setIsFeesLoading(false);
          }
        })();

        return;
      }
      if (selectedTokenBuy.label === "GLOW") {
        if (!amountStr || amountStr === "0") {
          clearQuotedState();
          setEstimateErrorMessage(null);
          return;
        }
        const smartBalancingAmountsRes = await getSmartBalancingAmounts({
          amountUsdgIn: Number(amountStr),
          earlyLiquidityCurrentPrice: Number(glowPrice),
          useEarlyLiquidity: false,
        });
        if (!smartBalancingAmountsRes.ok) {
          console.error(smartBalancingAmountsRes.val);
          if (!signal.aborted) {
            clearQuotedState();
            setEstimateErrorMessage(String(smartBalancingAmountsRes.val));
          }
          return;
        }
        if (signal.aborted) return;

        // Show the GLW quote immediately using the API's split. Fees and the
        // fee-aware split refinement are estimated in the background below.
        const apiUniOut = Number(smartBalancingAmountsRes.val.amount_out_uni);
        const apiBondingOut = Number(
          smartBalancingAmountsRes.val.amount_out_glow
        );
        const initialOutput =
          (Number.isFinite(apiUniOut) ? apiUniOut : 0) +
          (Number.isFinite(apiBondingOut) ? apiBondingOut : 0);

        setEstimateErrorMessage(null);
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: initialOutput.toString(),
        });
        setSmartBalancingAmounts({
          amount_in_glow_bonding_curve:
            smartBalancingAmountsRes.val.amount_in_glow_bonding_curve,
          amount_out_glow: toFixedTruncate(apiBondingOut, 18),
          amount_in_uni: smartBalancingAmountsRes.val.amount_in_uni,
          amount_out_uni: toFixedTruncate(apiUniOut, 18),
          uniswapGlowReserves: smartBalancingAmountsRes.val.uniswapGlowReserves,
          uniswapUSDGReserves: smartBalancingAmountsRes.val.uniswapUSDGReserves,
          earlyLiquidityCurrentPrice:
            smartBalancingAmountsRes.val.earlyLiquidityCurrentPrice,
          usdgToSpend: smartBalancingAmountsRes.val.usdgToSpend,
          estimatedCostInUSDForEarlyLiquidity: "0",
          estimatedCostInUSDForUniswap: "0",
          estimatedTotalGasInUSD: "0",
        });
        commitCurrentQuote();
        setIsFeesLoading(true);

        // Refine fees + split in the background — does not block the GLW quote.
        void (async () => {
          try {
            const usdcGasInputWei =
              selectedTokenSell.label === "USDC"
                ? toUnitsDecimal(amountStr, 6)
                : null;
            const [
              earlyLiquidityFeesInitial,
              uniswapFeesInitial,
              usdcToUsdgGasRes,
            ] = await Promise.all([
              getGlowEarlyLiquidityFees(apiBondingOut),
              getUniswapFees(
                Number(
                  formatUnits(smartBalancingAmountsRes.val.amount_in_uni, 6)
                )
              ),
              usdcGasInputWei
                ? estimateGasForswapUSDCToUSDG(usdcGasInputWei, ethPriceInUSD)
                : Promise.resolve(null),
            ]);
            if (signal.aborted) return;

            let estimatedGasForswapUSDCToUSDG = "0";
            if (usdcToUsdgGasRes && usdcToUsdgGasRes.ok) {
              estimatedGasForswapUSDCToUSDG = usdcToUsdgGasRes.val;
            }

            const amountsWithFees = getOptimalUSDGAmountsWithFees({
              amount_glow_out_uniswap: apiUniOut,
              amount_glow_out_bonding_curve: apiBondingOut,
              fees: {
                uniswapFees: Number(uniswapFeesInitial),
                bondingCurveFees: Number(earlyLiquidityFeesInitial),
              },
              endingPriceIfBoth: Number(
                smartBalancingAmountsRes.val.earlyLiquidityCurrentPrice
              ),
              amount_usdg_in_uniswap: Number(
                formatUnits(smartBalancingAmountsRes.val.amount_in_uni, 6)
              ),
              amount_usdg_in_bonding_curve: Number(
                formatUnits(
                  smartBalancingAmountsRes.val.amount_in_glow_bonding_curve,
                  6
                )
              ),
              uniswapUSDGReserves: Number(
                smartBalancingAmountsRes.val.uniswapUSDGReserves
              ),
              uniswapGlowReserves: Number(
                smartBalancingAmountsRes.val.uniswapGlowReserves
              ),
              earlyLiquidityCurrentPrice: Number(glowPrice),
              usdgToSpend: Number(amountStr),
            });

            const [
              estimatedCostInUSDForUniswap,
              estimatedCostInUSDForEarlyLiquidityAmount,
            ] = await Promise.all([
              getUniswapFees(amountsWithFees.amount_usdg_in_uniswap),
              getGlowEarlyLiquidityFees(
                amountsWithFees.amount_out_glow_bonding_curve
              ),
            ]);
            if (signal.aborted) return;

            const estimatedTotalGasInUSD = toFixedTruncate(
              Number(estimatedCostInUSDForUniswap) +
                Number(estimatedCostInUSDForEarlyLiquidityAmount) +
                Number(estimatedGasForswapUSDCToUSDG),
              6
            );

            setSmartBalancingAmounts({
              amount_in_glow_bonding_curve: parseUnits(
                toFixedTruncate(amountsWithFees.amount_usdg_in_bonding_curve, 6),
                6
              ),
              amount_out_glow: toFixedTruncate(
                amountsWithFees.amount_out_glow_bonding_curve,
                18
              ),
              amount_in_uni: parseUnits(
                toFixedTruncate(amountsWithFees.amount_usdg_in_uniswap, 6),
                6
              ),
              amount_out_uni: toFixedTruncate(
                amountsWithFees.amount_out_glow_uniswap,
                18
              ),
              uniswapGlowReserves:
                smartBalancingAmountsRes.val.uniswapGlowReserves,
              uniswapUSDGReserves:
                smartBalancingAmountsRes.val.uniswapUSDGReserves,
              earlyLiquidityCurrentPrice:
                smartBalancingAmountsRes.val.earlyLiquidityCurrentPrice,
              usdgToSpend: smartBalancingAmountsRes.val.usdgToSpend,
              estimatedCostInUSDForEarlyLiquidity:
                estimatedCostInUSDForEarlyLiquidityAmount,
              estimatedCostInUSDForUniswap,
              estimatedTotalGasInUSD,
            });

            const uniswapOutFresh = Number(
              amountsWithFees.amount_out_glow_uniswap
            );
            const bondingOutFresh = Number(
              amountsWithFees.amount_out_glow_bonding_curve
            );
            const finalOutput =
              (Number.isFinite(uniswapOutFresh) ? uniswapOutFresh : 0) +
              (Number.isFinite(bondingOutFresh) ? bondingOutFresh : 0);
            setEstimatedOutputAmount({
              ...defaultTokensEstimate,
              [selectedTokenBuy.label]: finalOutput.toString(),
            });
          } finally {
            if (!signal.aborted) setIsFeesLoading(false);
          }
        })();

        return;
      }
      if (
        selectedTokenBuy.label === "USDG" &&
        selectedTokenSell.label === "USDC"
      ) {
        if (signal.aborted) return; // stale
        setEstimateErrorMessage(null);
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: amountStr,
        });
        commitCurrentQuote();
        return;
      }
      if (
        selectedTokenBuy.label === "USDC" &&
        selectedTokenSell.label === "USDG"
      ) {
        if (signal.aborted) return; // stale
        setEstimateErrorMessage(null);
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: amountStr,
        });
        commitCurrentQuote();
        return;
      }
      if (
        selectedTokenBuy.label === "USDC" &&
        selectedTokenSell.label === "GLOW"
      ) {
        // For GLOW -> USDC, we need to estimate GLOW -> USDG first
        const estimateRes = await estimateGlowToUSDG({
          amountIn: toUnitsDecimal(amountStr, selectedTokenSell.decimals),
        });

        if (estimateRes.ok) {
          // USDG to USDC is 1:1, so the USDG amount equals USDC amount
          if (signal.aborted) return; // stale
          setEstimateErrorMessage(null);
          setEstimatedOutputAmount({
            ...defaultTokensEstimate,
            [selectedTokenBuy.label]: formatUnits(estimateRes.val, 6),
          });
          commitCurrentQuote();
        } else if (!signal.aborted) {
          clearQuotedState();
          setEstimateErrorMessage(String(estimateRes.val));
        }
        return;
      }
      const estimateRes = await estimateOutputAmount({
        amountIn: toUnitsDecimal(amountStr, selectedTokenSell.decimals),
      });

      if (estimateRes.ok) {
        if (signal.aborted) return; // stale
        setEstimateErrorMessage(null);
        setEstimatedOutputAmount({
          ...defaultTokensEstimate,
          [selectedTokenBuy.label]: formatUnits(
            estimateRes.val,
            selectedTokenBuy.decimals
          ),
        });
        commitCurrentQuote();
      } else if (!signal.aborted) {
        clearQuotedState();
        setEstimateErrorMessage(String(estimateRes.val));
      }
    } catch (error: any) {
      // Log estimate errors to Sentry
      if (typeof window !== "undefined") {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error(error?.message || t.swap.failedEstimateSwap);
        Sentry.captureException(normalizedError, {
          tags: {
            estimateFlow: "estimateAmount",
            sellToken: selectedTokenSell.label,
            buyToken: selectedTokenBuy.label,
          },
          extra: {
            amountStr,
            errorMessage: error?.message,
            errorCode: error?.code,
          },
        });
      }

      if (!signal.aborted) {
        clearQuotedState();
        setEstimateErrorMessage(
          error?.message || t.swap.failedEstimateSwap
        );
      }
    }
  };

  const getTokenSellBalance = async (
    assertTransactionActive?: AssertTransactionActive,
  ) => {
    try {
      assertTransactionActive?.();
      if (selectedTokenSell.label === "ETH") {
        assertTransactionActive?.();
        setBalancesLoading(false);
        setTokenSellBalance(ethBalanceFormatted);
        return;
      }
      setBalancesLoading(true);
      const balances = await getBalances();
      assertTransactionActive?.();
      await refreshBalances();
      assertTransactionActive?.();
      if (balances.ok) {
        const raw =
          selectedTokenSell.label === "USDC"
            ? balances.val.usdc
            : selectedTokenSell.label === "USDG"
            ? balances.val.usdg
            : balances.val.glow;
        assertTransactionActive?.();
        setTokenSellBalance(formatUnits(raw, selectedTokenSell.decimals));
      }
      assertTransactionActive?.();
      setBalancesLoading(false);
    } catch (error) {
      if (isTransactionOperationCancelled(error)) throw error;
      // A read may fail at the same time the page operation is disposed.
      // Re-check before logging or mutating local component state.
      assertTransactionActive?.();
      console.error("Error in getTokenSellBalance:", error);
      setBalancesLoading(false);
    }
  };

  const cancelPostDialogRefresh = () => {
    const replacement = beginPostDialogRefreshOperation();
    replacement?.finish();
  };

  const refreshAfterChildDialogClose = async (
    operation: TransactionOperation,
  ) => {
    try {
      operation.assertActive();
      if (selectedTokenSell && selectedTokenBuy && signer && isReady) {
        try {
          await Promise.all([
            setUsdcBalanceForSigner(),
            setUsdgBalanceForSigner(),
            getTokenSellBalance(operation.assertActive),
            refreshBalances(),
          ]);
          operation.assertActive();
        } catch (error) {
          if (isTransactionOperationCancelled(error)) return;
          // Preserve the existing best-effort refresh behavior, but only for
          // the still-current close generation.
          operation.assertActive();
        }
      }

      operation.assertActive();
      startTransition(() => {
        operation.assertActive();
        router.refresh();
      });
    } catch (error) {
      if (!isTransactionOperationCancelled(error)) throw error;
    } finally {
      operation.finish();
    }
  };

  const handleSelectTokenToSell = (value: string) => {
    if (!isSwapTokenLabel(value)) return;
    cancelPostDialogRefresh();
    cancelEstimate();
    const token = swapTokens[value];
    const nextBuyLabel = token.allowedPairs[0] as SwapTokenLabel | undefined;
    if (nextBuyLabel) setSelectedTokenBuy(swapTokens[nextBuyLabel]);

    setSelectedTokenSell(token);
    setSmartBalancingAmounts(undefined);
    setAmountToSell("");
    setEstimatedOutputAmount(defaultTokensEstimate);
    setActionErrorMessage(null);
    setEstimateErrorMessage(null);
    setIsFeesLoading(false);
    setCommittedQuote(null);
    setEthToUsdcMinimumQuote(null);
  };

  const handleSelectTokenToBuy = (value: string) => {
    if (!isSwapTokenLabel(value)) return;
    cancelPostDialogRefresh();
    cancelEstimate();
    setSelectedTokenBuy(swapTokens[value]);

    setSmartBalancingAmounts(undefined);

    setAmountToSell("");
    setEstimatedOutputAmount(defaultTokensEstimate);
    setActionErrorMessage(null);
    setEstimateErrorMessage(null);
    setIsFeesLoading(false);
    setCommittedQuote(null);
    setEthToUsdcMinimumQuote(null);
  };

  const buttonProps = computeButtonProps();
  const isNetworkRecoveryAction =
    isWrongNetwork || hasWalletConnectionIssue;
  const isFullFlowGasBlocked =
    selectedTokenSell.label === "ETH" &&
    (fullFlowGasPreflight.isChecking || hasInsufficientFullFlowGas);

  // Fetch only the sell token balance when sell token or wallet readiness changes
  useEffect(() => {
    if (!selectedTokenSell) return;
    if (selectedTokenSell.label === "ETH") {
      setTokenSellBalance(ethBalanceFormatted);
      setBalancesLoading(false);
      return;
    }
    if (signer && isReady) getTokenSellBalance();
  }, [selectedTokenSell, signer, isReady, ethBalanceFormatted]);

  // Estimate output as soon as the user has input — do NOT wait on the
  // ethers signer or balance query. Gating on signer/isReady used to
  // produce the "You receive: 0.00" bug where users typed before the
  // signer resolved (or during a transient signer flicker from wagmi
  // re-renders) and the in-flight estimate got aborted by this effect's
  // cleanup when the signer finally landed.
  // Deliberately NOT depending on publicClient here — its reference can
  // change on wagmi internal re-renders (new block, unrelated state
  // churn) even when the chain and transport have not changed. If we
  // tracked it as a dep, each churn would fire this effect's cleanup,
  // cancel the in-flight debounced estimate, and leave "You receive"
  // stuck at 0.00 when a balance query or similar state update happens
  // mid-estimate. estimateAmount checks publicClient itself at run time.
  useEffect(() => {
    cancelEstimate();
    setCommittedQuote(null);
    setEthToUsdcMinimumQuote(null);
    setSmartBalancingAmounts(undefined);
    setEstimatedOutputAmount(defaultTokensEstimate);
    setEstimateErrorMessage(null);
    setIsFeesLoading(false);

    if (
      selectedTokenSell &&
      selectedTokenBuy &&
      amountToSell &&
      hasValidSlippage &&
      !Number.isNaN(Number(amountToSell)) &&
      Number(amountToSell) > 0
    ) {
      debouncedEstimate({ amount: amountToSell, quoteKey: currentQuoteKey });
    }
    return () => {
      cancelEstimate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuoteKey, hasValidSlippage]);

  useEffect(() => {
    if (!committedQuote || committedQuote.key !== currentQuoteKey) return;

    const refreshDelay =
      committedQuote.quotedAt + SWAP_QUOTE_MAX_AGE_MS - Date.now();
    const refreshQuote = () => {
      cancelEstimate();
      setCommittedQuote((current) =>
        current?.key === committedQuote.key &&
        current.quotedAt === committedQuote.quotedAt
          ? null
          : current,
      );
      setSmartBalancingAmounts(undefined);
      setEstimatedOutputAmount(defaultTokensEstimate);
      setEstimateErrorMessage(null);
      setIsFeesLoading(false);
      if (
        amountToSell &&
        hasValidSlippage &&
        Number(amountToSell) > 0
      ) {
        debouncedEstimate({ amount: amountToSell, quoteKey: currentQuoteKey });
      }
    };

    if (refreshDelay <= 0) {
      refreshQuote();
      return;
    }

    const timer = window.setTimeout(refreshQuote, refreshDelay + 1);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedQuote, currentQuoteKey]);

  // Add effect to fetch USDC balance when wallet connects
  useEffect(() => {
    const fetchUsdcInRedemption = async () => {
      if (isConnected && !isWalletLoading) {
        setIsUsdcInRedemptionLoading(true);
        const balance = await getUSDCBalanceOfRedemptionContract();
        if (balance) {
          setUsdcInRedemption(Number(formatUnits(balance, 6)));
        }
        setIsUsdcInRedemptionLoading(false);
      }
    };
    fetchUsdcInRedemption();
  }, [isConnected, isWalletLoading]);

  useEffect(() => {
    async function estimate() {
      if (!usdgWithdrawAmount || Number(usdgWithdrawAmount) <= 0) {
        setEstimatedWithdrawGas("");
        return;
      }
      try {
        const res = await estimateGasForRedeemUSDG(
          parseUnits(usdgWithdrawAmount, 6),
          ethPriceInUSD
        );
        if (res.ok) setEstimatedWithdrawGas(res.val);
        else setEstimatedWithdrawGas("");
      } catch {
        setEstimatedWithdrawGas("");
      }
    }
    estimate();
  }, [usdgWithdrawAmount, ethPriceInUSD, estimateGasForRedeemUSDG]);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        !isDialog && "lg:grid-cols-[1fr_320px] mt-2 lg:mt-4"
      )}
    >
      {/* Main Swap Content */}
      <div
        className={cn(
          "bg-card rounded-3xl border border-border/20 overflow-hidden w-full h-fit mx-auto",
          isDialog ? "p-0 border-0" : "p-4 lg:p-6 max-w-[600px] lg:max-w-none"
        )}
      >
        <div className="space-y-1">
          <div className="flex justify-end pb-3">
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
          {/* Enhanced From Token */}
          <div className="group relative bg-muted/30 dark:bg-muted/50 rounded-3xl p-4 lg:p-6 border border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                {t.swap.youPay}
              </span>
              {isConnected && (
                <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground">
                  <span>
                    {t.swap.balance}{" "}
                    <span className="font-medium">
                      {isWalletLoading || balancesLoading ? (
                        <Skeleton className="w-16 h-4 inline-block" />
                      ) : (
                        Number(tokenSellBalance).toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })
                      )}
                    </span>
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      className="h-7 px-2 py-0 text-xs"
                      disabled={
                        !isConnected ||
                        isWalletLoading ||
                        balancesLoading ||
                        pendingTx
                      }
                      onClick={async () => {
                        if (selectedTokenSell.label === "ETH") {
                          const ethBalanceWei = ethBalanceQuery.data?.value;
                          if (!ethBalanceWei) return;

                          try {
                            const bufferedFeeWei =
                              fullFlowGasPreflight.gasCostWei;
                            if (bufferedFeeWei === null) {
                              throw new Error(t.swap.failedComputeMaxEth);
                            }
                            const maxSpendWei =
                              ethBalanceWei > bufferedFeeWei
                                ? ethBalanceWei - bufferedFeeWei
                                : 0n;
                            updateAmountToSell(
                              formatEthMaxFromWei(maxSpendWei),
                            );
                          } catch (e: any) {
                            toast.error(
                              e?.message || t.swap.failedComputeMaxEth
                            );
                          }
                          return;
                        }

                        const maxVal = toFixedTruncate(
                          Number(tokenSellBalance || 0),
                          selectedTokenSell.toFixed
                        );
                        updateAmountToSell(maxVal);
                      }}
                    >
                      {t.swap.max}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-7 w-7 p-0"
                          aria-label={t.swap.slippageAriaLabel}
                          disabled={!isConnected || isWalletLoading || pendingTx}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="min-w-[220px]"
                      >
                        <DropdownMenuLabel>
                          {t.swap.slippageTolerance}
                        </DropdownMenuLabel>
                        <div className="px-3 pb-2 text-[11px] text-muted-foreground">
                          {t.swap.slippageCurrent}{" "}
                          <span className="font-mono text-foreground">
                            {slippageTolerance}%
                          </span>
                        </div>
                        {shouldShowHighSlippageTradeWarning && (
                          <div className="mx-3 mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <div>
                                {t.swap.slippagePriceImpact(
                                  toFixedTruncate(
                                    estimatedPriceImpactPct?.toNumber() ?? 0,
                                    2
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={slippageTolerance}
                          onValueChange={(value) => {
                            setSlippageToleranceWithWarning(
                              normalizeSlippageTolerance(
                                value,
                                DEFAULT_SLIPPAGE_TOLERANCE
                              )
                            );
                          }}
                        >
                          {["0.5", "1", "2", "5", "10", "15"].map((value) => (
                            <DropdownMenuRadioItem key={value} value={value}>
                              {value}%
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <div className="px-3 py-2">
                          <div className="mb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {t.swap.slippageCustom}
                          </div>
                          <Input
                            inputMode="decimal"
                            max={MAX_SLIPPAGE_TOLERANCE_PCT}
                            placeholder={t.swap.placeholderSlippageExample(
                              DEFAULT_SLIPPAGE_TOLERANCE,
                            )}
                            value={slippageTolerance}
                            aria-invalid={!hasValidSlippage}
                            onChange={(e) => {
                              // Accept comma as decimal separator (common in EU locales)
                              const next = e.target.value.replace(",", ".");
                              if (!/^\d*\.?\d*$/.test(next)) return;
                              setSlippageToleranceWithWarning(next);
                            }}
                            onBlur={() => {
                              setSlippageToleranceWithWarning(
                                normalizeSlippageTolerance(
                                  slippageTolerance,
                                  DEFAULT_SLIPPAGE_TOLERANCE
                                )
                              );
                            }}
                            className="h-9"
                          />
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}
            </div>
            {shouldShowHighSlippageTradeWarning && (
              <div className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    {t.swap.slippagePriceImpact(
                      toFixedTruncate(
                        estimatedPriceImpactPct?.toNumber() ?? 0,
                        2
                      )
                    )}{" "}
                    {t.swap.slippageHighEnabled(slippageTolerance)}
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={
                    isConnected && balancesLoading
                      ? t.swap.placeholderLoadingBalances
                      : t.swap.placeholder0
                  }
                  className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full"
                  value={amountToSell}
                  disabled={
                    !isConnected ||
                    isWalletLoading ||
                    balancesLoading ||
                    pendingTx
                  }
                  onChange={(e) => {
                    const next = parseSwapInputValue(e.target.value);
                    if (next === null) return;
                    updateAmountToSell(next);
                  }}
                />
              </div>
              <Select
                disabled={!isConnected || isWalletLoading || pendingTx}
                value={selectedTokenSell.label}
                onValueChange={handleSelectTokenToSell}
              >
                <SelectTrigger className="w-full sm:w-[140px] lg:w-[160px] h-12 lg:h-14 rounded-xl border-border bg-background font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="GLOW">GLOW</SelectItem>
                  <SelectItem value="USDG">USDG</SelectItem>
                  {isEthPayEnabled && <SelectItem value="ETH">ETH</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Enhanced Swap Direction */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                disabled={!isConnected || isWalletLoading || pendingTx}
                onClick={handleSwapDirection}
                className="bg-card border-2 border-border/30 rounded-full p-2 lg:p-3 hover:bg-muted/30 transition-colors z-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <ArrowDownUp className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Enhanced To Token */}
          <div className="group relative bg-muted/30 dark:bg-muted/50 rounded-3xl p-4 lg:p-6 border border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs lg:text-sm font-medium text-muted-foreground">
                {t.swap.youReceive}
              </span>
              {isEstimateLoading && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  {t.swap.calculating}
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                {isEstimateLoading ? (
                  <Skeleton className="h-10 lg:h-14 w-full bg-muted/50" />
                ) : (
                  <Input
                    placeholder={t.swap.placeholder0}
                    className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-transparent border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/40 w-full"
                    value={
                      Number(currentTokenEstimatedOutputAmount)
                        ? formatPrice(
                            currentTokenEstimatedOutputAmount,
                            selectedTokenBuy.toFixed
                          )
                        : ""
                    }
                    disabled={!isConnected || isWalletLoading}
                    readOnly
                  />
                )}
                {pricePerGlow !== null && !isEstimateLoading && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {glowLiquidityDisabledMessage ??
                      t.swap.pricePerGlw(toFixedTruncate(pricePerGlow, 6))}
                  </div>
                )}
              </div>
              <Select
                disabled={!isConnected || isWalletLoading || pendingTx}
                value={selectedTokenBuy.label}
                onValueChange={handleSelectTokenToBuy}
              >
                <SelectTrigger className="w-full sm:w-[140px] lg:w-[160px] h-12 lg:h-14 rounded-xl border-border bg-background font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedTokenSell.allowedPairs.map((token) => (
                    <SelectItem key={token} value={token}>
                      {token}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Enhanced Transaction Details */}
          {smartBalancingAmounts && selectedTokenBuy.label === "GLOW" && (
            <div className="mt-4 bg-gradient-to-r from-muted/10 to-muted/5 dark:from-muted/20 dark:to-muted/10 rounded-xl p-4 lg:p-5 space-y-4 border border-border/20 dark:border-border/40">
              {/* Only show route details if using both Uniswap and Bonding Curve */}
              {Number(smartBalancingAmounts?.amount_out_glow) > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      {t.swap.uniswapRoute}
                    </div>
                    <div className="text-sm font-medium">
                      {isEstimateLoading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        `${Number(
                          smartBalancingAmounts?.amount_out_uni
                        ).toFixed(6)} GLOW`
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      {t.swap.bondingCurve}
                    </div>
                    <div className="text-sm font-medium">
                      {isEstimateLoading ? (
                        <Skeleton className="w-16 h-4" />
                      ) : (
                        `${Number(
                          smartBalancingAmounts?.amount_out_glow
                        ).toFixed(6)} GLOW`
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-border/20 dark:border-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs lg:text-sm text-muted-foreground">
                    {t.swap.estimatedNetworkFee}
                  </span>
                  <span className="text-xs lg:text-sm font-medium">
                    {isEstimateLoading || isFeesLoading ? (
                      <Skeleton className="w-16 h-4" />
                    ) : (
                      `~$${Number(
                        smartBalancingAmounts.estimatedTotalGasInUSD
                      ).toFixed(2)}`
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {estimateErrorMessage && (
            <div className="mt-3 text-xs text-destructive">
              {estimateErrorMessage}
            </div>
          )}

          {/* Enhanced Swap Button */}
          <div className="pt-5 space-y-3">
            {!isConnected || isConnecting ? (
              <ConnectButton variant="default" />
            ) : (
              <Button
                disabled={
                  buttonProps.disabled ||
                  (!isNetworkRecoveryAction &&
                    (pendingTx ||
                      isEstimateLoading ||
                      balancesLoading ||
                      isFullFlowGasBlocked ||
                      (buttonProps.requiresQuote === true &&
                        !hasActionableQuote)))
                }
                onClick={async () => {
                  if (
                    buttonProps.requiresQuote &&
                    (!hasActionableQuote ||
                      !isCurrentSwapQuote({
                        quote: committedQuote,
                        expectedKey: currentQuoteKey,
                        now: Date.now(),
                      }))
                  ) {
                    toast.info(t.swap.quoteRefreshing);
                    return;
                  }
                  if (!isNetworkRecoveryAction && isFullFlowGasBlocked) {
                    toast.error(t.swap.insufficientGasError);
                    return;
                  }
                  const isSwapAction =
                    buttonProps.label === "SWAP" ||
                    buttonProps.label === "BUY" ||
                    buttonProps.label === "CONVERT USDC TO USDG";
                  if (isSwapAction) {
                    trackEvent("buy_swap_click", {
                      sell_token: selectedTokenSell.label,
                      buy_token: selectedTokenBuy.label,
                      amount_in: amountToSell,
                      slippage_pct: slippageTolerance,
                      has_network_issues: hasNetworkIssues,
                    });
                  }
                  await Promise.resolve(buttonProps.callback?.());
                }}
                className="w-full h-12 lg:h-16"
              >
                {pendingTx && (
                  <div className="mr-3">
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  </div>
                )}
                {pendingTx ? t.swap.processing : buttonProps.label}
              </Button>
            )}

            {(() => {
              if (!isConnected || isConnecting) return null;
              if (selectedTokenSell.label !== "USDC") return null;
              const usdcBalanceUsd =
                usdcBalance != null
                  ? Number(formatUnits(usdcBalance, 6))
                  : 0;
              const desiredUsdc = Number(amountToSell);
              if (!Number.isFinite(desiredUsdc) || desiredUsdc <= 0) return null;
              if (desiredUsdc <= usdcBalanceUsd) return null;
              const deficitUsd = desiredUsdc - usdcBalanceUsd;
              // On-ramp providers enforce minimum order amounts that vary by
              // region and payment method (MoonPay ~$16-20, Coinbase ~$5).
              // Floor at $20 so the on-ramp always accepts the request; any
              // surplus stays in the user's wallet as USDC.
              const MIN_CARD_FUND_USDC = 20;
              const roundedDeficit = Math.ceil(deficitUsd * 100) / 100;
              const cardFundAmount = Math.max(
                MIN_CARD_FUND_USDC,
                roundedDeficit
              ).toFixed(2);
              const isMinimumApplied = roundedDeficit < MIN_CARD_FUND_USDC;
              return (
                // Hidden on mobile: in-app dApp browsers (MetaMask, Trust)
                // silently block the on-ramp popup. Card flow is desktop-only
                // until Privy ships better WebView support.
                <div className="hidden lg:block space-y-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleBuyWithCard(cardFundAmount)}
                    disabled={pendingTx}
                    className="w-full h-11 lg:h-12 gap-2 font-medium"
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

            {actionErrorMessage && (
              <div className="text-sm text-destructive mt-3">
                {actionErrorMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Sidebar - Hidden on mobile, visible on lg and up */}
      {!isDialog && (
        <aside className="lg:sticky lg:top-4 h-fit space-y-4">
          <StatsSidebar
            marketCap={marketCap}
            usdcInRedemption={usdcInRedemption}
            statsLoading={false}
            isUsdcInRedemptionLoading={isUsdcInRedemptionLoading}
            isWalletLoading={isWalletLoading}
          />
        </aside>
      )}

      {/* Dialogs */}
      {dialogQuote && (
        <UsdcToTokenDialog
          isOpen={isDialogOpen}
          amount={dialogQuote.amount}
          amountToSell={dialogQuote.amountToSell}
          selectedTokenSell={dialogQuote.selectedTokenSell}
          selectedTokenBuy={dialogQuote.selectedTokenBuy}
          smartBalancingAmounts={dialogQuote.smartBalancingAmounts}
          swapUSDCToUSDG={swapUSDCToUSDG}
          quoteExpiresAt={dialogQuote.quoteExpiresAt}
          expectedAccount={dialogQuote.expectedAccount}
          minimumAmountOut={dialogQuote.minimumAmountOut}
          ethToUsdcMinimum={dialogQuote.ethToUsdcMinimum}
          smartAccountPreflight={dialogQuote.smartAccountPreflight}
          onOpenChange={async (open) => {
            const refreshOperation = beginPostDialogRefreshOperation();
            setIsDialogOpen(open);
            if (open) {
              refreshOperation?.finish();
              return;
            }
            setDialogQuote(null);
            cancelEstimate();
            setAmountToSell("");
            setEstimatedOutputAmount(defaultTokensEstimate);
            setSmartBalancingAmounts(undefined);
            setCommittedQuote(null);
            setEthToUsdcMinimumQuote(null);

            if (refreshOperation) {
              await refreshAfterChildDialogClose(refreshOperation);
            }
          }}
          slippagePointsTenThousandths={dialogQuote.slippageBps}
        />
      )}
      {glowExitQuote && (
        <GlowToUsdcDialog
          isOpen={isGlowToUsdcDialogOpen}
          amountToSell={glowExitQuote.amountToSell}
          estimatedOutputAmount={glowExitQuote.estimatedOutputAmount}
          minimumUsdgOut={glowExitQuote.minimumUsdgOut}
          slippageBps={glowExitQuote.slippageBps}
          quoteExpiresAt={glowExitQuote.quoteExpiresAt}
          expectedAccount={glowExitQuote.expectedAccount}
          smartAccountPreflight={glowExitQuote.smartAccountPreflight}
          targetToken={glowExitQuote.targetToken}
          onOpenChange={async (open) => {
            const refreshOperation = beginPostDialogRefreshOperation();
            setIsGlowToUsdcDialogOpen(open);
            if (open) {
              refreshOperation?.finish();
              return;
            }
            setGlowExitQuote(null);
            setAmountToSell("");
            setEstimatedOutputAmount(defaultTokensEstimate);
            setSmartBalancingAmounts(undefined);
            setCommittedQuote(null);

            if (refreshOperation) {
              await refreshAfterChildDialogClose(refreshOperation);
            }
          }}
        />
      )}
      {redemptionQuote && (
        <UsdgToUsdcRedemptionDialog
          isOpen={isUsdgToUsdcRedemptionDialogOpen}
          amountToRedeem={redemptionQuote.amountToRedeem}
          quoteExpiresAt={redemptionQuote.quoteExpiresAt}
          expectedAccount={redemptionQuote.expectedAccount}
          smartAccountPreflight={redemptionQuote.smartAccountPreflight}
          onOpenChange={async (open) => {
            const refreshOperation = beginPostDialogRefreshOperation();
            setIsUsdgToUsdcRedemptionDialogOpen(open);
            if (open) {
              refreshOperation?.finish();
              return;
            }
            setRedemptionQuote(null);
            setAmountToSell("");
            setEstimatedOutputAmount(defaultTokensEstimate);
            setSmartBalancingAmounts(undefined);
            setCommittedQuote(null);

            if (refreshOperation) {
              await refreshAfterChildDialogClose(refreshOperation);
            }
          }}
        />
      )}

      {/* Smart Account Warning Dialog */}
      <SmartAccountWarningDialog
        open={isSmartAccountWarningOpen}
        onOpenChange={setIsSmartAccountWarningOpen}
        triggerCheck={false}
      />
    </div>
  );
}

"use client";

import * as React from "react";
import Decimal from "decimal.js";
import { formatUnits, parseUnits } from "viem";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBalance, useChainId } from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  useLogin,
  usePrivy,
} from "@privy-io/react-auth";
import { useCardOnramp } from "@/hooks/use-card-onramp";
import {
  Sun,
  X,
  ChevronLeft,
  CreditCard,
  Zap,
  Check,
  Loader2,
  Info,
} from "lucide-react";
import {
  DECIMALS_BY_TOKEN,
  type PendingTransfer,
} from "@glowlabs-org/utils/browser";

import * as Sentry from "@sentry/nextjs";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Slider } from "../ui/slider";
import { Checkbox } from "../ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ConnectButton } from "../connect-button";
import { UnstakingExplanationModal } from "./unstaking-explanation-modal";
import {
  TransactionStepper,
  type TransactionStep,
  type StepStatus,
} from "@/components/transaction-stepper";
import { SegmentedCircleProgress } from "@/components/ui/circle-progress";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import {
  useActiveRegionsSummary,
  useGctlPreparationOrchestrator,
  useRegions,
  useWallets,
} from "@/hooks";
import { useDebouncedAsync } from "@/hooks/useDebouncedAsync";
import { useLang } from "@/lib/i18n";
import { useImpactWalletStats } from "@/hooks/hub-impact";
import { getGctlDialogErrorMessage } from "@/lib/gctl-dialog-error-message";
import { isInsufficientGasError } from "@/lib/rpc-error-utils";
import { capturePrivyWalletError } from "@/lib/privy-errors";
import { trackEvent } from "@/lib/telemetry";
import { bucketEth, bucketToken, bucketUsd } from "@/lib/telemetry-buckets";
import { getStoredReferralAttribution } from "@/lib/referral-attribution";
import { cn } from "@/lib/utils";
import { SteeringIcon } from "@/components/impact-icons";
import { usePolling } from "@/utils/use-polling";

// --- Types & Constants ---

interface MintAndStakeGctlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usdcBalance: bigint | null;
  usdgBalance: bigint | null;
  forceStep1?: boolean;
}

type SourceCurrency = "GCTL" | "USDC" | "USDG" | "ETH";

const STEERING_POINTS_PER_GLW = 3;
const ETH_DECIMALS = 18;
const DEFAULT_SLIPPAGE_BPS = 100n; // 1%

// --- Helpers ---

function isValidDecimalInput(value: string) {
  return value === "" || /^\d*\.?\d*$/.test(value);
}

function trimToDecimals(value: string, decimals: number) {
  if (!value) return "";
  if (!value.includes(".")) return value;
  const [i, f = ""] = value.split(".");
  return `${i}.${f.slice(0, Math.max(0, decimals))}`;
}

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundDownToDecimalsString(value: number, decimals: number) {
  try {
    if (!Number.isFinite(value) || value <= 0) return "0";
    return new Decimal(value)
      .toDecimalPlaces(decimals, Decimal.ROUND_DOWN)
      .toFixed(decimals);
  } catch {
    return "0";
  }
}

function getWeeksInRange(weekRange: { startWeek: number; endWeek: number }) {
  const raw = weekRange.endWeek - weekRange.startWeek + 1;
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, raw);
}

function formatTokenAmount(
  amount: number,
  options?: { maximumFractionDigits?: number },
) {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  });
}

function formatCompact(
  value: number,
  options?: { maximumFractionDigits?: number },
) {
  if (!Number.isFinite(value)) return "—";
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(maximumFractionDigits)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(maximumFractionDigits)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(maximumFractionDigits)}K`;
  return value.toFixed(
    abs >= 10 ? maximumFractionDigits : Math.min(4, maximumFractionDigits),
  );
}

function formatPercent1(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
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

function toAtomic6(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0n;
  return BigInt(new Decimal(amount).mul(1_000_000).floor().toFixed(0));
}

function toWholeNumberString(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return Math.floor(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

function gctlAmountFromRaw(raw: string | null | undefined) {
  try {
    return Number(formatUnits(BigInt(raw || "0"), DECIMALS_BY_TOKEN.GCTL));
  } catch {
    return 0;
  }
}

function computeSteeringScorePoints(args: {
  activeSummary: any | null | undefined;
  userStakedGctlByRegionId: Map<number, number>;
  addedGctl: number;
  selectedRegionId: number | null;
}) {
  const {
    activeSummary,
    userStakedGctlByRegionId,
    addedGctl,
    selectedRegionId,
  } = args;
  if (!activeSummary) return 0;

  const totalGlwRewards = Number(activeSummary.totalGlwRewards);
  const totalStaked = Number(activeSummary.totalGctlStaked);
  if (!Number.isFinite(totalGlwRewards) || totalGlwRewards <= 0) return 0;
  if (!Number.isFinite(totalStaked) || totalStaked <= 0) return 0;

  const delta = Number.isFinite(addedGctl) ? Math.max(0, addedGctl) : 0;
  const regions: any[] = Array.isArray(activeSummary.regions)
    ? activeSummary.regions
    : [];

  let totalDirectedGlw = 0;

  // Baseline: mirror `use-gctl-steering` exactly (use current region `glwPerWeek`)
  if (!selectedRegionId || delta <= 0) {
    for (const r of regions) {
      const regionId = Number(r?.id);
      if (!Number.isFinite(regionId)) continue;

      const regionStaked = Number(r?.stakedGctl);
      if (!Number.isFinite(regionStaked) || regionStaked <= 0) continue;

      const regionGlwPerWeek = Number(r?.glwPerWeek);
      if (!Number.isFinite(regionGlwPerWeek) || regionGlwPerWeek <= 0) continue;

      const userStaked = userStakedGctlByRegionId.get(regionId) ?? 0;
      if (!Number.isFinite(userStaked) || userStaked <= 0) continue;

      const share = userStaked / regionStaked;
      if (!Number.isFinite(share) || share <= 0) continue;

      totalDirectedGlw += regionGlwPerWeek * share;
    }

    if (!Number.isFinite(totalDirectedGlw) || totalDirectedGlw <= 0) return 0;
    return totalDirectedGlw * STEERING_POINTS_PER_GLW;
  }

  // Preview: re-compute region weekly emissions after adding stake to selected region
  const nextTotalStaked = totalStaked + delta;
  if (!Number.isFinite(nextTotalStaked) || nextTotalStaked <= 0) return 0;

  for (const r of regions) {
    const regionId = Number(r?.id);
    if (!Number.isFinite(regionId)) continue;

    const currentRegionStaked = Number(r?.stakedGctl);
    if (!Number.isFinite(currentRegionStaked) || currentRegionStaked <= 0)
      continue;

    const regionDelta = selectedRegionId === regionId ? delta : 0;
    const nextRegionStaked = currentRegionStaked + regionDelta;
    if (!Number.isFinite(nextRegionStaked) || nextRegionStaked <= 0) continue;

    const nextRegionGlwPerWeek =
      totalGlwRewards * (nextRegionStaked / nextTotalStaked);
    if (!Number.isFinite(nextRegionGlwPerWeek) || nextRegionGlwPerWeek <= 0)
      continue;

    const userCurrentStaked = userStakedGctlByRegionId.get(regionId) ?? 0;
    const userNextStaked = userCurrentStaked + regionDelta;
    if (!Number.isFinite(userNextStaked) || userNextStaked <= 0) continue;

    const share = userNextStaked / nextRegionStaked;
    if (!Number.isFinite(share) || share <= 0) continue;

    totalDirectedGlw += nextRegionGlwPerWeek * share;
  }

  if (!Number.isFinite(totalDirectedGlw) || totalDirectedGlw <= 0) return 0;
  return totalDirectedGlw * STEERING_POINTS_PER_GLW;
}

// --- Component ---

export function MintAndStakeGctlDialog({
  open,
  onOpenChange,
  usdcBalance,
  usdgBalance,
  forceStep1 = false,
}: MintAndStakeGctlDialogProps) {
  const { t } = useLang();
  const m = t.bigDialogs.mintStake;
  const { address, isConnected } = useAccount();
  const { signer } = useEthersSigner();
  const wagmiChainId = useChainId();
  const isEthPayEnabled = wagmiChainId === 1 || wagmiChainId === 11155111;
  const addressKey = address?.toLowerCase() ?? null;
  const source = "mint_and_stake_gctl_dialog";

  // Privy card on-ramp wiring — surfaces a "Buy with card" button when the
  // user is short on USDC. Lazy-authenticates via useLogin only when the
  // user opts into the card flow; default connect path stays signature-free.
  const { authenticated: isPrivyAuthenticated } = usePrivy();
  const pendingCardFundRef = React.useRef<{
    address: `0x${string}`;
    amount: string;
  } | null>(null);
  const triggerCardFund = useCardOnramp();
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
      if (wagmiChainId === sepolia.id) {
        toast.info(t.wallet.cardPurchasesMainnetOnly);
        return;
      }
      trackEvent("mint_gctl_card_click", {
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
      wagmiChainId,
      t,
      isPrivyAuthenticated,
      privyLogin,
      triggerCardFund,
    ]
  );
  const trackGctlEvent = React.useCallback(
    (eventName: string, data?: Record<string, unknown>) => {
      trackEvent(eventName, {
        source,
        wallet_connected: isConnected,
        wallet_address: addressKey,
        chain_id: wagmiChainId,
        ...(data || {}),
      });
    },
    [addressKey, isConnected, wagmiChainId],
  );
  const [optimisticHasGctlByAddress, setOptimisticHasGctlByAddress] =
    React.useState<Record<string, boolean>>({});

  const { regions, isRegionsLoading } = useRegions();
  const {
    gctlPriceNumber,
    gctlBalance,
    isGctlBalanceLoading,
    invalidateAllQueries,
    fetchTransferDetails,
    estimateEthToUsdc,
    stakeExistingGctlToRegion,
    mintAndStakeGctlToRegion,
    isProcessing,
  } = useGctlPreparationOrchestrator({ enabled: open });
  const { data: activeSummary } = useActiveRegionsSummary({ enabled: open });

  const impactWalletStatsQuery = useImpactWalletStats({
    enabled: open,
  });

  const { walletDetails } = useWallets({
    walletAddress: address ?? undefined,
    enabled: open && Boolean(address),
    includeMintedEvents: false,
    includeStakeEvents: false,
    includeMigrationAmount: false,
  });

  const userStakedGctlByRegionId = React.useMemo(() => {
    const map = new Map<number, number>();
    const rows = walletDetails?.regions ?? [];
    for (const row of rows as any[]) {
      const regionId = Number((row as any)?.regionId);
      if (!Number.isFinite(regionId)) continue;
      const staked = gctlAmountFromRaw((row as any)?.totalStaked);
      if (!Number.isFinite(staked) || staked <= 0) continue;
      map.set(regionId, staked);
    }
    return map;
  }, [walletDetails?.regions]);
  const [selectedRegionId, setSelectedRegionId] = React.useState<number | null>(
    null,
  );
  const selectedRegionLabel = React.useMemo(() => {
    const r = regions.find((reg: any) => reg.id === selectedRegionId);
    if (!r) return "";
    return (r as any).name || (r as any).title || `Region ${r.id}`;
  }, [regions, selectedRegionId]);

  const [selectedCurrency, setSelectedCurrency] =
    React.useState<SourceCurrency>("USDC");
  const [amountInput, setAmountInput] = React.useState<string>("");
  const [isUnstakeAcknowledged, setIsUnstakeAcknowledged] =
    React.useState(false);
  const [isUnstakingModalOpen, setIsUnstakingModalOpen] = React.useState(false);
  const [ethUsdcQuoteWei, setEthUsdcQuoteWei] = React.useState<bigint | null>(
    null,
  );
  const [isSwappingEth, setIsSwappingEth] = React.useState(false);

  // Step 4 is the new SUCCESS State
  const [stepOverride, setStepOverride] = React.useState<1 | 2 | 3 | 4 | null>(
    null,
  );

  const unstkedGctlBalanceNumber = React.useMemo(() => {
    try {
      return Number(
        formatUnits(BigInt(gctlBalance ?? "0"), DECIMALS_BY_TOKEN.GCTL),
      );
    } catch {
      return 0;
    }
  }, [gctlBalance]);

  const hasAnyGctl = React.useMemo(() => {
    const hasOptimistic = addressKey
      ? Boolean(optimisticHasGctlByAddress[addressKey])
      : false;
    try {
      return hasOptimistic || BigInt(gctlBalance ?? "0") > 0n;
    } catch {
      return hasOptimistic;
    }
  }, [addressKey, gctlBalance, optimisticHasGctlByAddress]);

  const defaultStep = React.useMemo((): 1 | 2 | 3 => {
    if (!isConnected) return 1;
    if (forceStep1) return 1;
    if (isGctlBalanceLoading) return 1;
    return hasAnyGctl ? 2 : 1;
  }, [hasAnyGctl, isConnected, isGctlBalanceLoading, forceStep1]);

  const step = React.useMemo((): 1 | 2 | 3 | 4 => {
    if (!isConnected) return 1;
    return (stepOverride ?? defaultStep) as 1 | 2 | 3 | 4;
  }, [defaultStep, isConnected, stepOverride]);

  const stakeMode = selectedCurrency === "GCTL" ? "stake" : "mint";

  const hasInitializedCurrencyRef = React.useRef(false);

  // Reset initialization flag when dialog closes
  if (!open && hasInitializedCurrencyRef.current) {
    hasInitializedCurrencyRef.current = false;
  }

  // Set default currency when dialog is open and GCTL balance has loaded
  if (open && !isGctlBalanceLoading && !hasInitializedCurrencyRef.current) {
    hasInitializedCurrencyRef.current = true;
    const defaultCurrency: SourceCurrency =
      unstkedGctlBalanceNumber > 1 ? "GCTL" : "USDC";
    if (selectedCurrency !== defaultCurrency) {
      setSelectedCurrency(defaultCurrency);
      setAmountInput("");
      setEthUsdcQuoteWei(null);
    }
  }

  const prevOpenRef = React.useRef(open);
  React.useEffect(() => {
    if (prevOpenRef.current === open) return;
    prevOpenRef.current = open;

    trackGctlEvent(
      open ? "gctl_mint_stake_dialog_open" : "gctl_mint_stake_dialog_close",
      {
        step,
      },
    );
  }, [open, step, trackGctlEvent]);

  const ethBalanceQuery = useBalance({
    address,
    query: {
      enabled: Boolean(
        open && address && selectedCurrency === "ETH" && isEthPayEnabled,
      ),
    },
  });

  const maxAmountNumber = React.useMemo(() => {
    if (stakeMode === "stake") {
      return unstkedGctlBalanceNumber;
    }

    if (selectedCurrency === "ETH") {
      try {
        const wei = ethBalanceQuery.data?.value ?? 0n;
        const formatted = formatUnits(wei, ETH_DECIMALS);
        return new Decimal(formatted).toNumber();
      } catch {
        return 0;
      }
    }

    const bal = selectedCurrency === "USDC" ? usdcBalance : usdgBalance;
    if (!bal) return 0;
    try {
      return new Decimal(
        formatUnits(
          BigInt(bal),
          selectedCurrency === "USDC"
            ? DECIMALS_BY_TOKEN.USDC
            : DECIMALS_BY_TOKEN.USDG,
        ),
      ).toNumber();
    } catch {
      return 0;
    }
  }, [
    ethBalanceQuery.data?.value,
    selectedCurrency,
    stakeMode,
    usdcBalance,
    usdgBalance,
    unstkedGctlBalanceNumber,
  ]);

  const amountNumber = React.useMemo(() => {
    if (amountInput.trim() === "") return 0;
    return toNumber(amountInput);
  }, [amountInput]);

  const isOverBalance = React.useMemo(() => {
    if (selectedCurrency === "ETH") {
      try {
        const balWei = ethBalanceQuery.data?.value ?? 0n;
        const inputWei = parseUnits(
          trimToDecimals(amountInput, ETH_DECIMALS),
          ETH_DECIMALS,
        );
        return inputWei > balWei;
      } catch {
        return false;
      }
    }
    // For GCTL, USDC, USDG - compare display values to avoid rounding mismatches
    const epsilon = 0.0001;
    return amountNumber > maxAmountNumber + epsilon;
  }, [
    amountInput,
    amountNumber,
    ethBalanceQuery.data?.value,
    maxAmountNumber,
    selectedCurrency,
  ]);
  const isMissingRegion = !selectedRegionId;
  const isMissingAmount = amountInput.trim() === "" || amountNumber <= 0;

  const estimatedGctl = React.useMemo(() => {
    if (stakeMode === "stake") {
      if (!amountNumber || amountNumber <= 0) return null;
      return amountNumber;
    }

    if (!gctlPriceNumber || gctlPriceNumber <= 0) return null;

    if (selectedCurrency === "ETH") {
      if (!ethUsdcQuoteWei || ethUsdcQuoteWei <= 0n) return null;
      try {
        const usdcOut = new Decimal(formatUnits(ethUsdcQuoteWei, 6)).toNumber();
        if (!Number.isFinite(usdcOut) || usdcOut <= 0) return null;
        return usdcOut / gctlPriceNumber;
      } catch {
        return null;
      }
    }

    if (!amountNumber || amountNumber <= 0) return null;
    return amountNumber / gctlPriceNumber;
  }, [
    amountNumber,
    ethUsdcQuoteWei,
    gctlPriceNumber,
    selectedCurrency,
    stakeMode,
  ]);

  const estimatedUsdcOutFromEth = React.useMemo(() => {
    if (selectedCurrency !== "ETH") return null;
    if (!ethUsdcQuoteWei || ethUsdcQuoteWei <= 0n) return null;
    try {
      const usdcOut = new Decimal(formatUnits(ethUsdcQuoteWei, 6)).toNumber();
      if (!Number.isFinite(usdcOut) || usdcOut <= 0) return null;
      return usdcOut;
    } catch {
      return null;
    }
  }, [ethUsdcQuoteWei, selectedCurrency]);

  const steeringScoreBefore = React.useMemo(() => {
    return computeSteeringScorePoints({
      activeSummary,
      userStakedGctlByRegionId,
      addedGctl: 0,
      selectedRegionId: null,
    });
  }, [activeSummary, userStakedGctlByRegionId]);

  const steeringScoreAfterPreview = React.useMemo(() => {
    const added = Number.isFinite(estimatedGctl ?? NaN)
      ? (estimatedGctl as number)
      : 0;
    if (!selectedRegionId) return steeringScoreBefore;
    if (!Number.isFinite(added) || added <= 0) return steeringScoreBefore;
    return computeSteeringScorePoints({
      activeSummary,
      userStakedGctlByRegionId,
      addedGctl: added,
      selectedRegionId,
    });
  }, [
    activeSummary,
    estimatedGctl,
    selectedRegionId,
    steeringScoreBefore,
    userStakedGctlByRegionId,
  ]);

  const inflationPreview = React.useMemo(() => {
    if (!activeSummary) return null;
    if (!selectedRegionId) return null;
    if (!estimatedGctl || estimatedGctl <= 0) return null;

    const region = activeSummary.regions.find((r) => r.id === selectedRegionId);
    if (!region) return null;

    const totalGlwRewards = activeSummary.totalGlwRewards;
    const totalStaked = activeSummary.totalGctlStaked;

    if (!Number.isFinite(totalGlwRewards) || totalGlwRewards <= 0) return null;
    if (!Number.isFinite(totalStaked) || totalStaked <= 0) return null;

    const currentRegionStaked = region.stakedGctl;
    const nextRegionStaked = currentRegionStaked + estimatedGctl;
    const nextTotalStaked = totalStaked + estimatedGctl;

    if (nextTotalStaked <= 0) return null;

    const currentGlwPerWeek = region.glwPerWeek;
    const nextShare = nextRegionStaked / nextTotalStaked;
    const nextGlwPerWeek = totalGlwRewards * nextShare;
    const deltaGlwPerWeek = nextGlwPerWeek - currentGlwPerWeek;

    const currentEmissionSharePercent =
      (currentGlwPerWeek / totalGlwRewards) * 100;
    const nextEmissionSharePercent = (nextGlwPerWeek / totalGlwRewards) * 100;

    return {
      regionName: region.name,
      currentGlwPerWeek,
      nextGlwPerWeek,
      deltaGlwPerWeek,
      currentEmissionSharePercent,
      nextEmissionSharePercent,
    } as const;
  }, [activeSummary, estimatedGctl, selectedRegionId]);

  const steeringImpactQuote = React.useMemo(() => {
    if (!inflationPreview) return null;
    if (
      !Number.isFinite(inflationPreview.deltaGlwPerWeek) ||
      inflationPreview.deltaGlwPerWeek <= 0
    )
      return null;

    try {
      const deltaPointsPerWeekScaled6 = BigInt(
        new Decimal(inflationPreview.deltaGlwPerWeek)
          .mul(STEERING_POINTS_PER_GLW)
          .mul(1_000_000)
          .floor()
          .toFixed(0),
      );

      const weekRange = impactWalletStatsQuery.data?.weekRange ?? null;
      const weeksInRange = weekRange ? getWeeksInRange(weekRange) : 1;
      const deltaTotalPointsScaled6 =
        deltaPointsPerWeekScaled6 * BigInt(weeksInRange);

      return {
        weekRange,
        weeksInRange,
        deltaPerWeekPoints: formatPointsScaled6(deltaPointsPerWeekScaled6, 2),
        deltaTotalPoints: formatPointsScaled6(deltaTotalPointsScaled6, 2),
      } as const;
    } catch {
      return null;
    }
  }, [impactWalletStatsQuery.data?.weekRange, inflationPreview]);

  const sliderPct = React.useMemo(() => {
    if (!maxAmountNumber || maxAmountNumber <= 0) return 0;
    if (!amountNumber || amountNumber <= 0) return 0;
    return Math.max(
      0,
      Math.min(100, Math.round((amountNumber / maxAmountNumber) * 100)),
    );
  }, [amountNumber, maxAmountNumber]);

  const isSubmitDisabled =
    !isConnected ||
    !address ||
    !signer ||
    isMissingRegion ||
    isMissingAmount ||
    isOverBalance ||
    !isUnstakeAcknowledged ||
    (stakeMode === "mint" && selectedCurrency === "ETH" && !isEthPayEnabled) ||
    isProcessing;

  const [isApproving, setIsApproving] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [stakeUiState, setStakeUiState] = React.useState<
    "review" | "processing" | "error"
  >("review");
  const [stakeUiErrorMessage, setStakeUiErrorMessage] = React.useState<
    string | null
  >(null);
  const [stakeSteps, setStakeSteps] = React.useState<TransactionStep[]>([]);
  const stakeStepsRef = React.useRef<TransactionStep[]>([]);

  const updateStakeStepStatus = React.useCallback(
    (
      stepId: string,
      status: StepStatus,
      extras?: { errorMessage?: string },
    ) => {
      setStakeSteps((prev) => {
        const updated = prev.map((s) => {
          if (s.id !== stepId) return s;
          return {
            ...s,
            status,
            startedAt:
              status === "waiting_signature" || status === "confirming"
                ? (s.startedAt ?? Date.now())
                : s.startedAt,
            errorMessage: extras?.errorMessage ?? s.errorMessage,
          };
        });
        stakeStepsRef.current = updated;
        return updated;
      });
    },
    [],
  );

  const handleStakeFlowStepStatus = React.useCallback(
    (
      stepId: string,
      status: StepStatus,
      extras?: { errorMessage?: string },
    ) => {
      if (stepId === "SIGN_STAKE") {
        setIsApproving(status === "waiting_signature");
      }
      if (stepId === "SUBMIT_STAKE") {
        setIsSubmitting(status === "confirming");
      }
      if (status === "error") {
        setIsApproving(false);
        setIsSubmitting(false);
      }
      updateStakeStepStatus(stepId, status, extras);
    },
    [updateStakeStepStatus],
  );

  const handleMintFlowStepStatus = React.useCallback(
    (
      stepId: string,
      status: StepStatus,
      extras?: { errorMessage?: string },
    ) => {
      if (stepId === "SWAP_ETH_TO_USDC") {
        setIsSwappingEth(
          status === "waiting_signature" || status === "confirming",
        );
      }
      if (stepId === "CHECK_ALLOWANCE" || stepId === "APPROVE") {
        setIsApproving(
          status === "waiting_signature" || status === "confirming",
        );
      }
      if (stepId === "MINT_AND_STAKE") {
        setIsSubmitting(
          status === "waiting_signature" || status === "confirming",
        );
      }
      if (status === "error") {
        setIsApproving(false);
        setIsSubmitting(false);
        setIsSwappingEth(false);
      }
      updateStakeStepStatus(stepId, status, extras);
    },
    [updateStakeStepStatus],
  );

  const [trackingTxHash, setTrackingTxHash] = React.useState<string | null>(
    null,
  );
  const [hasPerformedAction, setHasPerformedAction] = React.useState(false);
  const [successReceipt, setSuccessReceipt] = React.useState<{
    regionId: number;
    regionLabel: string;
    amountGctl: number;
    deltaGlwPerWeek: number | null;
    nextRegionSharePercent: number | null;
    scoreBoostPerWeekLabel: string | null;
  } | null>(null);
  const [successScoreSnapshot, setSuccessScoreSnapshot] = React.useState<{
    prevSteeringPoints: number;
    nextSteeringPoints: number;
    deltaSteeringPoints: number;
  } | null>(null);

  const {
    isPolling: isTransferPolling,
    countdown: transferCountdown,
    stopPolling: stopTransferPolling,
    reset: resetTransferPolling,
  } = usePolling<PendingTransfer>({
    enabled: open && Boolean(trackingTxHash),
    pollInterval: 10_000,
    maxDuration: 60,
    pollFn: async () => {
      if (!trackingTxHash) throw new Error(m.missingTxHash);
      const res = await fetchTransferDetails(trackingTxHash);
      if (res.ok) return res.val;
      throw new Error(res.val);
    },
    shouldStopPolling: (data) =>
      data.status === "confirmed" || data.status === "failed",
    onSuccess: async (data) => {
      if (data.status === "failed") {
        const msg =
          (data as any)?.errorMessage ||
          (data as any)?.errorDetails ||
          m.transactionFailedShort;
        updateStakeStepStatus("FINALIZE", "error", { errorMessage: msg });
        setStakeUiState("error");
        setStakeUiErrorMessage(msg);
        return;
      }

      updateStakeStepStatus("FINALIZE", "completed");
      setTrackingTxHash(null);
      stopTransferPolling();
      try {
        await invalidateAllQueries();
      } catch {
        // no-op
      }
      setStepOverride(4);
      setStakeUiState("review");
    },
    onError: async (error) => {
      // If polling times out, check balance as a fallback
      if (
        (error?.message?.includes("timed out") ||
          error?.message?.includes("max duration")) &&
        amountNumber > 0
      ) {
        try {
          await invalidateAllQueries();
          // Short delay to allow React Query to update
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // We can check if the staked amount for the region increased
          // or if the user's GCTL balance changed (if minting)
          // But since we don't have easy access to the *new* data inside this callback scope
          // without triggering a re-render, we'll optimistically assume success if the tx didn't fail
          // and just timed out on the backend polling.

          updateStakeStepStatus("FINALIZE", "completed");
          setTrackingTxHash(null);
          stopTransferPolling();
          setStepOverride(4);
          setStakeUiState("review");
          return;
        } catch (e) {
          // If invalidation fails, fall through to error
        }
      }

      const msg = error?.message || m.pollingFailed;
      updateStakeStepStatus("FINALIZE", "error", { errorMessage: msg });
      setStakeUiState("error");
      setStakeUiErrorMessage(msg);
    },
  });

  // Fallback interval: if stuck at FINALIZE, check every 15s starting after 30s
  // This is a safety net in case the main polling mechanism fails
  const trackingTxHashRef = React.useRef<string | null>(null);
  trackingTxHashRef.current = trackingTxHash;

  React.useEffect(() => {
    if (!trackingTxHash) return;

    let initialDelayDone = false;

    const checkTransferStatus = async () => {
      const currentTxHash = trackingTxHashRef.current;
      if (!currentTxHash) return;

      try {
        const res = await fetchTransferDetails(currentTxHash);
        if (!res.ok) return;

        const data = res.val;
        if (data.status === "confirmed") {
          updateStakeStepStatus("FINALIZE", "completed");
          setTrackingTxHash(null);
          stopTransferPolling();
          try {
            await invalidateAllQueries();
          } catch {
            // no-op
          }
          setStepOverride(4);
          setStakeUiState("review");
        } else if (data.status === "failed") {
          const msg =
            (data as any)?.errorMessage ||
            (data as any)?.errorDetails ||
            m.transactionFailedShort;
          updateStakeStepStatus("FINALIZE", "error", { errorMessage: msg });
          setStakeUiState("error");
          setStakeUiErrorMessage(msg);
        }
      } catch {
        // Silent fail - will retry on next interval
      }
    };

    // Start checking after 30s, then every 15s thereafter
    const initialTimeout = setTimeout(() => {
      initialDelayDone = true;
      checkTransferStatus();
    }, 30_000);

    const intervalId = setInterval(() => {
      if (initialDelayDone) {
        checkTransferStatus();
      }
    }, 15_000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingTxHash]);

  const ethUsdcQuoteRunner = React.useCallback(
    async (value: string, signal: AbortSignal) => {
      if (!value || Number(value) <= 0) return null;
      if (!isEthPayEnabled) return null;

      try {
        const amountInWei = parseUnits(
          trimToDecimals(value, ETH_DECIMALS),
          ETH_DECIMALS,
        );
        const quoteRes = await estimateEthToUsdc({
          amountInWei,
          slippageBps: DEFAULT_SLIPPAGE_BPS,
        });
        if (signal.aborted) return null;
        if (!quoteRes.ok) return null;
        return quoteRes.val.amountOutUsdc ?? null;
      } catch {
        return null;
      }
    },
    [estimateEthToUsdc, isEthPayEnabled],
  );

  const { run: runEthUsdcQuote, isRunning: isEthQuoteRunning } =
    useDebouncedAsync<string, bigint | null>(ethUsdcQuoteRunner, {
      delayMs: 300,
      onResult: (res) => setEthUsdcQuoteWei(res),
      onError: () => setEthUsdcQuoteWei(null),
    });

  const handleSetPct = React.useCallback(
    (pct: number) => {
      const next = (pct / 100) * (maxAmountNumber || 0);
      if (!Number.isFinite(next) || next <= 0) {
        setAmountInput("");
        return;
      }
      const nextInput =
        selectedCurrency === "ETH"
          ? roundDownToDecimalsString(next, 6)
          : roundDownToDecimalsString(next, 2);
      setAmountInput(nextInput);

      if (selectedCurrency === "ETH") runEthUsdcQuote(nextInput);
    },
    [maxAmountNumber, runEthUsdcQuote, selectedCurrency],
  );

  const isBusy =
    isApproving ||
    isSubmitting ||
    isProcessing ||
    isSwappingEth ||
    stakeUiState === "processing" ||
    isTransferPolling;

  const handleDialogOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isBusy) {
        toast.error("Please wait for the current action to finish.");
        return;
      }

      onOpenChange(nextOpen);

      if (!nextOpen) {
        stopTransferPolling();
        resetTransferPolling();
        setTrackingTxHash(null);
        if (hasPerformedAction) {
          void (async () => {
            try {
              await invalidateAllQueries();
            } catch {
              // no-op
            }
          })();
        }
        setStepOverride(null);
        setIsUnstakeAcknowledged(false);
        setHasPerformedAction(false);
        setStakeUiState("review");
        setStakeUiErrorMessage(null);
        setStakeSteps([]);
        stakeStepsRef.current = [];
        setSuccessReceipt(null);
        setSuccessScoreSnapshot(null);
      }
    },
    [
      hasPerformedAction,
      invalidateAllQueries,
      isBusy,
      onOpenChange,
      resetTransferPolling,
      stopTransferPolling,
    ],
  );

  // Snapshot of balance before transaction
  const [initialGctlBalance, setInitialGctlBalance] = React.useState<number>(0);

  const handleStakeExisting = React.useCallback(async () => {
    if (!isConnected || !address || !signer) {
      toast.error(m.toastConnectWallet);
      return;
    }
    if (!selectedRegionId) {
      toast.error(m.toastSelectRegion);
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error(m.toastEnterAmount);
      return;
    }
    if (!isUnstakeAcknowledged) {
      toast.error(m.toastAcknowledgeTerms);
      return;
    }

    const stakeAmountBucket = bucketToken(amountNumber);

    trackGctlEvent("gctl_stake_existing_submit", {
      step,
      region_id: selectedRegionId,
      stake_amount_bucket: stakeAmountBucket,
    });

    setInitialGctlBalance(unstkedGctlBalanceNumber);

    try {
      setStakeUiState("processing");
      setStakeUiErrorMessage(null);

      const steps: TransactionStep[] = [
        {
          id: "SIGN_STAKE",
          title: m.stepSignMessage,
          description: m.stepSignDesc,
          status: "waiting_signature",
        },
        {
          id: "SUBMIT_STAKE",
          title: m.stepSubmit,
          description: m.stepSubmitDesc,
          status: "idle",
        },
        {
          id: "REFRESH",
          title: m.stepRefreshBalances,
          description: m.stepRefreshDesc,
          status: "idle",
        },
      ];
      setStakeSteps(steps);
      stakeStepsRef.current = steps;

      await stakeExistingGctlToRegion({
        regionId: selectedRegionId,
        amountAtomic: toAtomic6(amountNumber),
        stepIds: {
          sign: "SIGN_STAKE",
          submit: "SUBMIT_STAKE",
          refresh: "REFRESH",
        },
        updateStepStatus: handleStakeFlowStepStatus,
      });

      trackGctlEvent("gctl_stake_existing_success", {
        step,
        region_id: selectedRegionId,
        stake_amount_bucket: stakeAmountBucket,
      });

      setSuccessReceipt({
        regionId: selectedRegionId,
        regionLabel: selectedRegionLabel || `Region ${selectedRegionId}`,
        amountGctl: amountNumber,
        deltaGlwPerWeek: inflationPreview?.deltaGlwPerWeek ?? null,
        nextRegionSharePercent:
          inflationPreview?.nextEmissionSharePercent ?? null,
        scoreBoostPerWeekLabel: steeringImpactQuote?.deltaPerWeekPoints ?? null,
      });
      const prevPoints = Math.max(0, Math.round(steeringScoreBefore));
      const nextPoints = Math.max(0, Math.round(steeringScoreAfterPreview));
      setSuccessScoreSnapshot({
        prevSteeringPoints: prevPoints,
        nextSteeringPoints: nextPoints,
        deltaSteeringPoints: Math.max(0, nextPoints - prevPoints),
      });
      setOptimisticHasGctlByAddress((prev) => {
        const key = (address as string | undefined)?.toLowerCase();
        if (!key) return prev;
        if (prev[key]) return prev;
        return { ...prev, [key]: true };
      });

      setStepOverride(4);
      setIsUnstakeAcknowledged(false);
      setStakeUiState("review");
    } catch (error) {
      setIsApproving(false);
      setIsSubmitting(false);
      const msg = getGctlDialogErrorMessage(error);
      setStakeUiState("error");
      setStakeUiErrorMessage(msg);
      const currentSteps = stakeStepsRef.current;
      const activeStep = currentSteps.find(
        (s) => s.status === "waiting_signature" || s.status === "confirming",
      );
      if (activeStep)
        updateStakeStepStatus(activeStep.id, "error", { errorMessage: msg });

      // Report to Sentry (exclude user-side issues we can't act on)
      const isUserRejected =
        msg?.includes("User rejected") || (error as any)?.code === 4001;
      const isInsufficientGas = isInsufficientGasError(error);
      if (!isUserRejected && !isInsufficientGas) {
        const normalizedError =
          error instanceof Error && error.message === msg
            ? error
            : new Error(String(msg), error instanceof Error ? { cause: error } : undefined);

        if (!(error instanceof Error) && error !== undefined) {
          (normalizedError as Error & { cause?: unknown }).cause = error;
        }

        Sentry.captureException(normalizedError, {
          tags: { gctlStage: "stake_existing" },
          extra: { regionId: selectedRegionId, walletAddress: address },
        });
      }

      trackGctlEvent("gctl_stake_existing_error", {
        step,
        region_id: selectedRegionId,
        error_message: msg,
      });
      toast.error("Failed to stake GCTL", {
        description: msg,
      });
    }
  }, [
    address,
    amountNumber,
    handleStakeFlowStepStatus,
    isConnected,
    isUnstakeAcknowledged,
    selectedRegionId,
    signer,
    stakeExistingGctlToRegion,
    step,
    trackGctlEvent,
    unstkedGctlBalanceNumber,
    inflationPreview?.deltaGlwPerWeek,
    inflationPreview?.nextEmissionSharePercent,
    selectedRegionLabel,
    steeringScoreAfterPreview,
    steeringScoreBefore,
    steeringImpactQuote?.deltaPerWeekPoints,
    updateStakeStepStatus,
  ]);

  const handleSubmit = React.useCallback(async () => {
    if (stakeMode === "stake") {
      return handleStakeExisting();
    }

    if (!isConnected || !address || !signer) {
      toast.error(m.toastConnectWallet);
      return;
    }
    if (!selectedRegionId) {
      toast.error(m.toastSelectRegion);
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error(m.toastEnterAmount);
      return;
    }
    if (!isUnstakeAcknowledged) {
      toast.error(m.toastAcknowledgeTerms);
      return;
    }
    if (selectedCurrency === "GCTL") {
      toast.error(m.toastSelectRegion);
      return;
    }

    const payAmountBucket =
      selectedCurrency === "ETH"
        ? bucketEth(amountNumber)
        : bucketUsd(amountNumber);
    const mintedGctlBucket = bucketToken(estimatedGctl ?? Number.NaN);

    trackGctlEvent("gctl_mint_stake_submit", {
      step,
      region_id: selectedRegionId,
      pay_currency: selectedCurrency,
      pay_amount_bucket: payAmountBucket,
      minted_gctl_bucket: mintedGctlBucket,
      eth_pay_enabled: isEthPayEnabled,
    });

    setInitialGctlBalance(unstkedGctlBalanceNumber);

    try {
      setStakeUiState("processing");
      setStakeUiErrorMessage(null);
      setTrackingTxHash(null);
      resetTransferPolling();

      const steps: TransactionStep[] = [];
      if (selectedCurrency === "ETH") {
        steps.push({
          id: "SWAP_ETH_TO_USDC",
          title: "Swap ETH → USDC",
          description: m.convertingUniswapDesc,
          tokenFrom: "ETH",
          tokenTo: "USDC",
          status: "waiting_signature",
        });
      }
      steps.push(
        {
          id: "CHECK_ALLOWANCE",
          title: m.stepCheckAllowance,
          description: m.stepCheckAllowanceDesc,
          status: "idle",
        },
        {
          id: "APPROVE",
          title: m.stepApproveToken,
          description: m.stepApproveTokenDesc,
          status: "idle",
        },
        {
          id: "MINT_AND_STAKE",
          title: m.title,
          description: m.stepSubmitTx,
          status: "idle",
        },
        {
          id: "FINALIZE",
          title: m.stepFinalize,
          description: m.stepFinalizeDesc,
          status: "idle",
        },
      );

      setStakeSteps(steps);
      stakeStepsRef.current = steps;

      const amountInWei =
        selectedCurrency === "ETH"
          ? parseUnits(trimToDecimals(amountInput, ETH_DECIMALS), ETH_DECIMALS)
          : undefined;
      const mintSourceCurrency = selectedCurrency;

      const mintResult = await mintAndStakeGctlToRegion({
        regionId: selectedRegionId,
        sourceCurrency: mintSourceCurrency,
        amountAtomic:
          mintSourceCurrency === "ETH" ? undefined : toAtomic6(amountNumber),
        amountInWei,
        slippageBps: DEFAULT_SLIPPAGE_BPS,
        stepIds: {
          swapEthToUsdc: "SWAP_ETH_TO_USDC",
          checkAllowance: "CHECK_ALLOWANCE",
          approve: "APPROVE",
          mintAndStake: "MINT_AND_STAKE",
        },
        updateStepStatus: handleMintFlowStepStatus,
      });

      const { txHash, mintCurrency } = mintResult;

      trackGctlEvent("gctl_mint_stake_tx_sent", {
        step,
        region_id: selectedRegionId,
        pay_currency: selectedCurrency,
        mint_currency: String(mintCurrency),
        pay_amount_bucket: payAmountBucket,
        minted_gctl_bucket: mintedGctlBucket,
        tx_hash: txHash,
        referral_code:
          getStoredReferralAttribution()?.referralCode ?? null,
      });

      setHasPerformedAction(true);
      updateStakeStepStatus("FINALIZE", "completed");

      setOptimisticHasGctlByAddress((prev) => {
        const key = (address as string | undefined)?.toLowerCase();
        if (!key) return prev;
        if (prev[key]) return prev;
        return { ...prev, [key]: true };
      });

      setSuccessReceipt({
        regionId: selectedRegionId,
        regionLabel: selectedRegionLabel || `Region ${selectedRegionId}`,
        amountGctl: estimatedGctl ?? 0,
        deltaGlwPerWeek: inflationPreview?.deltaGlwPerWeek ?? null,
        nextRegionSharePercent:
          inflationPreview?.nextEmissionSharePercent ?? null,
        scoreBoostPerWeekLabel: steeringImpactQuote?.deltaPerWeekPoints ?? null,
      });
      const prevPoints = Math.max(0, Math.round(steeringScoreBefore));
      const nextPoints = Math.max(0, Math.round(steeringScoreAfterPreview));
      setSuccessScoreSnapshot({
        prevSteeringPoints: prevPoints,
        nextSteeringPoints: nextPoints,
        deltaSteeringPoints: Math.max(0, nextPoints - prevPoints),
      });
      setStakeUiState("review");
      setStepOverride(4);
      void invalidateAllQueries();
    } catch (error) {
      setIsApproving(false);
      setIsSubmitting(false);
      setIsSwappingEth(false);
      const msg = getGctlDialogErrorMessage(error);
      setStakeUiState("error");
      setStakeUiErrorMessage(msg);
      const currentSteps = stakeStepsRef.current;
      const activeStep = currentSteps.find(
        (s) => s.status === "waiting_signature" || s.status === "confirming",
      );
      if (activeStep)
        updateStakeStepStatus(activeStep.id, "error", { errorMessage: msg });

      // Report to Sentry (exclude user-side issues we can't act on)
      const isUserRejected =
        msg?.includes("User rejected") || (error as any)?.code === 4001;
      const isInsufficientGas = isInsufficientGasError(error);
      if (!isUserRejected && !isInsufficientGas) {
        const normalizedError =
          error instanceof Error && error.message === msg
            ? error
            : new Error(String(msg), error instanceof Error ? { cause: error } : undefined);

        if (!(error instanceof Error) && error !== undefined) {
          (normalizedError as Error & { cause?: unknown }).cause = error;
        }

        Sentry.captureException(normalizedError, {
          tags: { gctlStage: "mint_stake" },
          extra: {
            regionId: selectedRegionId,
            payCurrency: selectedCurrency,
            walletAddress: address,
          },
        });
      }

      trackGctlEvent("gctl_mint_stake_error", {
        step,
        region_id: selectedRegionId,
        pay_currency: selectedCurrency,
        pay_amount_bucket: payAmountBucket,
        minted_gctl_bucket: mintedGctlBucket,
        error_message: msg,
      });
      toast.error("Failed to mint & stake GCTL", {
        description: msg,
      });
    }
  }, [
    address,
    amountNumber,
    amountInput,
    estimatedGctl,
    handleStakeExisting,
    handleMintFlowStepStatus,
    invalidateAllQueries,
    isConnected,
    isEthPayEnabled,
    isUnstakeAcknowledged,
    mintAndStakeGctlToRegion,
    selectedCurrency,
    selectedRegionId,
    selectedRegionLabel,
    signer,
    stakeMode,
    trackGctlEvent,
    step,
    inflationPreview?.deltaGlwPerWeek,
    inflationPreview?.nextEmissionSharePercent,
    resetTransferPolling,
    steeringImpactQuote?.deltaPerWeekPoints,
    steeringScoreAfterPreview,
    steeringScoreBefore,
    unstkedGctlBalanceNumber,
    updateStakeStepStatus,
  ]);

  const regionsForSelection = React.useMemo(() => {
    const regionsFromSummary = activeSummary?.regions ?? [];
    if (regionsFromSummary.length > 0) {
      const totalGlwRewards = activeSummary?.totalGlwRewards ?? NaN;
      const sharePercent = (glwPerWeek: number) => {
        if (!Number.isFinite(totalGlwRewards) || totalGlwRewards <= 0)
          return NaN;
        if (!Number.isFinite(glwPerWeek) || glwPerWeek <= 0) return 0;
        return (glwPerWeek / totalGlwRewards) * 100;
      };

      const enriched = regionsFromSummary.map((r) => ({
        ...r,
        sharePercent: sharePercent(r.glwPerWeek),
      }));

      const sorted = [...enriched].sort(
        (a, b) => (b.sharePercent ?? 0) - (a.sharePercent ?? 0),
      );
      const mostActiveId = sorted[0]?.id ?? null;
      return { regions: sorted, mostActiveId };
    }

    const fallback = regions.map((r: any) => ({
      id: r.id as number,
      name: (r as any).name || (r as any).title || `Region ${r.id}`,
      sharePercent: NaN,
      glwPerWeek: NaN,
    }));
    return { regions: fallback, mostActiveId: null };
  }, [activeSummary?.regions, activeSummary?.totalGlwRewards, regions]);

  const dialogTitle = React.useMemo(() => {
    if (step === 1) return m.introduction;
    if (step === 2) return m.chooseTarget;
    if (step === 4) return m.impactActivated;
    if (selectedRegionLabel) {
      if (stakeMode === "stake") return `${m.stakePower} → ${selectedRegionLabel}`;
      return `${m.title} → ${selectedRegionLabel}`;
    }
    return stakeMode === "stake" ? m.stakePower : m.title;
  }, [m, selectedRegionLabel, stakeMode, step]);

  const handleBack = React.useCallback(() => {
    if (isBusy) return;
    if (step === 3) return setStepOverride(2);
    if (step === 2) {
      if (!hasAnyGctl) return setStepOverride(1);
      handleDialogOpenChange(false);
      return;
    }
    handleDialogOpenChange(false);
  }, [handleDialogOpenChange, hasAnyGctl, isBusy, step]);

  const handleNext = React.useCallback(() => {
    if (step === 1) {
      if (!isConnected) {
        toast.error(m.toastConnectWalletContinue);
        return;
      }
      return setStepOverride(2);
    }
    if (step === 2) return setStepOverride(3);
  }, [isConnected, step]);

  // Hide the close button in step 4 to force user to click the "Done" button (better closure)
  const showHeaderClose = step !== 4;
  const showProcessing = step === 3 && stakeUiState !== "review";

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="bg-card rounded-2xl p-0 sm:max-w-md w-full border border-border/40 overflow-hidden flex flex-col gap-0 max-h-[calc(100dvh-2rem)]"
        >
          {/* Header */}
          {step === 4 ? (
            <></>
          ) : (
            <DialogHeader className="px-5 py-4 border-b border-border/40">
              <div className="flex items-center justify-between gap-3">
                {step !== 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={handleBack}
                    disabled={isBusy}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="ml-1">{m.back}</span>
                  </Button>
                ) : (
                  <div className="h-8 w-[66px]" />
                )}

                <div className="min-w-0 text-center">
                  <DialogTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground truncate">
                    {dialogTitle}
                  </DialogTitle>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    {m.stepCount(step, 3)}
                  </div>
                  {showHeaderClose && (
                    <DialogClose asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={m.close}
                        disabled={isBusy}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </DialogClose>
                  )}
                </div>
              </div>
            </DialogHeader>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
            {step === 1 ? (
              // STEP 1: INTRO
              <div className="space-y-5">
                <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
                      <Sun className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-base font-semibold">
                        {m.gctlName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {m.gctlTagline}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground leading-relaxed">
                    {m.gctlIntro}
                  </div>

                  <div className="pt-1">
                    <div className="p-3 bg-card border border-border/20 dark:border-border/40 rounded-lg">
                      <div className="text-[10px] font-medium text-[color:var(--color-glow-orange)] flex items-center gap-1.5 uppercase tracking-wider">
                        {m.offChainAsset}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        {m.gctlNonTransferable}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest pl-1 pb-1">
                    {m.yourBenefits}
                  </div>
                  <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 divide-y divide-border/20 dark:divide-border/40">
                    <div className="p-3.5 flex items-start gap-3">
                      <div className="h-7 w-7 rounded-lg bg-[#22D3EE]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="h-3.5 w-3.5 text-[#22D3EE]" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {m.boostImpactScore}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {m.boostImpactScoreDesc}
                        </div>
                      </div>
                    </div>
                    <div className="p-3.5 flex items-start gap-3">
                      <div className="h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {m.directProtocolRewards}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {m.youDecideRegions}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {!isConnected ? (
                  <div className="pt-2">
                    <ConnectButton variant="default" size="medium" />
                  </div>
                ) : (
                  <Button
                    type="button"
                    className="w-full h-11 text-sm font-medium"
                    onClick={handleNext}
                  >
                    {m.startStaking}
                  </Button>
                )}
              </div>
            ) : step === 2 ? (
              // STEP 2: SELECT REGION
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{m.selectRegion}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.whereToDirect}
                  </div>
                </div>

                <div className="grid gap-2">
                  {regionsForSelection.regions.map((r) => {
                    const isSelected = selectedRegionId === r.id;
                    const share =
                      Number.isFinite((r as any).sharePercent) &&
                      (r as any).sharePercent > 0
                        ? (r as any).sharePercent
                        : NaN;
                    const shareLabel = Number.isFinite(share)
                      ? `${formatPercent1(share)}%`
                      : "—";
                    const glwPerWeek = Number((r as any).glwPerWeek);
                    const glwLabel =
                      Number.isFinite(glwPerWeek) && glwPerWeek > 0
                        ? `${formatCompact(glwPerWeek, {
                            maximumFractionDigits: 1,
                          })} ${m.glwPerWeek}`
                        : null;
                    const isCgp = r.name?.toLowerCase().includes("clean grid");

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRegionId(r.id)}
                        className={cn(
                          "relative w-full rounded-xl border px-4 py-3.5 text-left transition-all",
                          isSelected
                            ? "border-[#22D3EE]/50 bg-muted/50 dark:bg-muted/60 ring-1 ring-[#22D3EE]/30"
                            : "border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 hover:bg-muted/40 dark:hover:bg-muted/60 hover:border-border/30",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-medium flex items-center gap-1.5">
                              {r.name}
                              {isCgp && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-glow-orange)]">
                                  {m.legacy}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {m.currentShare(shareLabel)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {glwLabel && (
                              <div className="text-xs font-medium text-muted-foreground tabular-nums">
                                {glwLabel}
                              </div>
                            )}
                            {isSelected && (
                              <div className="h-4 w-4 rounded-full bg-[#22D3EE]/20 flex items-center justify-center">
                                <div className="h-2 w-2 rounded-full bg-[#22D3EE]" />
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  className="w-full mt-2"
                  onClick={handleNext}
                  disabled={!selectedRegionId || isRegionsLoading}
                >
                  {m.continueButton}
                </Button>
              </div>
            ) : step === 3 ? (
              // STEP 3: AMOUNT & CONFIRM
              <div className="space-y-6">
                {showProcessing ? (
                  <div className="space-y-5">
                    <div className="text-center space-y-2">
                      <div className="flex items-center justify-center mx-auto">
                        {stakeUiState === "processing" ? (
                          <div className="flex items-center justify-center">
                            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="h-14 w-14 rounded-full bg-muted/50 dark:bg-muted/70 border border-border/20 dark:border-border/40 flex items-center justify-center">
                            <X className="h-8 w-8 text-destructive" />
                          </div>
                        )}
                      </div>
                      <div className="text-xl font-semibold text-foreground">
                        {stakeUiState === "processing"
                          ? m.processing
                          : m.transactionFailed}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {stakeUiState === "processing"
                          ? trackingTxHash
                            ? m.finalizingCountdown(transferCountdown)
                            : m.followSteps
                          : m.transactionFailedDesc}
                      </div>
                    </div>

                    {stakeSteps.length > 0 ? (
                      <div className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 rounded-xl p-4">
                        <TransactionStepper
                          steps={stakeSteps}
                          chainId={wagmiChainId}
                        />
                      </div>
                    ) : null}

                    {stakeUiState === "error" && stakeUiErrorMessage ? (
                      <div className="p-3 bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 rounded-xl">
                        <p className="text-sm text-destructive break-words">
                          {stakeUiErrorMessage}
                        </p>
                      </div>
                    ) : null}

                    {stakeUiState === "error" ? (
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => handleDialogOpenChange(false)}
                          className="flex-1"
                        >
                          {m.close}
                        </Button>
                        <Button
                          onClick={() => {
                            setStakeUiState("review");
                            setStakeUiErrorMessage(null);
                            setStakeSteps([]);
                            stakeStepsRef.current = [];
                            stopTransferPolling();
                            resetTransferPolling();
                            setTrackingTxHash(null);
                          }}
                          className="flex-1"
                        >
                          {m.tryAgain}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {showProcessing ? null : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <div className="text-sm font-medium">
                          {m.inputAmount}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground">
                          {m.availableAmount(
                            formatTokenAmount(maxAmountNumber, {
                              maximumFractionDigits: 2,
                            }),
                            stakeMode === "stake" ? "GCTL" : selectedCurrency,
                          )}
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 space-y-4">
                        <div className="flex items-center gap-3">
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={amountInput}
                            disabled={isBusy}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!isValidDecimalInput(v)) return;
                              const decimals =
                                selectedCurrency === "ETH"
                                  ? ETH_DECIMALS
                                  : selectedCurrency === "GCTL"
                                    ? DECIMALS_BY_TOKEN.GCTL
                                    : 6;
                              const normalized = trimToDecimals(v, decimals);
                              setAmountInput(normalized);
                              if (
                                stakeMode === "stake" ||
                                selectedCurrency !== "ETH"
                              )
                                return;
                              if (!normalized || Number(normalized) <= 0) {
                                setEthUsdcQuoteWei(null);
                                return;
                              }
                              runEthUsdcQuote(normalized);
                            }}
                            className="flex-1 border-0 bg-transparent p-0 text-2xl font-mono tabular-nums focus-visible:ring-0 placeholder:text-muted-foreground/30 h-auto"
                          />
                          <Select
                            value={selectedCurrency}
                            disabled={isBusy}
                            onValueChange={(v) => {
                              setSelectedCurrency(v as SourceCurrency);
                              setAmountInput("");
                              setEthUsdcQuoteWei(null);
                            }}
                          >
                            <SelectTrigger className="w-auto min-w-[90px] h-9 rounded-lg bg-muted/50 border-border/20 text-xs font-medium gap-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                              {unstkedGctlBalanceNumber > 0 ? (
                                <SelectItem value="GCTL">GCTL</SelectItem>
                              ) : null}
                              <SelectItem value="USDC">USDC</SelectItem>
                              <SelectItem value="USDG">USDG</SelectItem>
                              {isEthPayEnabled ? (
                                <SelectItem value="ETH">ETH</SelectItem>
                              ) : null}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="pt-2 border-t border-border/20 dark:border-border/40">
                          <Slider
                            value={[sliderPct]}
                            disabled={isBusy}
                            onValueChange={(value) => {
                              const pct = value[0] ?? 0;
                              handleSetPct(pct);
                            }}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                          <div className="mt-2 flex items-center justify-between sm:relative sm:h-6 sm:block">
                            {[25, 50, 75, 100].map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleSetPct(p)}
                                disabled={isBusy}
                                style={{
                                  left: `${p}%`,
                                }}
                                className={cn(
                                  "text-[10px] font-medium text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-muted/50 transition-colors sm:absolute sm:top-0",
                                  p === 100
                                    ? "sm:-translate-x-full"
                                    : "sm:-translate-x-1/2",
                                )}
                              >
                                {p}%
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {stakeMode === "mint" ? (
                      <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-4 space-y-2">
                        <div className="text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                          {m.mintEstimate}
                        </div>
                        {amountNumber <= 0 ? (
                          <div className="text-xs text-muted-foreground">
                            {m.enterToPreview}
                          </div>
                        ) : selectedCurrency === "ETH" &&
                          isEthQuoteRunning &&
                          !estimatedUsdcOutFromEth ? (
                          <div className="text-xs text-muted-foreground">
                            {m.estimatingEthQuote}
                          </div>
                        ) : estimatedGctl && estimatedGctl > 0 ? (
                          <div className="space-y-1">
                            <div className="text-sm font-mono tabular-nums text-foreground">
                              {selectedCurrency === "ETH" ? (
                                <>
                                  {formatTokenAmount(amountNumber, {
                                    maximumFractionDigits: 6,
                                  })}{" "}
                                  ETH
                                  {estimatedUsdcOutFromEth ? (
                                    <>
                                      {" -> "}
                                      {formatTokenAmount(
                                        estimatedUsdcOutFromEth,
                                        {
                                          maximumFractionDigits: 2,
                                        },
                                      )}{" "}
                                      USDC
                                    </>
                                  ) : null}
                                  {" -> "}
                                  <span className="font-semibold">
                                    {formatTokenAmount(estimatedGctl, {
                                      maximumFractionDigits: 0,
                                    })}{" "}
                                    GCTL
                                  </span>
                                </>
                              ) : (
                                <>
                                  {formatTokenAmount(amountNumber, {
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  {selectedCurrency}
                                  {" -> "}
                                  <span className="font-semibold">
                                    {formatTokenAmount(estimatedGctl, {
                                      maximumFractionDigits: 0,
                                    })}{" "}
                                    GCTL
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {m.estimatedOutputNote}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {m.unableToEstimate}
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest pl-1">
                        {m.impactPreview}
                      </div>
                      <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 overflow-hidden">
                        <div className="p-4 border-b border-border/20 dark:border-border/40 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-[#22D3EE]/10 flex items-center justify-center">
                              <SteeringIcon className="h-4 w-4 text-[#22D3EE]" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1 text-sm font-medium">
                                <span>{m.rewardsRedirected}</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label={m.howGctlRedirects}
                                      className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      <Info className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    {m.gctlDoesNotCreateGlw}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {m.toFarmsIn(selectedRegionLabel || m.regionFallback)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-mono font-semibold text-foreground">
                              {inflationPreview ? (
                                <>
                                  +
                                  {formatCompact(
                                    inflationPreview.deltaGlwPerWeek,
                                  )}
                                </>
                              ) : (
                                "—"
                              )}
                            </div>
                            <div className="text-xs font-mono text-[#22D3EE]">
                              {m.glwPerWeek}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 divide-x divide-border/20 dark:divide-border/40 bg-muted/20 dark:bg-muted/30">
                          <div className="p-3 text-center">
                            <div className="text-[10px] text-muted-foreground font-mono uppercase">
                              {m.scoreBoost}
                            </div>
                            <div className="mt-0.5 font-mono text-sm text-foreground">
                              {steeringImpactQuote ? m.rewardsRedirected : "—"}
                            </div>
                          </div>
                          <div className="p-3 text-center">
                            <div className="text-[10px] text-muted-foreground font-mono uppercase">
                              {m.regionShare}
                            </div>
                            <div className="mt-0.5 font-mono text-sm text-foreground">
                              {inflationPreview ? (
                                <>
                                  {formatPercent1(
                                    inflationPreview.nextEmissionSharePercent,
                                  )}
                                  %
                                </>
                              ) : (
                                "—"
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          !isBusy && setIsUnstakeAcknowledged((v) => !v)
                        }
                        disabled={isBusy}
                        className={cn(
                          "w-full rounded-xl border p-4 text-left transition-all mb-4",
                          isUnstakeAcknowledged
                            ? "border-border/40 bg-muted/50 dark:bg-muted/60"
                            : "border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 hover:border-border/30",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="ack-checkbox"
                            checked={isUnstakeAcknowledged}
                            disabled={isBusy}
                            onCheckedChange={(v) =>
                              setIsUnstakeAcknowledged(Boolean(v))
                            }
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "mt-0.5",
                              isUnstakeAcknowledged
                                ? ""
                                : "border-destructive data-[state=unchecked]:border-destructive",
                            )}
                          />
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-foreground">
                              {m.understandTitle}
                            </div>
                            <ul className="space-y-1.5 text-xs text-muted-foreground">
                              <li className="flex items-start gap-2">
                                <span className="text-muted-foreground/60 mt-px">
                                  •
                                </span>
                                <span>
                                  {m.understandRedirectPrefix}
                                  <span className="font-medium text-foreground">
                                    {m.understandRedirectStrong}
                                  </span>{" "}
                                  {m.understandRedirectSuffix}
                                </span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-muted-foreground/60 mt-px">
                                  •
                                </span>
                                <span>
                                  {m.understandUnstakingPrefix}
                                  <span className="font-medium text-foreground">
                                    {m.understandUnstakingStrong}
                                  </span>{" "}
                                  {m.understandUnstakingSuffix}
                                </span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </button>

                      <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={
                          isSubmitDisabled || isApproving || isSubmitting
                        }
                        className="w-full h-11"
                      >
                        {isSwappingEth
                          ? m.swappingEth
                          : isApproving
                            ? stakeMode === "stake"
                              ? m.signing
                              : m.approving
                            : isSubmitting
                              ? stakeMode === "stake"
                                ? m.confirming
                                : m.minting
                              : isProcessing
                                ? m.finalizing
                                : stakeMode === "stake"
                                  ? m.confirmStake
                                  : m.confirmMintAndStake}
                      </Button>

                      {(() => {
                        if (!isConnected) return null;
                        if (selectedCurrency !== "USDC") return null;
                        const usdcBalanceUsd =
                          usdcBalance != null
                            ? Number(formatUnits(usdcBalance, 6))
                            : 0;
                        if (
                          !Number.isFinite(amountNumber) ||
                          amountNumber <= 0
                        )
                          return null;
                        if (amountNumber <= usdcBalanceUsd) return null;
                        const deficitUsd = amountNumber - usdcBalanceUsd;
                        // Floor at $20 to clear the on-ramp minimum order
                        // amounts; surplus stays in the wallet as USDC.
                        const MIN_CARD_FUND_USDC = 20;
                        const roundedDeficit =
                          Math.ceil(deficitUsd * 100) / 100;
                        const cardFundAmount = Math.max(
                          MIN_CARD_FUND_USDC,
                          roundedDeficit
                        ).toFixed(2);
                        const isMinimumApplied =
                          roundedDeficit < MIN_CARD_FUND_USDC;
                        return (
                          // Hidden on mobile: in-app dApp browsers block the
                          // on-ramp popup, so the card flow stays desktop-only.
                          <div className="hidden lg:block space-y-1 mt-2">
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
                  </>
                )}
              </div>
            ) : (
              <SuccessLevelUp
                receipt={successReceipt}
                score={successScoreSnapshot}
                onDone={() => handleDialogOpenChange(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <UnstakingExplanationModal
        open={isUnstakingModalOpen}
        onOpenChange={setIsUnstakingModalOpen}
      />
    </>
  );
}

function SuccessLevelUp(props: {
  receipt: {
    regionId: number;
    regionLabel: string;
    amountGctl: number;
    deltaGlwPerWeek: number | null;
    nextRegionSharePercent: number | null;
    scoreBoostPerWeekLabel: string | null;
  } | null;
  score: {
    prevSteeringPoints: number;
    nextSteeringPoints: number;
    deltaSteeringPoints: number;
  } | null;
  onDone: () => void;
}) {
  const { t } = useLang();
  const m = t.bigDialogs.mintStake;
  const { receipt, onDone } = props;

  return (
    <div className="flex flex-col items-center justify-center py-3 space-y-5 animate-in fade-in zoom-in-95 duration-300">
      <div className="text-center space-y-1.5">
        <div className="text-xl font-semibold text-foreground">
          {m.impactActivated}
        </div>
        <div className="text-sm text-muted-foreground">
          {m.successDesc}
        </div>
        <div className="text-xs text-muted-foreground/80">
          {m.profileUpdateDelay}
        </div>
      </div>

      <div className="relative">
        <SegmentedCircleProgress
          totalSteps={100}
          filledBeforeSteps={0}
          userSteps={100}
          label={
            <div className="flex flex-col items-center justify-center">
              <Check className="h-10 w-10 text-foreground" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {m.powerActivated}
              </span>
            </div>
          }
          sublabel={
            <span className="text-xs text-[#22D3EE] font-medium">
              {m.rewardsRedirected}
            </span>
          }
          userColor="rgba(6,182,212,0.9)"
          otherColor="rgba(6,182,212,0.25)"
          size={210}
          strokeWidth={12}
        />
      </div>

      {receipt ? (
        <div className="w-full rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 overflow-hidden">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {m.regionLabel}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {receipt.regionLabel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {m.powerActivated}
              </span>
              <span className="text-sm font-mono font-semibold text-foreground">
                {formatTokenAmount(receipt.amountGctl, {
                  maximumFractionDigits: 2,
                })}{" "}
                GCTL
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {m.glwDirected}
              </span>
              <span className="text-sm font-mono font-semibold text-foreground">
                {receipt.deltaGlwPerWeek != null
                  ? `+${formatCompact(receipt.deltaGlwPerWeek)}`
                  : "—"}
                {m.perWeekShort}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <Button onClick={onDone} className="w-full h-11">
        {m.done}
      </Button>
    </div>
  );
}

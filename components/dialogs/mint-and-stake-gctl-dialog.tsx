"use client";

import * as React from "react";
import Decimal from "decimal.js";
import { formatUnits, parseUnits } from "viem";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import {
  Sun,
  X,
  ChevronLeft,
  Zap,
  Check,
  Loader2,
  Info,
  Bug,
} from "lucide-react";
import {
  DECIMALS_BY_TOKEN,
  type Currency,
  useForwarder,
  buildStakeMessage,
  stakeEIP712Types,
  stakeControlEIP712Domain,
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
import { Label } from "../ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
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
  useGctlApi,
  useRegions,
  useRegionStakeCap,
  useWallets,
} from "@/hooks";
import { useEnsNames } from "@/hooks/useEnsNames";
import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";
import { useDebouncedAsync } from "@/hooks/useDebouncedAsync";
import { trackEvent } from "@/lib/telemetry";
import { bucketEth, bucketToken, bucketUsd } from "@/lib/telemetry-buckets";
import { cn } from "@/lib/utils";
import { SteeringIcon } from "@/components/impact-icons";
import { usePolling } from "@/utils/use-polling";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

// --- Types & Constants ---

interface MintAndStakeGctlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usdcBalance: bigint | null;
  usdgBalance: bigint | null;
  forceStep1?: boolean;
}

type SourceCurrency = "GCTL" | "USDC" | "USDG" | "ETH";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;
const STEERING_POINTS_PER_GLW = 3;
const ETH_DECIMALS = 18;
const DEFAULT_SLIPPAGE_BPS = 100n; // 1%
const MAX_UINT256 = (1n << 256n) - 1n;

// --- Helpers ---

function isValidDecimalInput(value: string) {
  return value === "" || /^\d*\.?\d*$/.test(value);
}

function trimToDecimals(value: string, decimals: number) {
  if (!value) return "";
  const [i, f = ""] = value.split(".");
  if (!f) return i;
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
  options?: { maximumFractionDigits?: number }
) {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  });
}

function formatCompact(
  value: number,
  options?: { maximumFractionDigits?: number }
) {
  if (!Number.isFinite(value)) return "—";
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(maximumFractionDigits)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(maximumFractionDigits)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(maximumFractionDigits)}K`;
  return value.toFixed(
    abs >= 10 ? maximumFractionDigits : Math.min(4, maximumFractionDigits)
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

function getErrorMessage(error: unknown) {
  if (!error) return "Unknown error";
  if (error instanceof Error) {
    const message = error.message ?? "";
    if (message.includes("0xe450d38c")) {
      return "Insufficient balance to complete this transaction.";
    }
    return message;
  }
  const possible: any = error;
  const shortMessage = possible?.shortMessage ?? possible?.message ?? "";
  if (shortMessage.includes("0xe450d38c")) {
    return "Insufficient balance to complete this transaction.";
  }
  return shortMessage || "Unknown error";
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

function gctlFromAtomic(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    return new Decimal(raw).div(1_000_000).toNumber();
  } catch {
    return null;
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

  // Baseline: mirror `gctl-heatmap-widget` exactly (use current region `glwPerWeek`)
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
  const { address, isConnected } = useAccount();
  const { signer } = useEthersSigner();
  const wagmiChainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const isEthPayEnabled = wagmiChainId === 1 || wagmiChainId === 11155111;
  const addressKey = address?.toLowerCase() ?? null;
  const source = "mint_and_stake_gctl_dialog";
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
    [addressKey, isConnected, wagmiChainId]
  );
  const [optimisticHasGctlByAddress, setOptimisticHasGctlByAddress] =
    React.useState<Record<string, boolean>>({});

  const { regions, isRegionsLoading } = useRegions();
  const {
    gctlPriceNumber,
    gctlBalance,
    isGctlBalanceLoading,
    latestNonce,
    stakeGctlMutation,
    invalidateAllQueries,
    fetchTransferDetails,
  } = useGctlApi(address, { enabled: open });
  const { data: activeSummary } = useActiveRegionsSummary({ enabled: open });
  const { estimateEthToUsdc, swapEthToUsdc } = useSwapETHToUSDC();

  const impactWeekRangeQuery = useQuery({
    queryKey: ["impact-week-range", address?.toLowerCase()],
    enabled: Boolean(open && HUB_URL && address),
    staleTime: 60_000,
    retry: 0,
    queryFn: async (): Promise<{
      startWeek: number;
      endWeek: number;
    } | null> => {
      try {
        if (!HUB_URL || !address) return null;
        const url = new URL("/impact/glow-score", HUB_URL);
        url.searchParams.set("walletAddress", address.toLowerCase());
        url.searchParams.set("includeWeekly", "0");
        url.searchParams.set("includeProjection", "0");
        url.searchParams.set("includeReferral", "0");
        const res = await fetch(url.toString());
        if (!res.ok) return null;
        const json = (await res.json()) as {
          weekRange?: { startWeek: number; endWeek: number };
        };
        if (!json.weekRange) return null;
        return json.weekRange;
      } catch {
        return null;
      }
    },
  });

  const { walletDetails } = useWallets({
    walletAddress: address ?? undefined,
    enabled: open && Boolean(address),
  });
  const { ensNames } = useEnsNames({
    addresses: address ? [address] : [],
    enabled: open && Boolean(address),
  });
  const walletEnsName = address ? ensNames[address] ?? null : null;

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

  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
  const {
    checkTokenAllowance,
    checkTokenBalance,
    approveToken,
    mintGCTLAndStake,
    isProcessing,
  } = useForwarder(
    signer || undefined,
    chainId,
    publicClient,
    walletClient ?? undefined
  );

  const [selectedRegionId, setSelectedRegionId] = React.useState<number | null>(
    null
  );
  const selectedRegionLabel = React.useMemo(() => {
    const r = regions.find((reg: any) => reg.id === selectedRegionId);
    if (!r) return "";
    return (r as any).name || (r as any).title || `Region ${r.id}`;
  }, [regions, selectedRegionId]);
  const { stakeCap } = useRegionStakeCap(selectedRegionId, {
    enabled: open && Boolean(selectedRegionId),
  });

  const [selectedCurrency, setSelectedCurrency] =
    React.useState<SourceCurrency>("USDC");
  const [amountInput, setAmountInput] = React.useState<string>("");
  const [isUnstakeAcknowledged, setIsUnstakeAcknowledged] =
    React.useState(false);
  const [isUnstakingModalOpen, setIsUnstakingModalOpen] = React.useState(false);
  const [ethUsdcQuoteWei, setEthUsdcQuoteWei] = React.useState<bigint | null>(
    null
  );
  const [isSwappingEth, setIsSwappingEth] = React.useState(false);

  // Step 4 is the new SUCCESS State
  const [stepOverride, setStepOverride] = React.useState<1 | 2 | 3 | 4 | null>(
    null
  );

  const unstkedGctlBalanceNumber = React.useMemo(() => {
    try {
      return Number(
        formatUnits(BigInt(gctlBalance ?? "0"), DECIMALS_BY_TOKEN.GCTL)
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
      unstkedGctlBalanceNumber > 0
        ? "GCTL"
        : usdcBalance && usdcBalance > 0n
        ? "USDC"
        : usdgBalance && usdgBalance > 0n
        ? "USDG"
        : "ETH";
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
      }
    );
  }, [open, step, trackGctlEvent]);

  const ethBalanceQuery = useBalance({
    address,
    query: {
      enabled: Boolean(
        open && address && selectedCurrency === "ETH" && isEthPayEnabled
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
            : DECIMALS_BY_TOKEN.USDG
        )
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
          ETH_DECIMALS
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

  const stakeCapRemainingGctl = React.useMemo(() => {
    const remaining = gctlFromAtomic(stakeCap?.remaining);
    return remaining != null && Number.isFinite(remaining) ? remaining : null;
  }, [stakeCap?.remaining]);

  const isStakeCapExceeded = React.useMemo(() => {
    if (!stakeCap?.capApplied) return false;
    if (!estimatedGctl || !Number.isFinite(estimatedGctl)) return false;
    if (estimatedGctl <= 0) return false;
    if (stakeCapRemainingGctl == null) return false;
    const epsilon = 0.000001;
    return stakeCapRemainingGctl <= 0 || estimatedGctl > stakeCapRemainingGctl + epsilon;
  }, [estimatedGctl, stakeCap?.capApplied, stakeCapRemainingGctl]);

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
          .toFixed(0)
      );

      const weekRange = impactWeekRangeQuery.data;
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
  }, [impactWeekRangeQuery.data, inflationPreview]);

  const sliderPct = React.useMemo(() => {
    if (!maxAmountNumber || maxAmountNumber <= 0) return 0;
    if (!amountNumber || amountNumber <= 0) return 0;
    return Math.max(
      0,
      Math.min(100, Math.round((amountNumber / maxAmountNumber) * 100))
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
  const [stakeCapNoticeVisible, setStakeCapNoticeVisible] =
    React.useState(false);
  const [stakeCapContact, setStakeCapContact] = React.useState("");
  const [stakeCapContactError, setStakeCapContactError] = React.useState<
    string | null
  >(null);
  const [stakeCapSubmitting, setStakeCapSubmitting] = React.useState(false);
  const [stakeCapSubmitted, setStakeCapSubmitted] = React.useState(false);

  const updateStakeStepStatus = React.useCallback(
    (
      stepId: string,
      status: StepStatus,
      extras?: { errorMessage?: string }
    ) => {
      setStakeSteps((prev) => {
        const updated = prev.map((s) => {
          if (s.id !== stepId) return s;
          return {
            ...s,
            status,
            startedAt:
              status === "waiting_signature" || status === "confirming"
                ? s.startedAt ?? Date.now()
                : s.startedAt,
            errorMessage: extras?.errorMessage ?? s.errorMessage,
          };
        });
        stakeStepsRef.current = updated;
        return updated;
      });
    },
    []
  );

  const showStakeCapNotice = stakeCapNoticeVisible && isStakeCapExceeded;

  const triggerStakeCapNotice = React.useCallback(() => {
    setStakeCapNoticeVisible(true);
    setStakeCapContactError(null);
    setStakeCapSubmitted(false);
  }, []);

  React.useEffect(() => {
    if (!isStakeCapExceeded) {
      setStakeCapNoticeVisible(false);
      setStakeCapContactError(null);
      setStakeCapSubmitted(false);
    }
  }, [isStakeCapExceeded, selectedRegionId]);

  const [trackingTxHash, setTrackingTxHash] = React.useState<string | null>(
    null
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
    startPolling: startTransferPolling,
    stopPolling: stopTransferPolling,
    reset: resetTransferPolling,
  } = usePolling<PendingTransfer>({
    enabled: open && Boolean(trackingTxHash),
    pollInterval: 10_000,
    maxDuration: 60,
    pollFn: async () => {
      if (!trackingTxHash) throw new Error("Missing tx hash");
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
          "Transaction failed";
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

      const msg = error?.message || "Polling failed";
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
            "Transaction failed";
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
          ETH_DECIMALS
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
    [estimateEthToUsdc, isEthPayEnabled]
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
    [maxAmountNumber, runEthUsdcQuote, selectedCurrency]
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
        setStakeCapNoticeVisible(false);
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
    ]
  );

  // Snapshot of balance before transaction
  const [initialGctlBalance, setInitialGctlBalance] = React.useState<number>(0);

  const handleStakeExisting = React.useCallback(async () => {
    if (!isConnected || !address || !signer) {
      toast.error("Please connect your wallet");
      return;
    }
    if (!selectedRegionId) {
      toast.error("Please select a region");
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!isUnstakeAcknowledged) {
      toast.error("Please acknowledge the terms");
      return;
    }
    if (isStakeCapExceeded) {
      triggerStakeCapNotice();
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
          title: "Sign stake message",
          description: "Wallet signature (no gas)",
          status: "waiting_signature",
        },
        {
          id: "SUBMIT_STAKE",
          title: "Submit stake",
          description: "Sending to Glow Control",
          status: "idle",
        },
        {
          id: "REFRESH",
          title: "Refresh balances",
          description: "Updating your dashboard",
          status: "idle",
        },
      ];
      setStakeSteps(steps);
      stakeStepsRef.current = steps;

      setIsApproving(true);
      const atomicAmount = Math.round(amountNumber * 1_000_000).toString();
      const nonce = (Number(latestNonce) + 1).toString();
      const deadline = Math.floor(Date.now() / 1000 + 3600).toString();

      const signatureMessage = buildStakeMessage({
        nonce,
        amount: atomicAmount,
        toZoneId: String(selectedRegionId),
        deadline,
      });

      const eip712Types = stakeEIP712Types as unknown as Record<string, any[]>;
      const signature = await signer.signTypedData(
        stakeControlEIP712Domain(Number(process.env.NEXT_PUBLIC_CHAIN_ID)),
        eip712Types,
        signatureMessage
      );

      if (!signature) {
        setIsApproving(false);
        updateStakeStepStatus("SIGN_STAKE", "error", {
          errorMessage: "Signature missing",
        });
        setStakeUiState("error");
        setStakeUiErrorMessage("Failed to sign message");
        toast.error("Failed to sign message");
        return;
      }

      setIsApproving(false);
      updateStakeStepStatus("SIGN_STAKE", "completed");
      updateStakeStepStatus("SUBMIT_STAKE", "confirming");
      setIsSubmitting(true);

      const result = await stakeGctlMutation.mutateAsync({
        wallet: address,
        amount: atomicAmount,
        nonce,
        deadline,
        signature,
        regionId: selectedRegionId,
      });

      setIsSubmitting(false);
      updateStakeStepStatus("SUBMIT_STAKE", "completed");
      updateStakeStepStatus("REFRESH", "confirming");

      if (result) {
        trackGctlEvent("gctl_stake_existing_success", {
          step,
          region_id: selectedRegionId,
          stake_amount_bucket: stakeAmountBucket,
        });

        // SUCCESS: Show the dopamine screen instead of closing
        setSuccessReceipt({
          regionId: selectedRegionId,
          regionLabel: selectedRegionLabel || `Region ${selectedRegionId}`,
          amountGctl: amountNumber,
          deltaGlwPerWeek: inflationPreview?.deltaGlwPerWeek ?? null,
          nextRegionSharePercent:
            inflationPreview?.nextEmissionSharePercent ?? null,
          scoreBoostPerWeekLabel:
            steeringImpactQuote?.deltaPerWeekPoints ?? null,
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

        await invalidateAllQueries();
        updateStakeStepStatus("REFRESH", "completed");
        setStepOverride(4); // Move to success step
        setIsUnstakeAcknowledged(false);
        setStakeUiState("review");
      } else {
        throw new Error("Stake failed");
      }
    } catch (error) {
      setIsApproving(false);
      setIsSubmitting(false);
      const msg = getErrorMessage(error);
      setStakeUiState("error");
      setStakeUiErrorMessage(msg);
      const currentSteps = stakeStepsRef.current;
      const activeStep = currentSteps.find(
        (s) => s.status === "waiting_signature" || s.status === "confirming"
      );
      if (activeStep)
        updateStakeStepStatus(activeStep.id, "error", { errorMessage: msg });

      // Report to Sentry (exclude user rejections)
      const isUserRejected =
        msg?.includes("User rejected") || (error as any)?.code === 4001;
      if (!isUserRejected) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(msg));
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
    invalidateAllQueries,
    isConnected,
    isStakeCapExceeded,
    isUnstakeAcknowledged,
    latestNonce,
    selectedRegionId,
    signer,
    stakeGctlMutation,
    step,
    trackGctlEvent,
    unstkedGctlBalanceNumber,
    inflationPreview?.deltaGlwPerWeek,
    inflationPreview?.nextEmissionSharePercent,
    selectedRegionLabel,
    steeringScoreAfterPreview,
    steeringScoreBefore,
    steeringImpactQuote?.deltaPerWeekPoints,
    triggerStakeCapNotice,
    updateStakeStepStatus,
  ]);

  const handleStakeCapNotify = React.useCallback(async () => {
    if (!showStakeCapNotice) return;
    if (!selectedRegionId) {
      setStakeCapContactError("Select a region first.");
      return;
    }
    const trimmed = stakeCapContact.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const telegramHandleRegex = /^@?[a-zA-Z0-9_]{5,32}$/;
    const telegramUrlRegex = /^https?:\/\/t\.me\/([a-zA-Z0-9_]{5,32})$/i;

    let contactType: "email" | "telegram" | null = null;
    let normalizedContact = trimmed;

    if (emailRegex.test(trimmed)) {
      contactType = "email";
    } else {
      const urlMatch = trimmed.match(telegramUrlRegex);
      if (urlMatch?.[1]) {
        contactType = "telegram";
        normalizedContact = `@${urlMatch[1]}`;
      } else if (telegramHandleRegex.test(trimmed)) {
        contactType = "telegram";
        normalizedContact = trimmed.startsWith("@")
          ? trimmed
          : `@${trimmed}`;
      }
    }

    if (!contactType) {
      setStakeCapContactError("Enter a valid email or Telegram handle.");
      return;
    }

    setStakeCapSubmitting(true);
    setStakeCapContactError(null);
    setStakeCapSubmitted(false);

    const attemptedAmountGctl =
      stakeMode === "stake"
        ? roundDownToDecimalsString(amountNumber, 6)
        : roundDownToDecimalsString(estimatedGctl ?? 0, 6);
    const remainingGctl =
      stakeCapRemainingGctl != null
        ? roundDownToDecimalsString(stakeCapRemainingGctl, 6)
        : null;

    try {
      const response = await fetch("/api/gctl-stake-cap-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: normalizedContact,
          contactType,
          wallet: address,
          ensName: walletEnsName,
          regionId: selectedRegionId,
          regionName: selectedRegionLabel,
          attemptedAmountGctl,
          remainingCapGctl: remainingGctl,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStakeCapContactError(
          data?.error || "Failed to send notification. Please try again."
        );
        return;
      }
      setStakeCapSubmitted(true);
    } catch (error) {
      console.error("Failed to submit stake cap notification:", error);
      setStakeCapContactError("Failed to send notification. Please try again.");
    } finally {
      setStakeCapSubmitting(false);
    }
  }, [
    address,
    amountNumber,
    estimatedGctl,
    selectedRegionId,
    selectedRegionLabel,
    stakeCapContact,
    stakeCapRemainingGctl,
    stakeMode,
    walletEnsName,
    showStakeCapNotice,
  ]);

  const handleSubmit = React.useCallback(async () => {
    if (stakeMode === "stake") {
      return handleStakeExisting();
    }

    if (!isConnected || !address || !signer) {
      toast.error("Please connect your wallet");
      return;
    }
    if (!selectedRegionId) {
      toast.error("Please select a region");
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!Number.isFinite(chainId)) {
      toast.error("App misconfigured", {
        description: "NEXT_PUBLIC_CHAIN_ID is not set",
      });
      return;
    }
    if (!isUnstakeAcknowledged) {
      toast.error("Please acknowledge the terms");
      return;
    }
    if (isStakeCapExceeded) {
      triggerStakeCapNotice();
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
          description: "Converting via Uniswap",
          tokenFrom: "ETH",
          tokenTo: "USDC",
          status: "waiting_signature",
        });
      }
      steps.push(
        {
          id: "CHECK_ALLOWANCE",
          title: "Check allowance",
          description: "Verifying token permissions",
          status: "idle",
        },
        {
          id: "APPROVE",
          title: "Approve token",
          description: "One-time approval (if needed)",
          status: "idle",
        },
        {
          id: "MINT_AND_STAKE",
          title: "Mint & Stake GCTL",
          description: "Submitting transaction",
          status: "idle",
        },
        {
          id: "FINALIZE",
          title: "Finalize",
          description: "Waiting for confirmation",
          status: "idle",
        }
      );

      setStakeSteps(steps);
      stakeStepsRef.current = steps;

      let amountAtomic = toAtomic6(amountNumber);
      let mintCurrency: Currency = selectedCurrency as unknown as Currency;

      if (selectedCurrency === "ETH") {
        if (!isEthPayEnabled) {
          toast.error("ETH pay is only supported on mainnet or sepolia.");
          return;
        }

        setIsSwappingEth(true);
        updateStakeStepStatus("SWAP_ETH_TO_USDC", "confirming");
        const amountInWei = parseUnits(
          trimToDecimals(amountInput, ETH_DECIMALS),
          ETH_DECIMALS
        );
        const swapRes = await swapEthToUsdc({
          amountInWei,
          slippageBps: DEFAULT_SLIPPAGE_BPS,
        });
        setIsSwappingEth(false);

        if (!swapRes.ok) throw new Error(String(swapRes.val));
        if (swapRes.val.usdcReceived <= 0n)
          throw new Error("ETH swap returned 0 USDC");

        amountAtomic = swapRes.val.usdcReceived;
        mintCurrency = "USDC" as Currency;
        updateStakeStepStatus("SWAP_ETH_TO_USDC", "completed");
      }

      if (amountAtomic <= 0n) {
        throw new Error("Please enter a valid amount.");
      }
      if (selectedCurrency !== "ETH") {
        const tokenBalance = await checkTokenBalance(
          address as string,
          mintCurrency
        );
        if (tokenBalance < amountAtomic) {
          throw new Error("Insufficient balance to complete this transaction.");
        }
      }

      setIsApproving(true);
      updateStakeStepStatus("CHECK_ALLOWANCE", "confirming");
      const allowance = await checkTokenAllowance(
        address as string,
        mintCurrency
      );
      updateStakeStepStatus("CHECK_ALLOWANCE", "completed");
      if (allowance < amountAtomic) {
        updateStakeStepStatus("APPROVE", "waiting_signature");
        await approveToken(MAX_UINT256, mintCurrency);
        updateStakeStepStatus("APPROVE", "completed");
        toast.success(`${String(mintCurrency)} approved`);
      } else {
        updateStakeStepStatus("APPROVE", "completed");
      }
      setIsApproving(false);

      setIsSubmitting(true);
      updateStakeStepStatus("MINT_AND_STAKE", "waiting_signature");
      updateStakeStepStatus("MINT_AND_STAKE", "confirming");
      const txHash = await mintGCTLAndStake(
        amountAtomic,
        address as string,
        selectedRegionId,
        mintCurrency
      );
      setIsSubmitting(false);
      updateStakeStepStatus("MINT_AND_STAKE", "completed");

      trackGctlEvent("gctl_mint_stake_tx_sent", {
        step,
        region_id: selectedRegionId,
        pay_currency: selectedCurrency,
        mint_currency: String(mintCurrency),
        pay_amount_bucket: payAmountBucket,
        minted_gctl_bucket: mintedGctlBucket,
        tx_hash: txHash,
      });

      setHasPerformedAction(true);
      setTrackingTxHash(txHash);
      updateStakeStepStatus("FINALIZE", "confirming");
      startTransferPolling();

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
    } catch (error) {
      setIsApproving(false);
      setIsSubmitting(false);
      setIsSwappingEth(false);
      const msg = getErrorMessage(error);
      setStakeUiState("error");
      setStakeUiErrorMessage(msg);
      const currentSteps = stakeStepsRef.current;
      const activeStep = currentSteps.find(
        (s) => s.status === "waiting_signature" || s.status === "confirming"
      );
      if (activeStep)
        updateStakeStepStatus(activeStep.id, "error", { errorMessage: msg });

      // Report to Sentry (exclude user rejections)
      const isUserRejected =
        msg?.includes("User rejected") || (error as any)?.code === 4001;
      if (!isUserRejected) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(msg));
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
    approveToken,
    chainId,
    checkTokenAllowance,
    checkTokenBalance,
    estimatedGctl,
    handleStakeExisting,
    isConnected,
    isEthPayEnabled,
    isStakeCapExceeded,
    isUnstakeAcknowledged,
    mintGCTLAndStake,
    selectedCurrency,
    selectedRegionId,
    selectedRegionLabel,
    signer,
    stakeMode,
    swapEthToUsdc,
    trackGctlEvent,
    step,
    inflationPreview?.deltaGlwPerWeek,
    inflationPreview?.nextEmissionSharePercent,
    resetTransferPolling,
    startTransferPolling,
    steeringImpactQuote?.deltaPerWeekPoints,
    steeringScoreAfterPreview,
    steeringScoreBefore,
    triggerStakeCapNotice,
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
        (a, b) => (b.sharePercent ?? 0) - (a.sharePercent ?? 0)
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
    if (step === 1) return "Introduction";
    if (step === 2) return "Choose Target";
    if (step === 4) return "Impact Activated";
    if (selectedRegionLabel) {
      if (stakeMode === "stake") return `Stake to ${selectedRegionLabel}`;
      return `Mint & Stake to ${selectedRegionLabel}`;
    }
    return stakeMode === "stake" ? "Stake Power" : "Mint & Stake";
  }, [selectedRegionLabel, stakeMode, step]);

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
        toast.error("Please connect your wallet to continue");
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
                    <span className="ml-1">Back</span>
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
                    Step {step}/3
                  </div>
                  {showHeaderClose && (
                    <DialogClose asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Close"
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
                        Glow Control (GCTL)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Governance • Impact • Rewards
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground leading-relaxed">
                    GCTL is the governance power that directs where solar
                    infrastructure is built. By staking to a region, you direct{" "}
                    <span className="text-foreground font-medium">GLW</span>{" "}
                    emissions to fund solar farms there.
                  </div>

                  <div className="pt-1">
                    <div className="p-3 bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 rounded-lg">
                      <div className="text-[10px] font-medium text-[color:var(--color-glow-orange)] flex items-center gap-1.5 uppercase tracking-wider">
                        Off-chain Asset
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        GCTL is currently managed off-chain. It is{" "}
                        <span className="text-foreground font-medium">
                          non-transferable
                        </span>{" "}
                        and cannot be sold or traded at this time.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest pl-1 pb-1">
                    Your Benefits
                  </div>
                  <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 divide-y divide-border/20 dark:divide-border/40">
                    <div className="p-3.5 flex items-start gap-3">
                      <div className="h-7 w-7 rounded-lg bg-[#22D3EE]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="h-3.5 w-3.5 text-[#22D3EE]" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          Boost Impact Score
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Earn 3 pts per GLW steered on the leaderboard.
                        </div>
                      </div>
                    </div>
                    <div className="p-3.5 flex items-start gap-3">
                      <div className="h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          Direct Protocol Rewards
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          You decide which regions receive funding.
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
                    Start Staking
                  </Button>
                )}
              </div>
            ) : step === 2 ? (
              // STEP 2: SELECT REGION
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Select Region</div>
                  <div className="text-xs text-muted-foreground">
                    Where to direct GLW?
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

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRegionId(r.id)}
                        className={cn(
                          "relative w-full rounded-xl border px-4 py-3.5 text-left transition-all",
                          isSelected
                            ? "border-border/40 bg-muted/50 dark:bg-muted/60"
                            : "border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 hover:bg-muted/40 dark:hover:bg-muted/60 hover:border-border/30"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Current Share: {shareLabel}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="h-4 w-4 rounded-full bg-[#22D3EE]/20 flex items-center justify-center">
                              <div className="h-2 w-2 rounded-full bg-[#22D3EE]" />
                            </div>
                          )}
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
                  Continue
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
                          ? "Processing"
                          : "Transaction Failed"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {stakeUiState === "processing"
                          ? trackingTxHash
                            ? `Finalizing (≈ ${transferCountdown}s)…`
                            : "Follow the steps below in your wallet."
                          : "We couldn’t complete your transaction."}
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
                          Close
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
                          Try Again
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {showProcessing ? null : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <div className="text-sm font-medium">Input Amount</div>
                        <div className="text-xs font-mono text-muted-foreground">
                          Available:{" "}
                          {formatTokenAmount(maxAmountNumber, {
                            maximumFractionDigits: 2,
                          })}{" "}
                          {stakeMode === "stake" ? "GCTL" : selectedCurrency}
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
                                    : "sm:-translate-x-1/2"
                                )}
                              >
                                {p}%
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {showStakeCapNotice ? (
                      <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-5 space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-muted/50 dark:bg-muted/70 border border-border/20 dark:border-border/40 flex items-center justify-center">
                            <Bug className="h-6 w-6 text-[color:var(--color-glow-orange)]" />
                          </div>
                          <div className="space-y-2">
                            <div className="text-lg font-semibold text-foreground">
                              Something went wrong
                            </div>
                            <div className="text-xs text-muted-foreground">
                              We couldn’t complete your request. This is
                              unexpected — please reach out to the devs so we
                              can fix it.
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="stake-cap-contact"
                            className="text-xs text-muted-foreground"
                          >
                            Contact info for devs
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id="stake-cap-contact"
                              type="text"
                              placeholder="you@example.com or @handle"
                              value={stakeCapContact}
                              disabled={stakeCapSubmitting || stakeCapSubmitted}
                              onChange={(event) => {
                                setStakeCapContact(event.target.value);
                                if (stakeCapContactError)
                                  setStakeCapContactError(null);
                                if (stakeCapSubmitted)
                                  setStakeCapSubmitted(false);
                              }}
                              className="h-10 bg-card text-foreground placeholder:text-muted-foreground"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleStakeCapNotify}
                              disabled={
                                stakeCapSubmitting ||
                                stakeCapSubmitted ||
                                stakeCapContact.trim().length === 0
                              }
                              className="h-10"
                            >
                              {stakeCapSubmitting ? (
                                <span className="inline-flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Sending...
                                </span>
                              ) : stakeCapSubmitted ? (
                                "Sent"
                              ) : (
                                "Send to devs"
                              )}
                            </Button>
                          </div>
                          {stakeCapContactError ? (
                            <div className="text-xs text-destructive">
                              {stakeCapContactError}
                            </div>
                          ) : null}
                          {stakeCapSubmitted ? (
                            <div className="text-xs text-foreground">
                              Submitted. The devs will review and follow up.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest pl-1">
                        Impact Preview
                      </div>
                      <div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 overflow-hidden">
                        <div className="p-4 border-b border-border/20 dark:border-border/40 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-[#22D3EE]/10 flex items-center justify-center">
                              <SteeringIcon className="h-4 w-4 text-[#22D3EE]" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1 text-sm font-medium">
                                <span>Rewards Redirected</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label="How GCTL redirects rewards"
                                      className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      <Info className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    GCTL does not create new GLW for you. It
                                    redirects weekly emissions from other
                                    regions to this one. The +GLW/week goes to
                                    solar farms in the selected region, not to
                                    your wallet.
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                to farms in {selectedRegionLabel || "Region"}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-mono font-semibold text-foreground">
                              {inflationPreview ? (
                                <>
                                  +
                                  {formatCompact(
                                    inflationPreview.deltaGlwPerWeek
                                  )}
                                </>
                              ) : (
                                "—"
                              )}
                            </div>
                            <div className="text-xs font-mono text-[#22D3EE]">
                              GLW/week
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 divide-x divide-border/20 dark:divide-border/40 bg-muted/20 dark:bg-muted/30">
                          <div className="p-3 text-center">
                            <div className="text-[10px] text-muted-foreground font-mono uppercase">
                              Score Boost
                            </div>
                            <div className="mt-0.5 font-mono text-sm text-foreground">
                              {steeringImpactQuote ? (
                                <>+{steeringImpactQuote.deltaPerWeekPoints}</>
                              ) : (
                                "—"
                              )}
                              <span className="text-xs text-muted-foreground ml-1">
                                pts
                              </span>
                            </div>
                          </div>
                          <div className="p-3 text-center">
                            <div className="text-[10px] text-muted-foreground font-mono uppercase">
                              Region Share
                            </div>
                            <div className="mt-0.5 font-mono text-sm text-foreground">
                              {inflationPreview ? (
                                <>
                                  {formatPercent1(
                                    inflationPreview.nextEmissionSharePercent
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
                            : "border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 hover:border-border/30"
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
                                : "border-destructive data-[state=unchecked]:border-destructive"
                            )}
                          />
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-foreground">
                              I understand that:
                            </div>
                            <ul className="space-y-1.5 text-xs text-muted-foreground">
                              <li className="flex items-start gap-2">
                                <span className="text-muted-foreground/60 mt-px">•</span>
                                <span>
                                  GCTL{" "}
                                  <span className="font-medium text-foreground">
                                    redirects GLW emissions to farms
                                  </span>{" "}
                                  in the selected region — not to my wallet
                                </span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-muted-foreground/60 mt-px">•</span>
                                <span>
                                  Unstaking takes{" "}
                                  <span className="font-medium text-foreground">
                                    ~100 weeks
                                  </span>{" "}
                                  (1% release per week)
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
                          ? "Swapping ETH..."
                          : isApproving
                          ? stakeMode === "stake"
                            ? "Signing..."
                            : "Approving..."
                          : isSubmitting
                          ? stakeMode === "stake"
                            ? "Confirming..."
                            : "Minting..."
                          : isProcessing
                          ? "Finalizing..."
                          : stakeMode === "stake"
                          ? "Confirm Stake"
                          : "Confirm Mint & Stake"}
                      </Button>
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
  const { receipt, score, onDone } = props;

  const prev = Math.max(0, Math.floor(score?.prevSteeringPoints ?? 0));
  const next = Math.max(0, Math.floor(score?.nextSteeringPoints ?? prev));
  const delta = Math.max(0, next - prev);

  const count = useMotionValue(prev);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  React.useEffect(() => {
    const anim = animate(count, next, {
      duration: 1.1,
      ease: [0.43, 0.13, 0.23, 0.96],
    });
    return () => anim.stop();
  }, [count, next]);

  return (
    <div className="flex flex-col items-center justify-center py-3 space-y-5 animate-in fade-in zoom-in-95 duration-300">
      <div className="text-center space-y-1.5">
        <div className="text-xl font-semibold text-foreground">
          Impact Activated
        </div>
        <div className="text-sm text-muted-foreground">
          Your Governance Power is now live and directing rewards.
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 px-3 py-1">
          <SteeringIcon className="h-3.5 w-3.5 text-[#22D3EE]" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Steering Score
          </span>
        </div>
      </div>

      <div className="relative">
        <SegmentedCircleProgress
          totalSteps={100}
          filledBeforeSteps={0}
          userSteps={100}
          label={
            <div className="flex flex-col items-center justify-center">
              <motion.span className="text-4xl font-bold tracking-tight font-mono text-foreground tabular-nums">
                {rounded}
              </motion.span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                pts
              </span>
            </div>
          }
          sublabel={
            <span className="text-xs text-[#22D3EE] font-medium">
              +{delta.toLocaleString()} gained
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
                Region
              </span>
              <span className="text-sm font-semibold text-foreground">
                {receipt.regionLabel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Power Activated
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
                GLW Directed
              </span>
              <span className="text-sm font-mono font-semibold text-foreground">
                {receipt.deltaGlwPerWeek != null
                  ? `+${formatCompact(receipt.deltaGlwPerWeek)}`
                  : "—"}
                /wk
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <Button onClick={onDone} className="w-full h-11">
        Done
      </Button>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import { formatUnits, parseUnits } from "viem";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBalance, useChainId } from "wagmi";
import { Sun, X, ChevronLeft } from "lucide-react";
import {
  DECIMALS_BY_TOKEN,
  type Currency,
  useForwarder,
  buildStakeMessage,
  stakeEIP712Types,
  stakeControlEIP712Domain,
} from "@glowlabs-org/utils/browser";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ProcessingModal } from "../buy-gctl/processing-modal";
import { ConnectButton } from "../connect-button";
import { UnstakingExplanationModal } from "./unstaking-explanation-modal";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useActiveRegionsSummary, useGctlApi, useRegions } from "@/hooks";
import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";
import { useDebouncedAsync } from "@/hooks/useDebouncedAsync";
import { trackEvent } from "@/lib/telemetry";
import { bucketEth, bucketToken, bucketUsd } from "@/lib/telemetry-buckets";

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

function formatPercent(
  value: number,
  options?: { maximumFractionDigits?: number }
) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  });
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
  if (error instanceof Error) return error.message;
  const possible: any = error;
  return possible?.shortMessage ?? possible?.message ?? "Unknown error";
}

function toAtomic6(amount: number) {
  return BigInt(new Decimal(amount).mul(1_000_000).ceil().toFixed(0));
}

function toWholeNumberString(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return Math.floor(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

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

  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
  const { checkTokenAllowance, approveToken, mintGCTLAndStake, isProcessing } =
    useForwarder(signer || undefined, chainId);

  const [selectedRegionId, setSelectedRegionId] = React.useState<number | null>(
    null
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
    null
  );
  const [isSwappingEth, setIsSwappingEth] = React.useState(false);

  const [stepOverride, setStepOverride] = React.useState<1 | 2 | 3 | null>(
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

  const step = React.useMemo((): 1 | 2 | 3 => {
    if (!isConnected) return 1;
    return (stepOverride ?? defaultStep) as 1 | 2 | 3;
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

  const [isProcessingModalOpen, setIsProcessingModalOpen] =
    React.useState(false);
  const [processingTxHash, setProcessingTxHash] = React.useState<string | null>(
    null
  );

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
          : new Decimal(next).toFixed(2);
      setAmountInput(nextInput);

      if (selectedCurrency === "ETH") runEthUsdcQuote(nextInput);
    },
    [maxAmountNumber, selectedCurrency]
  );

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

  const handleDialogOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);

      if (!nextOpen) {
        setStepOverride(null);
        setIsUnstakeAcknowledged(false);

        void (async () => {
          try {
            await invalidateAllQueries();
          } catch {
            // no-op
          }
        })();
      }
    },
    [invalidateAllQueries, onOpenChange]
  );

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
      toast.error("Please acknowledge the unstaking rule");
      return;
    }

    const stakeAmountBucket = bucketToken(amountNumber);

    trackGctlEvent("gctl_stake_existing_submit", {
      step,
      region_id: selectedRegionId,
      stake_amount_bucket: stakeAmountBucket,
    });

    try {
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
        toast.error("Failed to sign message");
        return;
      }

      setIsApproving(false);
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

      if (result) {
        trackGctlEvent("gctl_stake_existing_success", {
          step,
          region_id: selectedRegionId,
          stake_amount_bucket: stakeAmountBucket,
        });

        toast.success("GCTL staked successfully!");

        setOptimisticHasGctlByAddress((prev) => {
          const key = (address as string | undefined)?.toLowerCase();
          if (!key) return prev;
          if (prev[key]) return prev;
          return { ...prev, [key]: true };
        });

        await invalidateAllQueries();
        setStepOverride(null);
        setIsUnstakeAcknowledged(false);
        onOpenChange(false);
      } else {
        throw new Error("Stake failed");
      }
    } catch (error) {
      setIsApproving(false);
      setIsSubmitting(false);
      trackGctlEvent("gctl_stake_existing_error", {
        step,
        region_id: selectedRegionId,
        error_message: getErrorMessage(error),
      });
      toast.error("Failed to stake GCTL", {
        description: getErrorMessage(error),
      });
    }
  }, [
    address,
    amountNumber,
    invalidateAllQueries,
    isConnected,
    isUnstakeAcknowledged,
    latestNonce,
    onOpenChange,
    selectedRegionId,
    signer,
    stakeGctlMutation,
    step,
    trackGctlEvent,
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
      toast.error("Please acknowledge the unstaking rule");
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

    try {
      let stage: "swap_eth" | "allowance" | "approve" | "mint" = "allowance";
      let amountAtomic = toAtomic6(amountNumber);
      let mintCurrency: Currency = selectedCurrency as unknown as Currency;

      if (selectedCurrency === "ETH") {
        if (!isEthPayEnabled) {
          toast.error("ETH pay is only supported on mainnet or sepolia.");
          return;
        }

        stage = "swap_eth";
        setIsSwappingEth(true);
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
      }

      setIsApproving(true);
      stage = "allowance";
      const allowance = await checkTokenAllowance(
        address as string,
        mintCurrency
      );
      if (allowance < amountAtomic) {
        stage = "approve";
        await approveToken(MAX_UINT256, mintCurrency);
        toast.success(`${String(mintCurrency)} approved`);
      }
      setIsApproving(false);

      setIsSubmitting(true);
      stage = "mint";
      const txHash = await mintGCTLAndStake(
        amountAtomic,
        address as string,
        selectedRegionId,
        mintCurrency
      );
      setIsSubmitting(false);

      trackGctlEvent("gctl_mint_stake_tx_sent", {
        step,
        region_id: selectedRegionId,
        pay_currency: selectedCurrency,
        mint_currency: String(mintCurrency),
        pay_amount_bucket: payAmountBucket,
        minted_gctl_bucket: mintedGctlBucket,
        tx_hash: txHash,
      });

      setProcessingTxHash(txHash);
      setIsProcessingModalOpen(true);

      setOptimisticHasGctlByAddress((prev) => {
        const key = (address as string | undefined)?.toLowerCase();
        if (!key) return prev;
        if (prev[key]) return prev;
        return { ...prev, [key]: true };
      });
    } catch (error) {
      setIsApproving(false);
      setIsSubmitting(false);
      setIsSwappingEth(false);
      trackGctlEvent("gctl_mint_stake_error", {
        step,
        region_id: selectedRegionId,
        pay_currency: selectedCurrency,
        pay_amount_bucket: payAmountBucket,
        minted_gctl_bucket: mintedGctlBucket,
        error_message: getErrorMessage(error),
      });
      toast.error("Failed to mint & stake GCTL", {
        description: getErrorMessage(error),
      });
    }
  }, [
    address,
    amountNumber,
    amountInput,
    approveToken,
    chainId,
    checkTokenAllowance,
    estimatedGctl,
    handleStakeExisting,
    isConnected,
    isEthPayEnabled,
    isUnstakeAcknowledged,
    mintGCTLAndStake,
    selectedCurrency,
    selectedRegionId,
    signer,
    stakeMode,
    swapEthToUsdc,
    trackGctlEvent,
    step,
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
    if (step === 2) return "Choose a Region";
    if (selectedRegionLabel) {
      if (stakeMode === "stake") return `Stake to ${selectedRegionLabel}`;
      return `Mint & Stake to ${selectedRegionLabel}`;
    }
    return stakeMode === "stake" ? "Stake" : "Mint & Stake";
  }, [selectedRegionLabel, stakeMode, step]);

  const handleBack = React.useCallback(() => {
    if (step === 3) return setStepOverride(2);
    if (step === 2) {
      if (!hasAnyGctl) return setStepOverride(1);
      handleDialogOpenChange(false);
      return;
    }
    handleDialogOpenChange(false);
  }, [handleDialogOpenChange, hasAnyGctl, step]);

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

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="bg-background backdrop-blur-sm rounded-3xl p-0 sm:max-w-md w-full border-border overflow-hidden flex flex-col gap-0 max-h-[calc(100dvh-2rem)]"
        >
          <DialogHeader className="px-5 py-4 border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              {step !== 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={handleBack}
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
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogClose>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
            {step === 1 ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl border border-border bg-background/60 flex items-center justify-center">
                      <Sun className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-base font-semibold">
                        Take Control of the Grid
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Introduction
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    GCTL is not just a token; it&apos;s voting power that
                    directs where solar infrastructure gets built.
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Important:
                    </span>{" "}
                    GCTL is currently an{" "}
                    <span className="font-medium text-foreground">
                      offchain asset,
                    </span>{" "}
                    it can&apos;t be sold or transferred yet.
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold">
                    Why Mint &amp; Stake?
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                    <li>
                      Steer protocol emissions: you decide which regions build
                      more solar power.
                    </li>
                    <li>Maximize impact: earn 3 pts/GLW on the leaderboard.</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    IMPORTANT:
                  </span>{" "}
                  GCTL is a long-term commitment. Unstaking takes ~100 weeks (1%
                  released per week).
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <Link
                      href="https://glow.org/blog/beginner-guide-to-gctl"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 text-muted-foreground hover:text-foreground"
                    >
                      Learn more
                    </Link>
                  </div>
                </div>

                {!isConnected ? (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Connect your wallet to continue.
                    </div>
                    <ConnectButton variant="default" size="medium" />
                  </div>
                ) : null}

                {isConnected ? (
                  <Button type="button" className="w-full" onClick={handleNext}>
                    Get Started
                  </Button>
                ) : null}
              </div>
            ) : step === 2 ? (
              <div className="space-y-4">
                <div className="text-sm font-semibold">
                  Where should the GLW rewards flow?
                </div>

                <div className="space-y-2">
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
                        className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? "border-primary/40 bg-muted/20"
                            : "border-border bg-muted/10 hover:bg-muted/20"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {r.name}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Current Share: {shareLabel} of total emissions
                            </div>
                          </div>

                          {regionsForSelection.mostActiveId === r.id ? (
                            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                              MOST ACTIVE
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={handleNext}
                  disabled={!selectedRegionId || isRegionsLoading}
                >
                  Next
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="text-sm font-semibold">Input Amount</div>
                  <div className="text-xs text-muted-foreground font-mono sm:text-right">
                    Avail:{" "}
                    {formatTokenAmount(maxAmountNumber, {
                      maximumFractionDigits:
                        stakeMode === "stake"
                          ? 2
                          : selectedCurrency === "ETH"
                          ? 6
                          : 2,
                    })}{" "}
                    {stakeMode === "stake" ? "GCTL" : selectedCurrency}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/10 px-4 py-3">
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amountInput}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!isValidDecimalInput(v)) return;
                        setAmountInput(v);
                        if (stakeMode === "stake" || selectedCurrency !== "ETH")
                          return;
                        if (!v || Number(v) <= 0) {
                          setEthUsdcQuoteWei(null);
                          return;
                        }
                        runEthUsdcQuote(v);
                      }}
                      className="border-0 bg-transparent p-0 h-10 text-lg font-mono tabular-nums focus-visible:ring-0 min-w-0"
                    />

                    <Select
                      value={selectedCurrency}
                      onValueChange={(v) => {
                        setSelectedCurrency(v as SourceCurrency);
                        setAmountInput("");
                        setEthUsdcQuoteWei(null);
                      }}
                    >
                      <SelectTrigger className="h-9 w-[110px] rounded-full bg-background/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end">
                        {unstkedGctlBalanceNumber > 0 ? (
                          <SelectItem value="GCTL">
                            <span className="flex items-center gap-2">
                              <span>GCTL</span>
                              <span className="text-xs text-muted-foreground">
                                (
                                {formatTokenAmount(unstkedGctlBalanceNumber, {
                                  maximumFractionDigits: 0,
                                })}
                                )
                              </span>
                            </span>
                          </SelectItem>
                        ) : null}
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="USDG">USDG</SelectItem>
                        {isEthPayEnabled ? (
                          <SelectItem value="ETH">ETH</SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {stakeMode === "mint" ? (
                  <div className="text-xs font-mono text-muted-foreground">
                    ≈{" "}
                    {isEthQuoteRunning && selectedCurrency === "ETH"
                      ? "Estimating…"
                      : estimatedGctl
                      ? formatTokenAmount(estimatedGctl, {
                          maximumFractionDigits: 2,
                        })
                      : "0"}{" "}
                    GCTL (Auto-staked)
                  </div>
                ) : null}

                {isOverBalance ? (
                  <div className="text-xs text-destructive">
                    Amount exceeds your available{" "}
                    {stakeMode === "stake" ? "GCTL" : selectedCurrency} balance
                  </div>
                ) : null}

                {stakeMode === "mint" && selectedCurrency === "ETH" ? (
                  <div className="text-[10px] text-muted-foreground">
                    You'll swap ETH → USDC on Uniswap, then mint &amp; stake.
                  </div>
                ) : null}

                <div className="px-1 pt-2">
                  <Slider
                    value={[sliderPct]}
                    onValueChange={(value) => {
                      const pct = value[0] ?? 0;
                      handleSetPct(pct);
                    }}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between gap-1">
                  {[25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      onClick={() => handleSetPct(p)}
                      className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                    >
                      {p === 100 ? "Max" : `${p}%`}
                    </button>
                  ))}
                </div>

                <div className="h-px bg-border/60" />

                <div className="rounded-xl border border-border bg-muted/10 p-4">
                  <div className="text-center space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      You're adding to{" "}
                      {inflationPreview?.regionName ??
                        selectedRegionLabel ??
                        "this region"}
                    </div>
                    <div className="font-mono text-3xl font-bold tracking-tight text-foreground">
                      {inflationPreview ? (
                        <>
                          +
                          {formatCompact(inflationPreview.deltaGlwPerWeek, {
                            maximumFractionDigits: 0,
                          })}
                          <span className="text-lg text-muted-foreground ml-1">
                            GLW/week
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>Share:</span>
                      {inflationPreview ? (
                        <span className="font-mono text-foreground">
                          {formatPercent1(
                            inflationPreview.currentEmissionSharePercent
                          )}
                          %<span className="text-muted-foreground mx-1">→</span>
                          {formatPercent1(
                            inflationPreview.nextEmissionSharePercent
                          )}
                          %
                        </span>
                      ) : (
                        <span className="font-mono">—</span>
                      )}
                    </div>
                    <div className="h-3 w-px bg-border/60" />
                    <div className="flex items-center gap-1.5">
                      <span>Your Impact Pts:</span>
                      {steeringImpactQuote ? (
                        <span className="font-mono text-foreground">
                          +{steeringImpactQuote.deltaPerWeekPoints}/wk
                        </span>
                      ) : (
                        <span className="font-mono">—</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="unstake-ack"
                    checked={isUnstakeAcknowledged}
                    onCheckedChange={(v) =>
                      setIsUnstakeAcknowledged(Boolean(v))
                    }
                    className="mt-0.5 border-accent"
                  />
                  <Label
                    htmlFor="unstake-ack"
                    className="text-sm text-muted-foreground leading-5 cursor-pointer"
                  >
                    I understand the{" "}
                    <span className="font-medium text-accent">1%</span> weekly
                    unstaking rule.{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsUnstakingModalOpen(true);
                      }}
                      className="text-accent hover:text-accent/80 underline underline-offset-4 font-medium"
                    >
                      Learn more
                    </button>
                  </Label>
                </div>
              </div>
            )}
          </div>

          {step === 3 ? (
            <div className="border-t border-border/60 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] flex">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitDisabled || isApproving || isSubmitting}
                className="w-full sm:w-auto sm:ml-auto"
              >
                {isSwappingEth
                  ? "Swapping ETH..."
                  : isApproving
                  ? stakeMode === "stake"
                    ? "Signing..."
                    : "Approving..."
                  : isSubmitting
                  ? stakeMode === "stake"
                    ? "Staking..."
                    : "Minting..."
                  : isProcessing
                  ? "Indexing..."
                  : stakeMode === "stake"
                  ? `Stake ${toWholeNumberString(estimatedGctl ?? 0)} GCTL`
                  : `Mint & Stake ${toWholeNumberString(
                      estimatedGctl ?? 0
                    )} GCTL`}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ProcessingModal
        isOpen={isProcessingModalOpen}
        trackingTxHash={processingTxHash}
        onConfirmed={() => {
          void invalidateAllQueries();
        }}
        onClose={() => {
          setIsProcessingModalOpen(false);
          setProcessingTxHash(null);
          invalidateAllQueries();
        }}
      />

      <UnstakingExplanationModal
        open={isUnstakingModalOpen}
        onOpenChange={setIsUnstakingModalOpen}
      />
    </>
  );
}

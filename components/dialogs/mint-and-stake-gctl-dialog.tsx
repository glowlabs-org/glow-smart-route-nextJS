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
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useActiveRegionsSummary, useGctlApi, useRegions } from "@/hooks";
import { useSwapETHToUSDC } from "@/hooks/useSwapETHToUSDC";
import { useDebouncedAsync } from "@/hooks/useDebouncedAsync";

interface MintAndStakeGctlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usdcBalance: bigint | null;
  usdgBalance: bigint | null;
}

type MintCurrency = "USDC" | "USDG" | "ETH";

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
}: MintAndStakeGctlDialogProps) {
  const { address, isConnected } = useAccount();
  const { signer } = useEthersSigner();
  const wagmiChainId = useChainId();
  const isEthPayEnabled = wagmiChainId === 1 || wagmiChainId === 11155111;
  const addressKey = address?.toLowerCase() ?? null;
  const [optimisticHasGctlByAddress, setOptimisticHasGctlByAddress] =
    React.useState<Record<string, boolean>>({});

  const { regions, isRegionsLoading } = useRegions();
  const {
    gctlPriceNumber,
    gctlBalance,
    isGctlBalanceLoading,
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
    React.useState<MintCurrency>("USDC");
  const [amountInput, setAmountInput] = React.useState<string>("");
  const [isUnstakeAcknowledged, setIsUnstakeAcknowledged] =
    React.useState(false);
  const [ethUsdcQuoteWei, setEthUsdcQuoteWei] = React.useState<bigint | null>(
    null
  );
  const [isSwappingEth, setIsSwappingEth] = React.useState(false);

  const [stepOverride, setStepOverride] = React.useState<1 | 2 | 3 | null>(
    null
  );

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
    if (!isConnected) return 2;
    if (isGctlBalanceLoading) return 2;
    return hasAnyGctl ? 2 : 1;
  }, [hasAnyGctl, isConnected, isGctlBalanceLoading]);

  const step = (stepOverride ?? defaultStep) as 1 | 2 | 3;

  const ethBalanceQuery = useBalance({
    address,
    query: {
      enabled: Boolean(
        open && address && selectedCurrency === "ETH" && isEthPayEnabled
      ),
    },
  });

  const maxAmountNumber = React.useMemo(() => {
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
  }, [ethBalanceQuery.data?.value, selectedCurrency, usdcBalance, usdgBalance]);

  const amountNumber = React.useMemo(() => {
    if (amountInput.trim() === "") return 0;
    return toNumber(amountInput);
  }, [amountInput]);

  const isOverBalance = React.useMemo(() => {
    if (selectedCurrency !== "ETH") return amountNumber > maxAmountNumber;
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
  }, [amountNumber, ethUsdcQuoteWei, gctlPriceNumber, selectedCurrency]);

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
    (selectedCurrency === "ETH" && !isEthPayEnabled) ||
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

  const handleSubmit = React.useCallback(async () => {
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

    try {
      let amountAtomic = toAtomic6(amountNumber);
      let mintCurrency: Currency = selectedCurrency as unknown as Currency;

      if (selectedCurrency === "ETH") {
        if (!isEthPayEnabled) {
          toast.error("ETH pay is only supported on mainnet or sepolia.");
          return;
        }

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
      const allowance = await checkTokenAllowance(
        address as string,
        mintCurrency
      );
      if (allowance < amountAtomic) {
        await approveToken(MAX_UINT256, mintCurrency);
        toast.success(`${String(mintCurrency)} approved`);
      }
      setIsApproving(false);

      setIsSubmitting(true);
      const txHash = await mintGCTLAndStake(
        amountAtomic,
        address as string,
        selectedRegionId,
        mintCurrency
      );
      setIsSubmitting(false);

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
    isConnected,
    isEthPayEnabled,
    isUnstakeAcknowledged,
    mintGCTLAndStake,
    selectedCurrency,
    selectedRegionId,
    signer,
    swapEthToUsdc,
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

  const dialogTitle = React.useMemo(() => {
    if (step === 1) return "Introduction";
    if (step === 2) return "Choose a Region";
    if (selectedRegionLabel) return `Mint & Stake to ${selectedRegionLabel}`;
    return "Mint & Stake";
  }, [selectedRegionLabel, step]);

  const handleBack = React.useCallback(() => {
    if (step === 3) return setStepOverride(2);
    if (step === 2) {
      if (!hasAnyGctl) return setStepOverride(1);
      onOpenChange(false);
      return;
    }
    onOpenChange(false);
  }, [hasAnyGctl, onOpenChange, step]);

  const handleNext = React.useCallback(() => {
    if (step === 1) return setStepOverride(2);
    if (step === 2) return setStepOverride(3);
  }, [step]);

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
            {!isConnected ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Connect your wallet to mint and stake GCTL.
                </div>
                <ConnectButton variant="default" size="medium" />
              </div>
            ) : step === 1 ? (
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

                <Button type="button" className="w-full" onClick={handleNext}>
                  Get Started
                </Button>
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
                      maximumFractionDigits: selectedCurrency === "ETH" ? 6 : 2,
                    })}
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
                        if (selectedCurrency !== "ETH") return;
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
                        setSelectedCurrency(v as MintCurrency);
                        setAmountInput("");
                        setEthUsdcQuoteWei(null);
                      }}
                    >
                      <SelectTrigger className="h-9 w-[96px] rounded-full bg-background/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="USDG">USDG</SelectItem>
                        {isEthPayEnabled ? (
                          <SelectItem value="ETH">ETH</SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

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

                {isOverBalance ? (
                  <div className="text-xs text-destructive">
                    Amount exceeds your available {selectedCurrency} balance
                  </div>
                ) : null}

                {selectedCurrency === "ETH" ? (
                  <div className="text-[10px] text-muted-foreground">
                    You’ll swap ETH → USDC on Uniswap, then mint &amp; stake.
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

                <div className="space-y-2">
                  <div className="text-sm font-semibold">
                    Your Impact Preview
                  </div>

                  <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 text-sm">
                    <div className="space-y-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <span className="text-muted-foreground">Region:</span>
                        <span className="font-mono sm:text-right break-words">
                          {inflationPreview?.regionName ??
                            selectedRegionLabel ??
                            "—"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <span className="text-muted-foreground">
                          Emissions:
                        </span>
                        {inflationPreview ? (
                          <span className="font-mono sm:text-right break-words">
                            {formatPercent1(
                              inflationPreview.currentEmissionSharePercent
                            )}
                            % →{" "}
                            {formatPercent1(
                              inflationPreview.nextEmissionSharePercent
                            )}
                            % (+
                            {formatCompact(inflationPreview.deltaGlwPerWeek, {
                              maximumFractionDigits: 0,
                            })}{" "}
                            GLW/wk)
                          </span>
                        ) : (
                          <span className="font-mono text-muted-foreground sm:text-right">
                            —
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <span className="text-muted-foreground">
                          Steering Pts:
                        </span>
                        {steeringImpactQuote ? (
                          <span className="font-mono sm:text-right break-words">
                            +{steeringImpactQuote.deltaPerWeekPoints} pts/week
                          </span>
                        ) : (
                          <span className="font-mono text-muted-foreground sm:text-right">
                            —
                          </span>
                        )}
                      </div>
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
                    unstaking rule.
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
                  ? "Approving..."
                  : isSubmitting
                  ? "Minting..."
                  : isProcessing
                  ? "Indexing..."
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
    </>
  );
}

"use client";

import * as React from "react";
import Decimal from "decimal.js";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import {
  DECIMALS_BY_TOKEN,
  type Currency,
  useForwarder,
} from "@glowlabs-org/utils/browser";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Slider } from "../ui/slider";
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
import { useRegions } from "@/hooks/useRegions";
import { useGctlApi } from "@/hooks/useGctlApi";
import { useActiveRegionsSummary } from "@/hooks/useActiveRegionsSummary";

interface MintAndStakeGctlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usdcBalance: bigint | null;
  usdgBalance: bigint | null;
}

type MintCurrency = "USDC" | "USDG";

function isValidDecimalInput(value: string) {
  return value === "" || /^\d*\.?\d*$/.test(value);
}

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

function formatCompact(value: number, options?: { maximumFractionDigits?: number }) {
  if (!Number.isFinite(value)) return "—";
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(maximumFractionDigits)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(maximumFractionDigits)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(maximumFractionDigits)}K`;
  return value.toFixed(abs >= 10 ? maximumFractionDigits : Math.min(4, maximumFractionDigits));
}

function formatPercent(value: number, options?: { maximumFractionDigits?: number }) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  });
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

export function MintAndStakeGctlDialog({
  open,
  onOpenChange,
  usdcBalance,
  usdgBalance,
}: MintAndStakeGctlDialogProps) {
  const { address, isConnected } = useAccount();
  const { signer } = useEthersSigner();

  const { regions, isRegionsLoading } = useRegions();
  const { gctlPriceNumber, invalidateAllQueries } = useGctlApi(address);
  const { data: activeSummary } = useActiveRegionsSummary({ enabled: open });

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

  const maxAmountNumber = React.useMemo(() => {
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
  }, [selectedCurrency, usdcBalance, usdgBalance]);

  const amountNumber = React.useMemo(() => {
    if (amountInput.trim() === "") return 0;
    return toNumber(amountInput);
  }, [amountInput]);

  const isOverBalance = amountNumber > maxAmountNumber;
  const isMissingRegion = !selectedRegionId;
  const isMissingAmount = amountInput.trim() === "" || amountNumber <= 0;

  const estimatedGctl = React.useMemo(() => {
    if (!gctlPriceNumber || gctlPriceNumber <= 0) return null;
    if (!amountNumber || amountNumber <= 0) return null;
    return amountNumber / gctlPriceNumber;
  }, [amountNumber, gctlPriceNumber]);

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

    const currentSharePercent = (currentRegionStaked / totalStaked) * 100;
    const currentGlwPerWeek = region.glwPerWeek;
    const nextShare = nextRegionStaked / nextTotalStaked;
    const nextGlwPerWeek = totalGlwRewards * nextShare;
    const deltaGlwPerWeek = nextGlwPerWeek - currentGlwPerWeek;

    return {
      currentGlwPerWeek,
      nextGlwPerWeek,
      deltaGlwPerWeek,
      currentSharePercent,
      nextSharePercent: nextShare * 100,
    } as const;
  }, [activeSummary, estimatedGctl, selectedRegionId]);

  const sliderPct = React.useMemo(() => {
    if (!maxAmountNumber || maxAmountNumber <= 0) return 0;
    if (!amountNumber || amountNumber <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((amountNumber / maxAmountNumber) * 100)));
  }, [amountNumber, maxAmountNumber]);

  const isSubmitDisabled =
    !isConnected ||
    !address ||
    !signer ||
    isMissingRegion ||
    isMissingAmount ||
    isOverBalance ||
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
      setAmountInput(new Decimal(next).toFixed(2));
    },
    [maxAmountNumber]
  );

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

    try {
      const amountAtomic = toAtomic6(amountNumber);

      setIsApproving(true);
      const allowance = await checkTokenAllowance(
        address as string,
        selectedCurrency as Currency
      );
      if (allowance < amountAtomic) {
        await approveToken(amountAtomic, selectedCurrency as Currency);
        toast.success(`${selectedCurrency} approved`);
      }
      setIsApproving(false);

      setIsSubmitting(true);
      const txHash = await mintGCTLAndStake(
        amountAtomic,
        address as string,
        selectedRegionId,
        selectedCurrency as Currency
      );
      setIsSubmitting(false);

      setProcessingTxHash(txHash);
      setIsProcessingModalOpen(true);
    } catch (error) {
      setIsApproving(false);
      setIsSubmitting(false);
      toast.error("Failed to mint & stake GCTL", {
        description: getErrorMessage(error),
      });
    }
  }, [
    address,
    amountNumber,
    approveToken,
    chainId,
    checkTokenAllowance,
    isConnected,
    mintGCTLAndStake,
    selectedCurrency,
    selectedRegionId,
    signer,
  ]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-background backdrop-blur-sm rounded-3xl p-0 sm:max-w-sm w-full border-border shadow-2xl overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-base">
              {selectedRegionLabel
                ? `Mint & stake to ${selectedRegionLabel}`
                : "Mint & Stake GCTL"}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 pt-2 space-y-5">
            {!isConnected ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Connect your wallet to mint and stake GCTL.
                </div>
                <ConnectButton variant="default" size="medium" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Select region
                  </div>
                  <Select
                    value={selectedRegionId ? String(selectedRegionId) : ""}
                    onValueChange={(v) => setSelectedRegionId(Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          isRegionsLoading ? "Loading regions..." : "Choose a region"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((r: any) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {(r as any).name || (r as any).title || `Region ${r.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Pay with
                  </div>
                  <Select
                    value={selectedCurrency}
                    onValueChange={(v) => {
                      setSelectedCurrency(v as MintCurrency);
                      setAmountInput("");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USDC">USDC</SelectItem>
                      <SelectItem value="USDG">USDG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-muted-foreground">
                      Amount
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Available:{" "}
                      <span
                        className={isOverBalance ? "text-destructive" : "text-muted-foreground"}
                      >
                        {formatTokenAmount(maxAmountNumber)} {selectedCurrency}
                      </span>
                    </div>
                  </div>

                  <div className="text-center py-2">
                    <div className="flex items-baseline justify-center gap-2">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amountInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!isValidDecimalInput(v)) return;
                          setAmountInput(v);
                        }}
                        className="bg-transparent border-0 p-0 md:h-20 md:text-5xl text-4xl font-bold tabular-nums text-center focus-visible:ring-0 w-auto"
                      />
                      <span className="text-xl text-muted-foreground font-medium">
                        {selectedCurrency}
                      </span>
                    </div>
                    {estimatedGctl ? (
                      <div className="text-xs text-muted-foreground mt-2">
                        Est. minted:{" "}
                        <span className="text-foreground font-medium">
                          {formatTokenAmount(estimatedGctl, {
                            maximumFractionDigits: 4,
                          })}{" "}
                          GCTL
                        </span>
                      </div>
                    ) : null}
                    {isOverBalance ? (
                      <div className="text-xs text-destructive mt-1">
                        Insufficient {selectedCurrency} balance
                      </div>
                    ) : null}
                  </div>

                  {inflationPreview ? (
                    <div className="rounded-2xl border border-border bg-muted/10 p-4">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Estimated region boost
                      </div>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Additional rewards
                          </span>
                          <span className="text-xs font-mono text-foreground tabular-nums">
                            +{formatCompact(inflationPreview.deltaGlwPerWeek, { maximumFractionDigits: 2 })}{" "}
                            <span className="text-muted-foreground">GLW/week</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Region rewards
                          </span>
                          <span className="text-xs font-mono text-muted-foreground tabular-nums">
                            {formatCompact(inflationPreview.currentGlwPerWeek, { maximumFractionDigits: 2 })}{" "}
                            <span className="text-muted-foreground">→</span>{" "}
                            <span className="text-foreground">
                              {formatCompact(inflationPreview.nextGlwPerWeek, { maximumFractionDigits: 2 })}
                            </span>{" "}
                            <span className="text-muted-foreground">GLW/week</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Region share
                          </span>
                          <span className="text-xs font-mono text-muted-foreground tabular-nums">
                            {formatPercent(inflationPreview.currentSharePercent, { maximumFractionDigits: 2 })}%{" "}
                            <span className="text-muted-foreground">→</span>{" "}
                            <span className="text-foreground">
                              {formatPercent(inflationPreview.nextSharePercent, { maximumFractionDigits: 2 })}%
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="px-2">
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

                  <div className="flex gap-2 justify-center">
                    {[25, 50, 75, 100].map((p) => (
                      <Button
                        key={p}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPct(p)}
                        className="px-4"
                        disabled={!maxAmountNumber || maxAmountNumber <= 0}
                      >
                        {p === 100 ? "Max" : `${p}%`}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => onOpenChange(false)}
                    disabled={isApproving || isSubmitting || isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSubmit}
                    disabled={isSubmitDisabled || isApproving || isSubmitting}
                  >
                    {isApproving || isSubmitting || isProcessing
                      ? "Processing..."
                      : "Mint & Stake"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingModal
        isOpen={isProcessingModalOpen}
        trackingTxHash={processingTxHash}
        onClose={() => {
          setIsProcessingModalOpen(false);
          setProcessingTxHash(null);
          invalidateAllQueries();
        }}
      />
    </>
  );
}



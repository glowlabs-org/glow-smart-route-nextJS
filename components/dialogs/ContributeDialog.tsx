"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { formatUnits } from "viem";
import {
  DECIMALS_BY_TOKEN,
  buildStakeMessage,
  stakeEIP712Types,
  stakeControlEIP712Domain,
  type StakeSignatureRequest,
  type Currency,
  useForwarder,
} from "@glowlabs-org/utils/browser";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useGctlApi, useRegions } from "@/hooks";
import { ProcessingModal } from "../buy-gctl/processing-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

interface ContributeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stakeTargetGctl?: string;
  currentStaked?: bigint;
}

export function ContributeDialog({
  open,
  onOpenChange,
  currentStaked,
  stakeTargetGctl,
}: ContributeDialogProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { signer } = useEthersSigner();
  const {
    gctlBalance,
    latestNonce,
    stakeGctlMutation,
    gctlPriceNumber,
    invalidateAllQueries,
  } = useGctlApi(address);
  const {
    checkTokenAllowance,
    approveToken,
    checkTokenBalance,
    isProcessing,
    mintGCTLAndStake,
  } = useForwarder(
    signer || undefined,
    Number(process.env.NEXT_PUBLIC_CHAIN_ID),
    publicClient,
    walletClient
  );

  const { regions, isRegionsLoading } = useRegions();
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const selectedRegionLabel = useMemo(() => {
    const r = regions.find((reg: any) => reg.id === selectedRegionId);
    if (!r) return "";
    return (r as any).name || (r as any).title || `Region ${r.id}`;
  }, [regions, selectedRegionId]);

  const gctlBalanceNumber = useMemo(() => {
    try {
      return parseFloat(
        formatUnits(BigInt(gctlBalance), DECIMALS_BY_TOKEN.GCTL)
      );
    } catch {
      return 0;
    }
  }, [gctlBalance]);

  const [stakeAmountInput, setStakeAmountInput] = useState<string>("");
  const stakeAmount = useMemo(() => {
    if (stakeAmountInput.trim() === "") return 0;
    const n = Number(stakeAmountInput);
    return Number.isFinite(n) ? n : 0;
  }, [stakeAmountInput]);
  const [selectedCurrency, setSelectedCurrency] = useState<"GCTL" | Currency>(
    gctlBalanceNumber > 0 ? "GCTL" : "USDC"
  );
  const [stableBalance, setStableBalance] = useState<number | null>(null);
  const [isStableBalanceLoading, setIsStableBalanceLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isMintingSubmitting, setIsMintingSubmitting] = useState(false);
  const [isWaitingForReceipt, setIsWaitingForReceipt] = useState(false);
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false);
  const [processingTxHash, setProcessingTxHash] = useState<string | null>(null);
  const [contributionSuccess, setContributionSuccess] = useState(false);
  const [contributedAmount, setContributedAmount] = useState<number>(0);
  const [contributedCurrency, setContributedCurrency] = useState<
    "GCTL" | Currency
  >("GCTL");

  useEffect(() => {
    if (!open) {
      setStakeAmountInput("");
      setSelectedCurrency(gctlBalanceNumber > 0 ? "GCTL" : "USDC");
      setContributionSuccess(false);
      setContributedAmount(0);
      setSelectedRegionId(null);
    }
  }, [open, gctlBalanceNumber]);

  // Load selected stablecoin balance when using USDC/USDG
  useEffect(() => {
    if (!address || !signer || selectedCurrency === "GCTL") return;
    let cancelled = false;
    async function load() {
      try {
        setIsStableBalanceLoading(true);
        const raw = await checkTokenBalance(
          address as string,
          selectedCurrency as Currency
        );
        if (cancelled) return;
        const human = Number(raw) / 1_000_000; // 6 decimals
        setStableBalance(human);
      } catch (error) {
        if (!cancelled) {
          toast.error("Failed to fetch token balance", {
            description:
              error instanceof Error ? error.message : "Unknown error",
          });
        }
      } finally {
        if (!cancelled) setIsStableBalanceLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [address, signer, selectedCurrency]);

  const targetAmount = useMemo(() => {
    if (!stakeTargetGctl) return 0;
    try {
      return parseFloat(
        formatUnits(BigInt(stakeTargetGctl), DECIMALS_BY_TOKEN.GCTL)
      );
    } catch {
      return 0;
    }
  }, [stakeTargetGctl]);

  const currentStakedFormatted = useMemo(() => {
    try {
      return currentStaked
        ? parseFloat(formatUnits(currentStaked, DECIMALS_BY_TOKEN.GCTL))
        : 0;
    } catch {
      return 0;
    }
  }, [currentStaked]);

  const currentProgress =
    targetAmount > 0 ? (currentStakedFormatted / targetAmount) * 100 : 0;

  // For mint method, convert USD input to GCTL amount for calculations
  const effectiveGctlAmount = useMemo(() => {
    if (selectedCurrency === "GCTL") {
      return stakeAmount;
    } else {
      // Convert USD amount to GCTL
      return gctlPriceNumber > 0 ? stakeAmount / gctlPriceNumber : 0;
    }
  }, [selectedCurrency, stakeAmount, gctlPriceNumber]);

  const userContributionPercentage =
    targetAmount > 0 ? (effectiveGctlAmount / targetAmount) * 100 : 0;
  const projectedProgress =
    targetAmount > 0
      ? ((currentStakedFormatted + effectiveGctlAmount) / targetAmount) * 100
      : 0;

  async function handleStakeExisting() {
    if (!isConnected || !address || !signer) {
      toast.error("Missing required information");
      return;
    }
    if (!selectedRegionId) {
      toast.error("Please select a region");
      return;
    }
    if (stakeAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      const atomicAmount = Math.round(stakeAmount * 1_000_000).toString();

      const nonce = (Number(latestNonce) + 1).toString();
      const deadline = Math.floor(Date.now() / 1000 + 3600).toString();

      const signatureMessage = buildStakeMessage({
        nonce,
        amount: atomicAmount,
        toZoneId: String(selectedRegionId),
        deadline,
      });

      const eip712Types = stakeEIP712Types as unknown as Record<string, any[]>;
      const signature: StakeSignatureRequest["signature"] =
        await signer.signTypedData(
          stakeControlEIP712Domain(Number(process.env.NEXT_PUBLIC_CHAIN_ID)),
          eip712Types,
          signatureMessage
        );

      if (!signature) {
        toast.error("Failed to sign message");
        return;
      }

      const result = await stakeGctlMutation.mutateAsync({
        wallet: address,
        amount: atomicAmount,
        nonce,
        deadline,
        signature,
        regionId: selectedRegionId,
      });

      if (result) {
        setContributionSuccess(true);
        setContributedAmount(stakeAmount);
        setContributedCurrency("GCTL");
        toast.success("Contribution successful!");
        invalidateAllQueries();
      } else {
        throw new Error("Stake failed");
      }
    } catch (error) {
      toast.error("Failed to stake GCTL");
    }
  }

  async function handleMintAndStake() {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet");
      return;
    }
    if (!selectedRegionId) {
      toast.error("Please select a region");
      return;
    }
    if (stakeAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      // stakeAmount is already in USD when minting, so use it directly
      const stableAmountAtomic = BigInt(Math.ceil(stakeAmount * 1_000_000));
      console.log("stableAmountAtomic", stableAmountAtomic.toString());
      console.log("stakeAmount", stakeAmount.toString());
      setIsApproving(true);
      const allowance = await checkTokenAllowance(
        address as string,
        selectedCurrency as Currency
      );
      if (allowance < stableAmountAtomic) {
        await approveToken(stableAmountAtomic, selectedCurrency as Currency);
        toast.success(`${selectedCurrency} approved`);
      }
      setIsApproving(false);

      setIsMintingSubmitting(true);
      const txHash = await mintGCTLAndStake(
        stableAmountAtomic,
        address as string,
        selectedRegionId,
        selectedCurrency as Currency
      );
      setIsMintingSubmitting(false);

      setProcessingTxHash(txHash);
      setIsProcessingModalOpen(true);
      setIsWaitingForReceipt(true);
      setContributedAmount(stakeAmount);
      setContributedCurrency(selectedCurrency);
    } catch (error) {
      setIsApproving(false);
      setIsMintingSubmitting(false);
      setIsWaitingForReceipt(false);
      toast.error("Failed to mint & stake");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 bg-card border border-border/40 rounded-[24px] overflow-hidden">
        <DialogHeader className="px-6 pt-8 pb-4 border-b border-border/40">
          <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
            {selectedRegionLabel
              ? `Stake to ${selectedRegionLabel}`
              : "Stake GCTL"}
          </DialogTitle>
        </DialogHeader>

        <div className="p-5">
          {contributionSuccess ? (
            // Success State
            <div className="text-center py-4">
              <div className="mb-6">
                <div className="w-16 h-16 bg-[#4ADE80]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-[#4ADE80]"
                    fill="none"
                    strokeWidth="2"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Contribution Successful
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You've successfully contributed{" "}
                  {contributedAmount.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {contributedCurrency}
                  {selectedRegionLabel ? ` to ${selectedRegionLabel}` : ""}
                </p>
              </div>

              {/* Success details - hide goal-related rows when there is no target */}
              <div className="space-y-4 mb-6 text-left bg-muted/30 dark:bg-muted/50 rounded-xl border border-border/20 dark:border-border/40 p-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    Amount Contributed
                  </span>
                  <span className="text-foreground text-sm font-medium">
                    {contributedAmount.toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    {contributedCurrency}
                  </span>
                </div>
                {targetAmount > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">
                        Your Impact
                      </span>
                      <span className="text-foreground text-sm font-medium">
                        {(
                          ((contributedCurrency === "GCTL"
                            ? contributedAmount
                            : contributedAmount / gctlPriceNumber) /
                            targetAmount) *
                          100
                        ).toFixed(1)}
                        % of goal
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">
                        New Total Progress
                      </span>
                      <span className="text-foreground text-sm font-medium">
                        {(
                          ((currentStakedFormatted +
                            (contributedCurrency === "GCTL"
                              ? contributedAmount
                              : contributedAmount / gctlPriceNumber)) /
                            targetAmount) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setContributionSuccess(false);
                    setStakeAmountInput("");
                    invalidateAllQueries();
                  }}
                  className="flex-1"
                >
                  Make Another Contribution
                </Button>
                <Button onClick={() => onOpenChange(false)} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          ) : (
            // Normal contribution form
            <>
              {/* Region selection */}
              <div className="space-y-2 mb-4">
                <div className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                  Select region
                </div>
                <Select
                  value={selectedRegionId ? String(selectedRegionId) : ""}
                  onValueChange={(v) => setSelectedRegionId(Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        isRegionsLoading
                          ? "Loading regions..."
                          : "Choose a region"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r: any) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {(r as any).name ||
                          (r as any).title ||
                          `Region ${r.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount selection (remove-liquidity style) */}
              <div className="space-y-4">
                <h3 className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                  Select stake amount
                </h3>

                {/* Large Amount Display Input */}
                <div className="text-center py-4">
                  <div className="flex items-baseline justify-center gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={stakeAmountInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setStakeAmountInput("");
                          return;
                        }
                        const raw = val.replace(/[^0-9.]/g, "");
                        const n = Number(raw);
                        const maxAmt =
                          selectedCurrency === "GCTL"
                            ? gctlBalanceNumber
                            : stableBalance ?? 0;
                        if (!Number.isFinite(n)) {
                          setStakeAmountInput("");
                          return;
                        }
                        const clamped = Math.max(0, Math.min(maxAmt || 0, n));
                        setStakeAmountInput(String(clamped));
                      }}
                      className="bg-transparent border-0 p-0 md:h-24 md:text-5xl font-bold tabular-nums text-center focus-visible:ring-0 w-auto"
                    />
                    <span className="text-xl text-muted-foreground font-medium">
                      {selectedCurrency === "GCTL" ? "GCTL" : "USD"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Available:{" "}
                    {(selectedCurrency === "GCTL"
                      ? gctlBalanceNumber
                      : stableBalance ?? 0
                    ).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{" "}
                    {selectedCurrency === "GCTL" ? "GCTL" : "USD"}
                  </div>
                </div>

                {/* Slider */}
                <div className="px-2">
                  <Slider
                    value={[
                      (() => {
                        const maxAmt =
                          selectedCurrency === "GCTL"
                            ? gctlBalanceNumber
                            : stableBalance ?? 0;
                        if (!maxAmt || maxAmt <= 0) return 0;
                        return Math.round((stakeAmount / maxAmt) * 100);
                      })(),
                    ]}
                    onValueChange={(value) => {
                      const pct = value[0] ?? 0;
                      const maxAmt =
                        selectedCurrency === "GCTL"
                          ? gctlBalanceNumber
                          : stableBalance ?? 0;
                      const next = (pct / 100) * (maxAmt || 0);
                      setStakeAmountInput(String(next));
                    }}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Preset Buttons */}
                <div className="flex gap-2 justify-center">
                  {[25, 50, 75, 100].map((p) => (
                    <Button
                      key={p}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const maxAmt =
                          selectedCurrency === "GCTL"
                            ? gctlBalanceNumber
                            : stableBalance ?? 0;
                        setStakeAmountInput(String(((maxAmt || 0) * p) / 100));
                      }}
                      className="px-4"
                    >
                      {p === 100 ? "Max" : `${p}%`}
                    </Button>
                  ))}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isProcessing || isApproving || isMintingSubmitting}
                >
                  Cancel
                </Button>
                {selectedCurrency === "GCTL" ? (
                  <Button
                    onClick={handleStakeExisting}
                    disabled={
                      !isConnected ||
                      stakeAmount <= 0 ||
                      stakeAmount > gctlBalanceNumber
                    }
                  >
                    {`Stake ${
                      stakeAmount > 0
                        ? stakeAmount.toLocaleString("en-US", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })
                        : ""
                    } GCTL`}
                  </Button>
                ) : (
                  <Button
                    onClick={handleMintAndStake}
                    disabled={
                      !isConnected ||
                      stakeAmount <= 0 ||
                      isProcessing ||
                      isApproving ||
                      isMintingSubmitting
                    }
                  >
                    {isProcessing || isApproving || isMintingSubmitting
                      ? "Processing..."
                      : `Stake ${
                          stakeAmount > 0
                            ? stakeAmount.toLocaleString("en-US", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                                style: "currency",
                                currency: "USD",
                              })
                            : ""
                        }`}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>

      <ProcessingModal
        isOpen={isProcessingModalOpen}
        trackingTxHash={processingTxHash}
        onConfirmed={() => {
          void invalidateAllQueries();
        }}
        onClose={() => {
          setIsProcessingModalOpen(false);
          setProcessingTxHash(null);
          setIsWaitingForReceipt(false);
          // Don't close the dialog automatically, let user close it after seeing success
        }}
      />
    </Dialog>
  );
}

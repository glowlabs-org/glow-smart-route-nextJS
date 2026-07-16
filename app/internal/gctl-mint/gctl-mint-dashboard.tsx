"use client";

import * as React from "react";
import Decimal from "decimal.js";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ConnectButton } from "@/components/connect-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  POL_GCTL_ENDOWMENT_WALLET,
  shortenHash,
} from "@/lib/pol-gctl";
import {
  usePolGctlMint,
  type PolGctlPhase,
} from "@/hooks/use-pol-gctl-mint";
import { cn } from "@/lib/utils";

const PHASES: Array<{
  phase: PolGctlPhase;
  label: string;
  description: string;
}> = [
  {
    phase: "checking-wallet",
    label: "Verify wallet",
    description: "Confirm the connected wallet and mainnet.",
  },
  {
    phase: "approving-glw",
    label: "Approve tokens",
    description: "Approve GLW and USDG only when allowance is insufficient.",
  },
  {
    phase: "adding-liquidity",
    label: "Mint LP",
    description: "Add GLW/USDG liquidity through Uniswap V2.",
  },
  {
    phase: "donating-lp",
    label: "Send to Endowment",
    description: "Transfer the exact receipt-derived LP amount.",
  },
  {
    phase: "waiting-confirmations",
    label: "Confirm donation",
    description: "Wait for the Control backend confirmation threshold.",
  },
  {
    phase: "minting-gctl",
    label: "Mint GCTL",
    description: "Record the exact direct mint and notify Discord.",
  },
  {
    phase: "complete",
    label: "Complete",
    description: "GCTL balance and global supply are updated.",
  },
];

const PHASE_ORDER: Record<PolGctlPhase, number> = {
  idle: -1,
  "switching-chain": 0,
  "checking-wallet": 0,
  "approving-glw": 1,
  "approving-usdg": 1,
  "adding-liquidity": 2,
  "donating-lp": 3,
  "previewing-mint": 4,
  "waiting-confirmations": 4,
  "minting-gctl": 5,
  complete: 6,
};

function formatDecimal(value: string | null | undefined, decimals = 6) {
  if (!value) return "—";
  try {
    const decimal = new Decimal(value);
    const [whole, fraction = ""] = decimal
      .toDecimalPlaces(decimals, Decimal.ROUND_DOWN)
      .toFixed(decimals)
      .split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decimals > 0 ? `${grouped}.${fraction}` : grouped;
  } catch {
    return "—";
  }
}

function TxLink({ hash, label }: { hash: string; label: string }) {
  return (
    <a
      href={`https://etherscan.io/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
    >
      {label}: {shortenHash(hash)}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-10 w-10 rounded-xl transition-transform duration-150 ease-out active:scale-[0.96]"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        toast.success(`${label} copied`);
      }}
      aria-label={`Copy ${label}`}
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
}

function ProgressSteps({
  phase,
  confirmations,
  requiredConfirmations,
}: {
  phase: PolGctlPhase;
  confirmations: number | null;
  requiredConfirmations: number | null;
}) {
  const activeIndex = PHASE_ORDER[phase];

  return (
    <div
      className="divide-y divide-border/20"
      aria-live="polite"
      aria-label="Mint progress"
    >
      {PHASES.map((item, index) => {
        const isComplete = activeIndex > index || phase === "complete";
        const isActive = activeIndex === index && phase !== "complete";
        const isConfirmationStep =
          item.phase === "waiting-confirmations" &&
          confirmations != null &&
          requiredConfirmations != null;

        return (
          <div
            key={item.phase}
            className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
          >
            <div className="mt-0.5">
              {isComplete ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : isActive ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </span>
              ) : (
                <Circle className="h-6 w-6 text-muted-foreground/30" />
              )}
            </div>
            <div className="min-w-0">
              <div
                className={cn(
                  "text-sm font-medium",
                  isComplete || isActive
                    ? "text-foreground"
                    : "text-muted-foreground/50",
                )}
              >
                {item.label}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground/60">
                {isConfirmationStep
                  ? `${confirmations} / ${requiredConfirmations} confirmations`
                  : item.description}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GctlMintDashboard() {
  const workflow = usePolGctlMint();
  const [glwAmount, setGlwAmount] = React.useState("");
  const [usdgAmount, setUsdgAmount] = React.useState("");
  const [resumeTxHash, setResumeTxHash] = React.useState("");
  const [acknowledged, setAcknowledged] = React.useState(false);

  const handleMatchPoolRatio = React.useCallback(() => {
    const suggested = workflow.suggestedGlwForUsdg(usdgAmount);
    if (!suggested) {
      toast.error("Enter USDG and wait for pool reserves to load");
      return;
    }
    setGlwAmount(suggested);
  }, [usdgAmount, workflow]);

  const handleMint = React.useCallback(async () => {
    try {
      const result = await workflow.mint({
        glw: glwAmount,
        usdg: usdgAmount,
      });
      toast.success(`Minted ${result.gctlMinted} GCTL`);
      if (!result.notificationSent) {
        toast.warning(
          "GCTL minted successfully; Discord delivery is queued for retry",
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "POL mint failed");
    }
  }, [glwAmount, usdgAmount, workflow]);

  const handleResume = React.useCallback(async () => {
    try {
      const result = await workflow.resume(resumeTxHash);
      toast.success(
        result.alreadyProcessed
          ? `Mint already processed: ${result.gctlMinted} GCTL`
          : `Minted ${result.gctlMinted} GCTL`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Resume failed");
    }
  }, [resumeTxHash, workflow]);

  const canMint =
    workflow.isConnected &&
    glwAmount.trim().length > 0 &&
    usdgAmount.trim().length > 0 &&
    acknowledged &&
    !workflow.isProcessing;
  const result = workflow.progress.result;
  const preview = workflow.progress.preview;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/internal"
            className="mb-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Internal tools
          </Link>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
            Internal · Protocol-Owned Liquidity
          </div>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Mint GCTL from liquidity
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm text-muted-foreground/70">
            Add GLW/USDG liquidity, send the exact UNI-V2 tokens to the Glow
            Endowment, and mint GCTL from the confirmed donation transaction.
          </p>
        </div>
        <ConnectButton variant="default" size="medium" className="sm:w-64" />
      </div>

      {!workflow.isConnected ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-5 w-5 text-muted-foreground/60" />
            Connect a wallet to begin.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Liquidity amounts</CardTitle>
              <CardDescription>
                Amounts remain decimal strings and are converted directly to
                token atomic units.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    USDG
                  </span>
                  <div className="relative">
                    <Input
                      value={usdgAmount}
                      onChange={(event) => setUsdgAmount(event.target.value)}
                      inputMode="decimal"
                      placeholder="0.000000"
                      disabled={workflow.isProcessing}
                      className="h-12 pr-16 font-mono tabular-nums"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                      USDG
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground/60">
                    Balance: {formatDecimal(workflow.balances?.usdg, 6)}
                  </span>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    GLW
                  </span>
                  <div className="relative">
                    <Input
                      value={glwAmount}
                      onChange={(event) => setGlwAmount(event.target.value)}
                      inputMode="decimal"
                      placeholder="0.000000000000000000"
                      disabled={workflow.isProcessing}
                      className="h-12 pr-14 font-mono tabular-nums"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                      GLW
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground/60">
                    Balance: {formatDecimal(workflow.balances?.glw, 6)}
                  </span>
                </label>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-fit rounded-xl transition-transform duration-150 ease-out active:scale-[0.96]"
                onClick={handleMatchPoolRatio}
                disabled={
                  workflow.isPoolLoading ||
                  workflow.isProcessing ||
                  !usdgAmount.trim()
                }
              >
                {workflow.isPoolLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Match current pool ratio
              </Button>

              <div className="rounded-2xl border border-border/20 bg-muted/20 p-4">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                  Permanent destination
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="min-w-0 break-all font-mono text-xs">
                    {POL_GCTL_ENDOWMENT_WALLET}
                  </span>
                  <CopyButton
                    value={POL_GCTL_ENDOWMENT_WALLET}
                    label="Endowment address"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-border/20 p-4 text-sm">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(value) =>
                    setAcknowledged(Boolean(value))
                  }
                  disabled={workflow.isProcessing}
                  className="mt-0.5"
                />
                <span>
                  I understand the LP transfer to the Endowment is permanent and
                  the resulting GCTL amount is calculated from the donation
                  transaction block.
                </span>
              </label>

              <Button
                type="button"
                onClick={handleMint}
                disabled={!canMint}
                className="h-12 rounded-xl transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                {workflow.isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  "Add liquidity and mint GCTL"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resume from a donation</CardTitle>
              <CardDescription>
                Use the final LP transfer hash if the browser was closed or a
                backend confirmation timed out.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={resumeTxHash}
                onChange={(event) => setResumeTxHash(event.target.value)}
                placeholder="0x… LP transfer transaction"
                className="h-11 flex-1 font-mono text-xs"
                disabled={workflow.isProcessing}
              />
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl transition-transform duration-150 ease-out active:scale-[0.96]"
                onClick={handleResume}
                disabled={
                  !workflow.isConnected ||
                  !resumeTxHash.trim() ||
                  workflow.isProcessing
                }
              >
                Resume mint
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressSteps
                phase={workflow.progress.phase}
                confirmations={workflow.progress.confirmations}
                requiredConfirmations={
                  workflow.progress.requiredConfirmations
                }
              />
            </CardContent>
          </Card>

          {workflow.progress.addLiquidityTxHash ||
          workflow.progress.donationTxHash ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Transactions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {workflow.progress.addLiquidityTxHash ? (
                  <TxLink
                    hash={workflow.progress.addLiquidityTxHash}
                    label="Liquidity"
                  />
                ) : null}
                {workflow.progress.donationTxHash ? (
                  <TxLink
                    hash={workflow.progress.donationTxHash}
                    label="Donation"
                  />
                ) : null}
                {workflow.progress.lpTokensRaw ? (
                  <div className="text-xs text-muted-foreground">
                    Exact LP raw:{" "}
                    <span className="break-all font-mono text-foreground">
                      {workflow.progress.lpTokensRaw}
                    </span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {preview ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {result ? "Mint complete" : "Exact mint preview"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {result ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    GCTL minted successfully
                  </div>
                ) : null}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
                    GCTL minted
                  </div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                    {formatDecimal(preview.gctlMinted, 6)}
                  </div>
                  <div className="text-xs text-muted-foreground">GCTL</div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-border/20 pt-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                      USD value
                    </div>
                    <div className="mt-1 font-mono text-sm">
                      ${formatDecimal(preview.usdValue, 6)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                      GCTL price
                    </div>
                    <div className="mt-1 font-mono text-sm">
                      ${formatDecimal(preview.gctlPriceUsd, 6)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                      Underlying GLW
                    </div>
                    <div className="mt-1 font-mono text-sm">
                      {formatDecimal(preview.underlyingGlw, 6)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                      Underlying USDG
                    </div>
                    <div className="mt-1 font-mono text-sm">
                      {formatDecimal(preview.underlyingUsdg, 6)}
                    </div>
                  </div>
                </div>
                {result && !result.notificationSent ? (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                    Discord delivery is pending and will be retried
                    automatically.
                  </div>
                ) : null}
                {result ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl transition-transform duration-150 ease-out active:scale-[0.96]"
                    onClick={workflow.reset}
                  >
                    Start another mint
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

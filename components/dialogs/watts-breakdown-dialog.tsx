"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { ArrowLeftRight, HelpCircle, Leaf } from "lucide-react";

import {
  VaultIcon,
  SteeringIcon,
  ReferralIcon,
} from "@/components/impact-icons";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LaunchpadDialog } from "@/components/dialogs/launchpad-dialog";
import { ReferralNetworkDialog } from "@/components/dialogs/referral-network-dialog";
import { useV2ImpactWallet } from "@/hooks/v2-impact";
import { useReferralLaunch } from "@/hooks/use-referral-launch";
import { trackEvent } from "@/lib/telemetry";

interface WattsBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string | null;
  title?: string;
}

function fmtWatts(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

function SourceRow({
  icon: Icon,
  label,
  sublabel,
  watts,
  accentClass,
  ctaLabel,
  onCta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  watts: number;
  accentClass: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const hasValue = watts > 0;
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/20 last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
            hasValue ? accentClass : "bg-muted/50 text-muted-foreground",
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-foreground truncate">
            {label}
          </span>
          <span className="text-[10px] text-muted-foreground truncate">
            {sublabel}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right min-w-[72px]">
          <div
            className={cn(
              "font-mono font-semibold text-sm tabular-nums",
              hasValue ? "text-foreground" : "text-muted-foreground/50",
            )}
          >
            {watts > 0 ? "+" : ""}
            {fmtWatts(watts)}
          </div>
          <div className="text-[10px] text-muted-foreground">W</div>
        </div>
        {ctaLabel && onCta && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[11px] font-medium border-border/40 bg-transparent shrink-0 w-[88px] justify-center"
            onClick={onCta}
          >
            {ctaLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export function WattsBreakdownDialog({
  open,
  onOpenChange,
  walletAddress,
  title,
}: WattsBreakdownDialogProps) {
  const { address } = useAccount();
  const isOwnWallet =
    address && walletAddress
      ? address.toLowerCase() === walletAddress.toLowerCase()
      : false;
  const { isLive: isReferralLive } = useReferralLaunch();

  const impactQuery = useV2ImpactWallet(open ? walletAddress : null);
  const data = impactQuery.data;

  const [isLaunchpadOpen, setIsLaunchpadOpen] = useState(false);
  const [isReferralNetworkOpen, setIsReferralNetworkOpen] = useState(false);

  const buckets = useMemo(() => {
    const farms = data?.farms ?? [];
    const sum = (key: keyof (typeof farms)[number]["buckets"]) =>
      farms.reduce((acc, f) => acc + (Number(f.buckets[key]) || 0), 0);
    return {
      delegator: sum("delegator"),
      staker: sum("staker"),
      delegator_referral: sum("delegator_referral"),
      staker_referral: sum("staker_referral"),
    };
  }, [data]);

  const totalWatts = Number(data?.totalWatts ?? 0);
  // Residual = the hero total minus the four farm-allocation buckets. A
  // positive residual is watts that came in via the shop / admin transfers
  // (the watts_transfers ledger), which aren't farm-bucket-derived; surfacing
  // it as its own source row makes the rows add up to the hero total.
  const transfersWatts =
    totalWatts -
    (buckets.delegator +
      buckets.staker +
      buckets.delegator_referral +
      buckets.staker_referral);
  const totalCarbon = Number(data?.totalCarbonCredits ?? 0);
  const farmCount = data?.farms.length ?? 0;
  const regionCount = data?.wattsByRegion.length ?? 0;

  const isLoading = impactQuery.isLoading;
  const isError = impactQuery.isError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40">
        <DialogDescription className="sr-only">
          Breakdown of how this wallet earned its watts (real-world solar impact).
        </DialogDescription>

        {/* Hero */}
        <div className="border-b border-border/40 pb-6 pt-8 px-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              {title || "Your Watts"}
            </DialogTitle>
            <div className="text-6xl font-mono font-semibold text-foreground tracking-tighter">
              {isLoading ? "—" : fmtWatts(totalWatts)}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mt-2">
              {totalCarbon > 0
                ? `${fmtWatts(totalCarbon)} tons of CO₂ · ${farmCount} ${farmCount === 1 ? "farm" : "farms"} · ${regionCount} ${regionCount === 1 ? "region" : "regions"}`
                : "Solar impact across all funded farms"}
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[65vh]">
          <div className="p-5 space-y-6">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded-xl bg-muted/50" />
                <Skeleton className="h-14 w-full rounded-xl bg-muted/50" />
                <Skeleton className="h-14 w-full rounded-xl bg-muted/50" />
              </div>
            ) : isError ? (
              <div className="text-center text-muted-foreground py-10 text-sm">
                Unable to load your watts breakdown.
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                    Where your watts come from
                  </h3>
                  <div className="space-y-0">
                    <SourceRow
                      icon={VaultIcon}
                      label="Delegator share"
                      sublabel="Your share of every farm you helped fund"
                      watts={buckets.delegator}
                      accentClass="bg-[color:var(--delegation-purple)]/10 text-[color:var(--delegation-purple)]"
                      ctaLabel={isOwnWallet ? "Delegate" : undefined}
                      onCta={
                        isOwnWallet ? () => setIsLaunchpadOpen(true) : undefined
                      }
                    />
                    <SourceRow
                      icon={SteeringIcon}
                      label="Staker share"
                      sublabel="Your share of every farm in your staked regions"
                      watts={buckets.staker}
                      accentClass="bg-[#22D3EE]/10 text-[#22D3EE]"
                      ctaLabel={isOwnWallet ? "Stake GCTL" : undefined}
                      onCta={
                        isOwnWallet ? () => setIsLaunchpadOpen(true) : undefined
                      }
                    />
                    {isReferralLive && (
                      <SourceRow
                        icon={ReferralIcon}
                        label="Referrals"
                        sublabel="A cut of each referee's delegator and staker watts"
                        watts={
                          buckets.delegator_referral + buckets.staker_referral
                        }
                        accentClass="bg-[color:var(--color-glow-orange)]/10 text-[color:var(--color-glow-orange)]"
                        ctaLabel={isOwnWallet ? "Invite" : undefined}
                        onCta={
                          isOwnWallet
                            ? () => setIsReferralNetworkOpen(true)
                            : undefined
                        }
                      />
                    )}
                    {Math.abs(transfersWatts) > 0.5 && (
                      <SourceRow
                        icon={ArrowLeftRight}
                        label="Shop & transfers"
                        sublabel="Watts bought in the shop or transferred to you"
                        watts={transfersWatts}
                        accentClass="bg-[#4ADE80]/10 text-[#4ADE80]"
                      />
                    )}
                  </div>
                </div>

                {totalCarbon > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                        Real-world impact
                      </h3>
                      <div className="space-y-0">
                        <div className="flex items-center justify-between gap-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 bg-[#4ADE80]/10 text-[#4ADE80]">
                              <Leaf className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium text-foreground truncate">
                                Tons of CO₂
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate">
                                30-year lifetime offset from your share
                              </span>
                            </div>
                          </div>
                          <div className="text-right min-w-[72px]">
                            <div className="font-mono font-semibold text-sm text-foreground tabular-nums">
                              {fmtWatts(totalCarbon)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              credits
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <Separator />
                <div className="rounded-lg bg-muted/30 dark:bg-muted/50 border border-border/30 dark:border-border/40 p-3">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Watts measure real-world solar impact.
                    </span>{" "}
                    Each fully funded farm distributes its nameplate watts to
                    its delegators, the GCTL stakers in its region, and the
                    referrers behind them. Vault transfers move watts with the
                    position; selling delegation moves the watts to the new
                    owner.
                  </p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border/40 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 border-border/40 bg-transparent text-sm"
            onClick={() => {
              trackEvent("watts_breakdown_leaderboard_click", {
                wallet_address: walletAddress,
              });
              window.open("/leaderboard", "_blank", "noopener,noreferrer");
            }}
          >
            <HelpCircle className="h-4 w-4" />
            View the impact leaderboard
          </Button>
        </div>
      </DialogContent>

      {/* Sub-dialogs for CTAs */}
      <LaunchpadDialog
        open={isLaunchpadOpen}
        onOpenChange={setIsLaunchpadOpen}
      />
      {isReferralLive ? (
        <ReferralNetworkDialog
          open={isReferralNetworkOpen}
          onOpenChange={setIsReferralNetworkOpen}
          walletAddress={walletAddress || ""}
        />
      ) : null}
    </Dialog>
  );
}

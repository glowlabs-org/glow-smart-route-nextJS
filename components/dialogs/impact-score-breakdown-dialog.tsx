"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Sparkles, ShoppingBag, HelpCircle } from "lucide-react";

import {
  VaultIcon,
  SteeringIcon,
  CashMinerIcon,
  ImpactStreakIcon,
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
import { PointsExplainerDialog } from "@/components/dialogs/points-explainer-dialog";
import { ReferralNetworkDialog } from "@/components/dialogs/referral-network-dialog";
import {
  useV2PointsBalance,
  useV2PointsLedger,
  useV2PointsRates,
} from "@/hooks/v2-points";
import { useReferralLaunch } from "@/hooks/use-referral-launch";
import { trackEvent } from "@/lib/telemetry";

// Kept for call-site compatibility; only `walletAddress`/`open` are used now.
interface ImpactScoreBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string | null;
  weekRange?: unknown;
  title?: string;
  description?: string;
  showCurrentWeekProjection?: boolean;
}

function fmtPts(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

function SourceRow({
  icon: Icon,
  label,
  sublabel,
  points,
  accentClass,
  ctaLabel,
  onCta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  points: number;
  accentClass: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const hasValue = points > 0;
  const isSpend = points < 0;
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
        <div className="text-right">
          <div
            className={cn(
              "font-mono font-semibold text-sm",
              isSpend
                ? "text-muted-foreground"
                : hasValue
                  ? "text-foreground"
                  : "text-muted-foreground/50",
            )}
          >
            {points > 0 ? "+" : ""}
            {fmtPts(points)}
          </div>
          <div className="text-[10px] text-muted-foreground">pts</div>
        </div>
        {ctaLabel && onCta && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[11px] font-medium border-border/40 bg-transparent shrink-0"
            onClick={onCta}
          >
            {ctaLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ImpactScoreBreakdownDialog({
  open,
  onOpenChange,
  walletAddress,
  title,
}: ImpactScoreBreakdownDialogProps) {
  const { address } = useAccount();
  const isOwnWallet =
    address && walletAddress
      ? address.toLowerCase() === walletAddress.toLowerCase()
      : false;
  const { isLive: isReferralLive } = useReferralLaunch();

  const balanceQuery = useV2PointsBalance(open ? walletAddress : null);
  const ledgerQuery = useV2PointsLedger(open ? walletAddress : null, {
    limit: 500,
  });
  const ratesQuery = useV2PointsRates();

  const [isLaunchpadOpen, setIsLaunchpadOpen] = useState(false);
  const [isReferralNetworkOpen, setIsReferralNetworkOpen] = useState(false);
  const [isPointsExplainerOpen, setIsPointsExplainerOpen] = useState(false);

  const agg = useMemo(() => {
    const rows = ledgerQuery.data?.rows ?? [];
    const sumBy = (eventType: string) =>
      rows
        .filter((r) => r.eventType === eventType)
        .reduce((acc, r) => acc + (Number(r.pointsDelta) || 0), 0);
    return {
      glw: sumBy("glw_delegation"),
      sgctl: sumBy("sgctl_delegation"),
      miner: sumBy("miner_purchase"),
      streak: sumBy("weekly_streak"),
      referral: sumBy("referral"),
      spent: sumBy("shop_purchase"), // negative deltas
    };
  }, [ledgerQuery.data]);

  const balance = balanceQuery.data;
  const opening = balance?.openingBalancePoints ?? 0;
  const available = balance?.availablePoints ?? 0;
  const streakWeek = balance?.currentStreak?.streakWeek ?? 0;
  const nextStreak = balance?.currentStreak?.nextAwardPoints ?? 0;

  const rates = ratesQuery.data?.rates;
  const glwRate = rates?.glwDelegationPointsPerUsd ?? 4;
  const sgctlRate = rates?.sgctlDelegationPointsPerUsd ?? 16;
  const minerRate = rates?.minerPurchasePointsPerUsd ?? 8;

  const isLoading = balanceQuery.isLoading || ledgerQuery.isLoading;
  const isError = balanceQuery.isError || ledgerQuery.isError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40">
        <DialogDescription className="sr-only">
          Breakdown of how this wallet earned its spendable points.
        </DialogDescription>

        {/* Hero */}
        <div className="border-b border-border/40 pb-6 pt-8 px-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              {title || "Available Points"}
            </DialogTitle>
            <div className="text-6xl font-mono font-semibold text-foreground tracking-tighter">
              {isLoading ? "—" : fmtPts(available)}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mt-2">
              Spendable in the points shop
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
                Unable to load your points breakdown.
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                    How you earned
                  </h3>
                  <div className="space-y-0">
                    <SourceRow
                      icon={VaultIcon}
                      label="GLW Delegation"
                      sublabel={`${glwRate} pts per $1 delegated`}
                      points={agg.glw}
                      accentClass="bg-[color:var(--delegation-purple)]/10 text-[color:var(--delegation-purple)]"
                      ctaLabel={isOwnWallet ? "Delegate" : undefined}
                      onCta={
                        isOwnWallet ? () => setIsLaunchpadOpen(true) : undefined
                      }
                    />
                    <SourceRow
                      icon={SteeringIcon}
                      label="sGCTL Delegation"
                      sublabel={`${sgctlRate} pts per $1 delegated`}
                      points={agg.sgctl}
                      accentClass="bg-[#22D3EE]/10 text-[#22D3EE]"
                      ctaLabel={isOwnWallet ? "Delegate" : undefined}
                      onCta={
                        isOwnWallet ? () => setIsLaunchpadOpen(true) : undefined
                      }
                    />
                    <SourceRow
                      icon={CashMinerIcon}
                      label="Miner Purchases"
                      sublabel={`${minerRate} pts per $1 purchased`}
                      points={agg.miner}
                      accentClass="bg-[color:var(--color-miner)]/10 text-[color:var(--color-miner-contrast)]"
                      ctaLabel={isOwnWallet ? "Buy" : undefined}
                      onCta={
                        isOwnWallet ? () => setIsLaunchpadOpen(true) : undefined
                      }
                    />
                    <SourceRow
                      icon={ImpactStreakIcon}
                      label="Weekly Streak"
                      sublabel={
                        streakWeek > 0
                          ? `Week ${streakWeek} · next +${fmtPts(nextStreak)}`
                          : "100 pts × week, up to 2,000"
                      }
                      points={agg.streak}
                      accentClass="bg-[#4ADE80]/10 text-[#4ADE80]"
                    />
                    {isReferralLive && (
                      <SourceRow
                        icon={ReferralIcon}
                        label="Referral Network"
                        sublabel="5-20% of your referees' points"
                        points={agg.referral}
                        accentClass="bg-[color:var(--color-glow-orange)]/10 text-[color:var(--color-glow-orange)]"
                        ctaLabel={isOwnWallet ? "Invite" : undefined}
                        onCta={
                          isOwnWallet
                            ? () => setIsReferralNetworkOpen(true)
                            : undefined
                        }
                      />
                    )}
                  </div>
                </div>

                {(opening > 0 || agg.spent < 0) && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                        Adjustments
                      </h3>
                      <div className="space-y-0">
                        {opening > 0 && (
                          <SourceRow
                            icon={Sparkles}
                            label="Opening balance"
                            sublabel="Carried over from V1"
                            points={opening}
                            accentClass="bg-muted/60 text-foreground"
                          />
                        )}
                        {agg.spent < 0 && (
                          <SourceRow
                            icon={ShoppingBag}
                            label="Shop spending"
                            sublabel="Redeemed in the points shop"
                            points={agg.spent}
                            accentClass="bg-muted/60 text-foreground"
                          />
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Separator />
                <div className="rounded-lg bg-muted/30 dark:bg-muted/50 border border-border/30 dark:border-border/40 p-3">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Points are a spendable currency.
                    </span>{" "}
                    You earn them the moment you delegate, buy a miner, keep a
                    weekly streak or refer a friend, then spend them in the
                    points shop. Holding GLW no longer earns points.
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
              trackEvent("points_explainer_open", { from: "impact_breakdown" });
              setIsPointsExplainerOpen(true);
            }}
          >
            <HelpCircle className="h-4 w-4" />
            Learn how points work
          </Button>
        </div>
      </DialogContent>

      {/* Sub-dialogs for CTAs */}
      <LaunchpadDialog
        open={isLaunchpadOpen}
        onOpenChange={setIsLaunchpadOpen}
      />
      <PointsExplainerDialog
        open={isPointsExplainerOpen}
        onOpenChange={setIsPointsExplainerOpen}
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

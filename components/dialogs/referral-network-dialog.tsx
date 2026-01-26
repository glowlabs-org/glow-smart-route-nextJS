"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Copy,
  Share2,
  Users,
  ExternalLink,
  CheckCircle2,
  Clock,
  ChevronRight,
  TrendingUp,
  Award,
  Lock,
  QrCode,
  Trophy,
  Info,
  Check,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatAddress } from "@/lib/utils";
import { hubGet, hubPost } from "@/lib/api/hub-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ReferralIcon,
  ReferralBonusIcon,
  ActivationBonusIcon,
} from "@/components/impact-icons";
import { QRCodeDialog } from "@/components/referral/qr-code-dialog";
import { SparklesIcon } from "@/components/ui/sparkles";
import { SunMediumIcon } from "@/components/ui/sun-medium";
import { SunIcon } from "@/components/ui/sun";
import { SunMoonIcon } from "@/components/ui/sun-moon";
import { useReferralLaunch } from "@/hooks/use-referral-launch";

interface ReferralStatusResponse {
  nonce: string;
  canClaim: boolean;
  claimReason?: string;
  hasReferrer: boolean;
  referrer?: {
    wallet: string;
    ensName?: string;
    linkedAt: string;
    gracePeriodEndsAt: string;
    isInGracePeriod: boolean;
    canChangeReferrer: boolean;
  };
  bonus?: {
    isActive: boolean;
    endsAt: string;
    weeksRemaining: number;
    bonusPercent: number;
  };
}

interface ReferralNetworkResponse {
  walletAddress: string;
  code: string;
  shareableLink: string;
  stats: {
    totalReferees: number;
    activeReferees: number;
    pendingReferees: number;
    activationPendingReferees?: number;
    totalPointsEarnedScaled6: string;
    thisWeekPointsScaled6: string;
    projectedThisWeekPointsScaled6: string;
    lifetimePointsScaled6: string;
    currentTier: {
      name: string;
      percent: number;
      nextTier?: {
        name: string;
        referralsNeeded: number;
        percent: number;
      };
    };
  };
  projectionWeekNumber?: number;
  referees: Array<{
    refereeWallet: string;
    ensName?: string;
    status: "pending" | "active" | "inactive";
    linkedAt: string;
    activatedAt?: string;
    thisWeekPointsScaled6: string;
    lifetimePointsScaled6: string;
    projectedThisWeekPointsScaled6?: string;
    activationPending?: boolean;
    gracePeriodEndsAt: string;
    isInGracePeriod: boolean;
  }>;
}

interface ReferralNetworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string;
  mockData?: ReferralNetworkResponse;
  mockStatus?: ReferralStatusResponse;
}

function formatPoints(val: string) {
  const num = parseFloat(val);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    num
  );
}

const REFERRAL_TIER_LABELS: Record<string, string> = {
  seed: "Aurora",
  grow: "Solaris",
  scale: "Zenith",
  legend: "Eclipse Prime",
};

function formatTierName(name?: string) {
  if (!name) return "";
  const normalized = name.trim().toLowerCase();
  return REFERRAL_TIER_LABELS[normalized] ?? name;
}

export function ReferralNetworkDialog({
  open,
  onOpenChange,
  walletAddress,
  mockData,
  mockStatus,
}: ReferralNetworkDialogProps) {
  const [isLeaderboardOpen, setIsLeaderboardOpen] = React.useState(false);
  const [isQRCodeOpen, setIsQRCodeOpen] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);
  const { isLive: isReferralLive } = useReferralLaunch();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["referral-network", walletAddress],
    queryFn: () =>
      hubGet<ReferralNetworkResponse>("/referral/network", {
        params: { walletAddress },
      }),
    enabled: isReferralLive && open && !!walletAddress && !mockData,
  });

  const { data: statusData } = useQuery({
    queryKey: ["referral-status", walletAddress],
    queryFn: () =>
      hubGet<ReferralStatusResponse>("/referral/status", {
        params: { walletAddress },
      }),
    enabled: isReferralLive && open && !!walletAddress && !mockStatus,
  });

  if (!isReferralLive) {
    return null;
  }
  const resolvedData = mockData ?? data;
  const resolvedStatus = mockStatus ?? statusData;
  const resolvedIsLoading = mockData ? false : isLoading;
  const resolvedIsError = mockData ? false : isError;
  const activationPendingCount = React.useMemo(() => {
    if (!resolvedData) return 0;
    if (resolvedData.stats.activationPendingReferees != null) {
      return resolvedData.stats.activationPendingReferees;
    }
    return resolvedData.referees.filter((r) => r.activationPending).length;
  }, [resolvedData]);

  const copyLink = React.useCallback(() => {
    if (!resolvedData?.shareableLink) return;
    navigator.clipboard.writeText(resolvedData.shareableLink);
    setIsCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setIsCopied(false), 2000);
  }, [resolvedData?.shareableLink]);

  const shareLink = React.useCallback(async () => {
    if (!resolvedData?.shareableLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Glow",
          text: "Help build the future of solar energy and earn Impact Points.",
          url: resolvedData.shareableLink,
        });
      } catch (e) {
        // user cancelled or failed
      }
    } else {
      copyLink();
    }
  }, [resolvedData?.shareableLink, copyLink]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40">
        {/* HERO HEADER - Following Impact Breakdown Style */}
        <div className="relative overflow-hidden border-b border-border/40 pb-6 pt-8 px-6">

          <div className="relative z-10 flex flex-col items-center text-center space-y-2">
            <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              Referral Rewards
            </DialogTitle>

            <div className="flex flex-col items-center">
              <div className="text-6xl font-mono font-bold text-[#16a34a] dark:text-[#4ade80] tracking-tighter">
                {resolvedIsLoading ? (
                  <Skeleton className="h-14 w-32 mx-auto" />
                ) : (
                  `+${formatPoints(
                    resolvedData?.stats.lifetimePointsScaled6 || "0"
                  )}`
                )}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mt-2">
                Lifetime Points Earned
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[70vh]">
          {resolvedIsLoading ? (
            <div className="p-6 space-y-6">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          ) : resolvedIsError || !resolvedData ? (
            <div className="p-12 text-center text-muted-foreground">
              Failed to load referral network.
            </div>
          ) : (
            <div className="p-6 space-y-8">
              {/* SECTION: YOUR LINK */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                    Your Referral Link
                  </h3>
                </div>
                <div className="relative flex items-center gap-2 p-1.5 pl-4 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <div className="flex-1 font-mono text-xs truncate text-muted-foreground select-all">
                    {resolvedData.shareableLink}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        isCopied && "bg-primary/10 text-primary"
                      )}
                      onClick={copyLink}
                      title="Copy Link"
                      aria-label="Copy referral link"
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setIsQRCodeOpen(true)}
                      title="Show QR Code"
                      aria-label="Show referral QR code"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={shareLink}
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        You Earn
                      </div>
                      <div className="text-xl font-mono font-bold text-foreground">
                        Up to 20%
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        of friends' base points
                      </div>
                    </div>
                    <div className="space-y-1 border-l pl-4">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        They Get
                      </div>
                      <div className="text-xl font-mono font-bold text-foreground">
                        +10% Bonus
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        for 12 weeks
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: YOUR REFERRER (if user is a referee) */}
              {resolvedStatus?.hasReferrer && resolvedStatus.referrer && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                      Your Referrer
                    </h3>
                    {resolvedStatus.referrer.canChangeReferrer && (
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] bg-background border-yellow-500/30 text-yellow-600 dark:text-yellow-400"
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        Grace Period
                      </Badge>
                    )}
                  </div>
                  <div className="relative overflow-hidden rounded-2xl border bg-card p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">
                            {resolvedStatus.referrer.ensName ||
                              formatAddress(resolvedStatus.referrer.wallet)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Linked{" "}
                            {new Date(
                              resolvedStatus.referrer.linkedAt
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                      {resolvedStatus.bonus?.isActive && (
                        <div className="text-right">
                          <div className="text-lg font-mono font-bold text-[#16a34a] dark:text-[#4ade80]">
                            +{resolvedStatus.bonus.bonusPercent}%
                          </div>
                          <div className="text-[9px] text-muted-foreground uppercase font-medium">
                            {resolvedStatus.bonus.weeksRemaining} weeks left
                          </div>
                        </div>
                      )}
                    </div>

                    {resolvedStatus.referrer.canChangeReferrer && (
                      <div className="pt-3 border-t border-dashed space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            Grace period ends
                          </span>
                          <span className="font-mono font-bold text-foreground">
                            {new Date(
                              resolvedStatus.referrer.gracePeriodEndsAt
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          You can change your referrer while the referral is
                          pending. After activation or grace end, the link is
                          permanent.
                        </p>
                      </div>
                    )}

                    {!resolvedStatus.referrer.canChangeReferrer && (
                      <div className="pt-3 border-t border-dashed">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Lock className="w-3 h-3" />
                          <span>
                            Referrer link is now permanent
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION: STATS CARDS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="group relative overflow-hidden rounded-2xl border bg-card p-4 space-y-1 transition-all hover:bg-muted/30">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform">
                    <Clock className="w-12 h-12" />
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    This Week (Projected)
                  </div>
                  <div className="text-3xl font-mono font-bold text-[#16a34a] dark:text-[#4ade80]">
                    +{formatPoints(
                      resolvedData.stats.thisWeekPointsScaled6 || "0"
                    )}
                  </div>
                  <div className="text-[9px] text-muted-foreground uppercase font-medium">
                    Finalizes Sunday
                  </div>
                </div>
                <div className="group relative overflow-hidden rounded-2xl border bg-card p-4 space-y-1 transition-all hover:bg-muted/30">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform">
                    <Users className="w-12 h-12" />
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Network Size
                  </div>
                  <div className="text-3xl font-mono font-bold text-foreground">
                    {resolvedData.stats.activeReferees}
                  </div>
                  <div className="text-[9px] text-muted-foreground uppercase font-medium">
                    Active referring wallets
                  </div>
                </div>
              </div>

              {/* SECTION: YOUR TIER */}
              {(() => {
                const projectedTotal =
                  resolvedData.stats.activeReferees + activationPendingCount;

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                        Progress & Tiers
                      </h3>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] bg-background border-primary/20 text-primary"
                      >
                        LEVEL{" "}
                        {resolvedData.stats.activeReferees >= 7
                          ? 4
                          : resolvedData.stats.activeReferees >= 4
                          ? 3
                          : resolvedData.stats.activeReferees >= 2
                          ? 2
                          : 1}
                      </Badge>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border bg-card p-6 space-y-6">
                      {/* Progress Line */}
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-2xl font-bold tracking-tight text-foreground">
                            {formatTierName(resolvedData.stats.currentTier.name)} Tier
                          </span>
                          <span className="text-sm font-mono text-muted-foreground font-bold">
                            {resolvedData.stats.currentTier.percent}% REWARD SHARE
                          </span>
                        </div>
                        {resolvedData.stats.currentTier.nextTier && (
                          <div className="text-right p-2 rounded-xl bg-muted/30 border border-dashed">
                            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                              Up Next
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                              {formatTierName(
                                resolvedData.stats.currentTier.nextTier.name
                              )}{" "}
                              ({resolvedData.stats.currentTier.nextTier.percent}%)
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden border">
                          {/* Active progress (solid) */}
                          <div
                            className="absolute inset-y-0 left-0 bg-[#16a34a] dark:bg-[#4ade80] transition-all duration-1000"
                            style={{
                              width: `${Math.min(
                                100,
                                (resolvedData.stats.activeReferees / 7) * 100
                              )}%`,
                            }}
                          />
                          {/* Pending progress (striped) */}
                          {activationPendingCount > 0 && (
                            <div
                              className="absolute inset-y-0 bg-[#16a34a]/30 dark:bg-[#4ade80]/30 transition-all duration-1000"
                              style={{
                                left: `${Math.min(
                                  100,
                                  (resolvedData.stats.activeReferees / 7) * 100
                                )}%`,
                                width: `${Math.min(
                                  100 -
                                    (resolvedData.stats.activeReferees / 7) * 100,
                                  (activationPendingCount / 7) * 100
                                )}%`,
                              }}
                            />
                          )}
                        </div>

                        <div className="flex justify-between text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                          {[
                            {
                              name: "Aurora",
                              count: 1,
                              active: resolvedData.stats.activeReferees >= 1,
                              pending:
                                resolvedData.stats.activeReferees < 1 &&
                                projectedTotal >= 1,
                            },
                            {
                              name: "Solaris",
                              count: 2,
                              active: resolvedData.stats.activeReferees >= 2,
                              pending:
                                resolvedData.stats.activeReferees < 2 &&
                                projectedTotal >= 2,
                            },
                            {
                              name: "Zenith",
                              count: 4,
                              active: resolvedData.stats.activeReferees >= 4,
                              pending:
                                resolvedData.stats.activeReferees < 4 &&
                                projectedTotal >= 4,
                            },
                            {
                              name: "Eclipse Prime",
                              count: 7,
                              active: resolvedData.stats.activeReferees >= 7,
                              pending:
                                resolvedData.stats.activeReferees < 7 &&
                                projectedTotal >= 7,
                            },
                          ].map((t) => (
                            <div
                              key={t.name}
                              className="flex flex-col items-center gap-1.5"
                            >
                              <div
                                className={cn(
                                  "w-2 h-2 rounded-full border-2 transition-colors",
                                  t.active
                                    ? "bg-[#16a34a] dark:bg-[#4ade80] border-[#16a34a] dark:border-[#4ade80]"
                                    : t.pending
                                    ? "bg-[#16a34a]/30 dark:bg-[#4ade80]/30 border-[#16a34a]/50 dark:border-[#4ade80]/50"
                                    : "bg-muted-foreground/20 border-transparent"
                                )}
                              />
                              <span
                                className={cn(
                                  t.active && "text-foreground font-bold",
                                  t.pending && "text-foreground/60"
                                )}
                              >
                                {t.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Activating notice */}
                      {activationPendingCount > 0 && (
                        <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-dashed">
                          <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-[11px] text-muted-foreground">
                            <span className="font-bold text-foreground">
                              {activationPendingCount} referral
                              {activationPendingCount > 1 ? "s" : ""}
                            </span>{" "}
                            activating Sunday
                          </p>
                        </div>
                      )}

                      {resolvedData.stats.currentTier.nextTier && (
                        <div className="flex items-center justify-center gap-2 pt-4 border-t border-dashed">
                          <div className="flex -space-x-1.5">
                            {[...Array(3)].map((_, i) => (
                              <div
                                key={i}
                                className="w-5 h-5 rounded-full border-2 border-background bg-muted flex items-center justify-center"
                              >
                                <Users className="w-2.5 h-2.5 text-muted-foreground" />
                              </div>
                            ))}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Invite{" "}
                            <span className="font-bold text-foreground">
                              {
                                resolvedData.stats.currentTier.nextTier
                                  .referralsNeeded
                              }{" "}
                              more
                            </span>{" "}
                            active friends to level up
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* SECTION: MILESTONES */}
              {(() => {
                const projectedTotal =
                  resolvedData.stats.activeReferees + activationPendingCount;

                return (
                  <div className="space-y-3">
                    <h3 className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest px-1">
                      Badges Earned
                    </h3>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        {
                          name: "Aurora",
                          Icon: SparklesIcon,
                          count: 1,
                          active: resolvedData.stats.activeReferees >= 1,
                          pending:
                            resolvedData.stats.activeReferees < 1 &&
                            projectedTotal >= 1,
                        },
                        {
                          name: "Solaris",
                          Icon: SunMediumIcon,
                          count: 2,
                          active: resolvedData.stats.activeReferees >= 2,
                          pending:
                            resolvedData.stats.activeReferees < 2 &&
                            projectedTotal >= 2,
                        },
                        {
                          name: "Zenith",
                          Icon: SunIcon,
                          count: 4,
                          active: resolvedData.stats.activeReferees >= 4,
                          pending:
                            resolvedData.stats.activeReferees < 4 &&
                            projectedTotal >= 4,
                        },
                        {
                          name: "Eclipse Prime",
                          Icon: SunMoonIcon,
                          count: 7,
                          active: resolvedData.stats.activeReferees >= 7,
                          pending:
                            resolvedData.stats.activeReferees < 7 &&
                            projectedTotal >= 7,
                        },
                      ].map((m) => (
                        <div
                          key={m.name}
                          className={cn(
                            "relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all overflow-hidden",
                            m.active
                              ? "bg-[#16a34a]/5 dark:bg-[#4ade80]/5 border-[#16a34a]/20 dark:border-[#4ade80]/20"
                              : m.pending
                              ? "bg-[#16a34a]/5 dark:bg-[#4ade80]/5 border-[#16a34a]/10 dark:border-[#4ade80]/10 opacity-60"
                              : "bg-muted/5 border-border grayscale opacity-50"
                          )}
                        >
                          <div className="text-3xl mb-2">
                            {m.active ? (
                              <m.Icon className="text-foreground" size={28} />
                            ) : m.pending ? (
                              <m.Icon
                                className="text-foreground/60"
                                size={28}
                              />
                            ) : (
                              <Lock className="w-6 h-6 text-muted-foreground/30" />
                            )}
                          </div>
                          <div
                            className={cn(
                              "text-[10px] font-bold",
                              m.active || m.pending
                                ? "text-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {m.name}
                          </div>
                          <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                            {m.pending ? "SUNDAY" : `${m.count} ACTIVE`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* SECTION: YOUR NETWORK */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                    Your Network
                  </h3>
                  <div className="text-[10px] font-medium text-muted-foreground">
                    {resolvedData.referees.length} Total
                  </div>
                </div>
                {resolvedData.referees.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center bg-muted/10">
                    <div className="inline-flex p-4 rounded-2xl bg-muted/50 mb-4">
                      <Users className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      Your network is empty
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto leading-relaxed">
                      Share your link to start earning tiered impact points.
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={copyLink}
                        disabled={!resolvedData.shareableLink}
                      >
                        Copy Referral Link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsQRCodeOpen(true)}
                        disabled={!resolvedData.shareableLink}
                      >
                        Show QR Code
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border overflow-hidden bg-card">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider">
                            Referral
                          </TableHead>
                          <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider">
                            Status
                          </TableHead>
                          <TableHead className="h-10 text-right text-[10px] font-bold uppercase tracking-wider">
                            Earnings
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resolvedData.referees.map((ref) => (
                          <TableRow
                            key={ref.refereeWallet}
                            className="group hover:bg-muted/10 border-b last:border-0"
                          >
                            <TableCell className="py-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-bold text-foreground">
                                  {ref.ensName ||
                                    formatAddress(ref.refereeWallet)}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {new Date(ref.linkedAt).toLocaleDateString(
                                    undefined,
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    }
                                  )}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex flex-col gap-1">
                                {ref.activationPending ? (
                                  <Badge
                                    variant="secondary"
                                    className="bg-muted/50 text-foreground border-border hover:bg-muted/50 gap-1 rounded-lg h-6 font-bold"
                                  >
                                    <Sparkles className="w-3 h-3" /> Activating
                                  </Badge>
                                ) : ref.status === "active" ? (
                                  <Badge
                                    variant="secondary"
                                    className="bg-[#16a34a]/10 text-[#16a34a] dark:bg-[#4ade80]/10 dark:text-[#4ade80] border-[#16a34a]/20 dark:border-[#4ade80]/20 hover:bg-[#16a34a]/10 dark:hover:bg-[#4ade80]/10 gap-1 rounded-lg h-6 font-bold"
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> Active
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="bg-muted/5 text-muted-foreground border-border hover:bg-muted/5 gap-1 rounded-lg h-6 font-bold"
                                  >
                                    <Clock className="w-3 h-3" /> Pending
                                  </Badge>
                                )}
                                {ref.activationPending && (
                                  <span className="text-[9px] uppercase font-semibold text-muted-foreground">
                                    Activates Sunday
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-4 text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-sm font-mono font-bold text-[#16a34a] dark:text-[#4ade80]">
                                  +{formatPoints(ref.lifetimePointsScaled6)}
                                </span>
                                {parseFloat(ref.thisWeekPointsScaled6) > 0 && (
                                  <span className="text-[9px] uppercase font-bold text-muted-foreground">
                                    +{formatPoints(ref.thisWeekPointsScaled6)}
                                    /wk projected
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* FOOTER TIPS */}
              <div className="rounded-xl bg-muted/30 dark:bg-muted/50 p-5 border border-border/20 dark:border-border/40 space-y-4">
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-[#22D3EE]" />
                  <h4 className="text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                    Quick Guide
                  </h4>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-xs text-muted-foreground">
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-[#22D3EE] shrink-0" />
                    <p className="leading-relaxed">
                      Referrals become{" "}
                      <span className="text-foreground font-bold">Active</span>{" "}
                      once they earn{" "}
                      <span className="text-primary font-bold">
                        100 post-link base points
                      </span>
                      . Activation finalizes at week end.
                    </p>
                  </li>
                  <li className="flex items-start gap-3 text-xs text-muted-foreground">
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-[#22D3EE] shrink-0" />
                    <p className="leading-relaxed">
                      Your earnings are based on their{" "}
                      <span className="text-foreground font-bold">
                        Base Points
                      </span>{" "}
                      (the points they earn before any multipliers apply).
                    </p>
                  </li>
                  <li className="flex items-start gap-3 text-xs text-muted-foreground">
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-[#22D3EE] shrink-0" />
                    <p className="leading-relaxed">
                      Rewards are calculated and finalized every{" "}
                      <span className="text-foreground font-bold text-xs uppercase font-mono">
                        Sunday 00:00 UTC
                      </span>
                      .
                    </p>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* QR Code Dialog */}
        {resolvedData?.shareableLink && (
          <QRCodeDialog
            open={isQRCodeOpen}
            onOpenChange={setIsQRCodeOpen}
            url={resolvedData.shareableLink}
            title="Scan to Join Glow"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

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
  MessageCircle,
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { trackEvent } from "@/lib/telemetry";
import { useLang } from "@/lib/i18n";

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
    bonusProjectedPointsScaled6?: string;
  };
  activationBonus?: {
    awarded: boolean;
    awardedAt?: string;
    pointsAwarded: number;
    celebrationSeen: boolean;
    celebrationSeenAt?: string;
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

function formatPoints(
  val: string,
  opts: { maximumFractionDigits?: number } = {},
) {
  const num = parseFloat(val);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: opts.maximumFractionDigits ?? 0,
  }).format(num);
}

const REFERRAL_TIER_LABELS: Record<string, string> = {
  seed: "Aurora",
  grow: "Solaris",
  scale: "Zenith",
  legend: "Eclipse Prime",
};
const REFERRAL_NETWORK_FETCH_LIMIT = 200;

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
  const { t } = useLang();
  const s = t.bigDialogs.referralNetwork;
  const [isLeaderboardOpen, setIsLeaderboardOpen] = React.useState(false);
  const [isQRCodeOpen, setIsQRCodeOpen] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);
  const { isLive: isReferralLive } = useReferralLaunch();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["referral-network", walletAddress],
    queryFn: () =>
      hubGet<ReferralNetworkResponse>("/referral/network", {
        params: { walletAddress, limit: REFERRAL_NETWORK_FETCH_LIMIT },
      }),
    enabled: isReferralLive && open && !!walletAddress && !mockData,
  });

  const { data: statusData } = useQuery({
    queryKey: ["referral-status", walletAddress, "projection"],
    queryFn: () =>
      hubGet<ReferralStatusResponse>("/referral/status", {
        params: { walletAddress, includeProjection: "1" },
      }),
    enabled: isReferralLive && open && !!walletAddress && !mockStatus,
  });

  const resolvedData = mockData ?? data;
  const resolvedStatus = mockStatus ?? statusData;
  const resolvedIsLoading = mockData ? false : isLoading;
  const resolvedIsError = mockData ? false : isError;

  const nextFinalizationLabel = React.useMemo(() => {
    const now = new Date();
    const daysUntil = (7 - now.getUTCDay()) % 7 || 7;
    const next = new Date(now);
    next.setUTCDate(next.getUTCDate() + daysUntil);
    return s.finalizesOn(
      next.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    );
  }, [s]);

  const activationPendingCount = React.useMemo(() => {
    if (!resolvedData) return 0;
    if (resolvedData.stats.activationPendingReferees != null) {
      return resolvedData.stats.activationPendingReferees;
    }
    return resolvedData.referees.filter((r) => r.activationPending).length;
  }, [resolvedData]);

  const isTierLocked = React.useMemo(() => {
    if (!resolvedData) return false;
    return (
      resolvedData.stats.activeReferees > 0 &&
      resolvedData.stats.currentTier.percent === 0
    );
  }, [resolvedData]);

  const activeRefereesForList = React.useMemo(() => {
    if (!resolvedData) return [];
    return resolvedData.referees.filter(
      (ref) => ref.status === "active" || ref.activationPending,
    );
  }, [resolvedData]);

  const totalNetworkCount = React.useMemo(() => {
    if (!resolvedData) return 0;
    return (
      (resolvedData.stats.activeReferees ?? 0) +
      (resolvedData.stats.pendingReferees ?? 0)
    );
  }, [resolvedData]);

  const hiddenPendingCount = React.useMemo(() => {
    if (!resolvedData) return 0;
    if (typeof resolvedData.stats.pendingReferees === "number") {
      return resolvedData.stats.pendingReferees;
    }
    return resolvedData.referees.filter(
      (ref) => ref.status === "pending" || ref.activationPending,
    ).length;
  }, [resolvedData]);

  // Track dialog open
  const hasTrackedOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (open && !hasTrackedOpenRef.current && !mockData) {
      trackEvent("referral_network_dialog_open", {
        wallet_address: walletAddress ?? null,
      });
      hasTrackedOpenRef.current = true;
    }
    if (!open) {
      hasTrackedOpenRef.current = false;
    }
  }, [open, walletAddress, mockData]);

  const copyLink = React.useCallback(() => {
    if (!resolvedData?.shareableLink) return;
    navigator.clipboard.writeText(resolvedData.shareableLink);
    setIsCopied(true);
    toast.success(s.toastLinkCopied);
    trackEvent("referral_copy_link_click", {
      wallet_address: walletAddress ?? null,
    });
    setTimeout(() => setIsCopied(false), 2000);
  }, [resolvedData?.shareableLink, walletAddress]);

  const openQRCode = React.useCallback(() => {
    trackEvent("referral_qr_code_open", {
      wallet_address: walletAddress ?? null,
    });
    setIsQRCodeOpen(true);
  }, [walletAddress]);

  const shareLink = React.useCallback(async () => {
    if (!resolvedData?.shareableLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: s.joinMeOnGlow,
          text: s.helpBuildFuture,
          url: resolvedData.shareableLink,
        });
        trackEvent("referral_share_native", {
          wallet_address: walletAddress ?? null,
        });
      } catch (e) {
        // user cancelled or failed
      }
    } else {
      copyLink();
    }
  }, [resolvedData?.shareableLink, copyLink, walletAddress]);

  const shareToTwitter = React.useCallback(() => {
    if (!resolvedData?.shareableLink) return;
    const text = encodeURIComponent(
      `Join me on @GlowFND and we both earn bonus Impact Points! You'll get +100 pts + a 10% boost for 12 weeks.\n\n${resolvedData.shareableLink}`,
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
    trackEvent("referral_share_twitter", {
      wallet_address: walletAddress ?? null,
    });
  }, [resolvedData?.shareableLink, walletAddress]);

  const shareToDiscord = React.useCallback(() => {
    if (!resolvedData?.shareableLink) return;
    // Discord doesn't have a direct share URL, so we copy a formatted message
    const message = `Join me on Glow! You'll get +100 pts bonus + 10% boost for 12 weeks: ${resolvedData.shareableLink}`;
    navigator.clipboard.writeText(message);
    toast.success(s.toastDiscordCopied);
    trackEvent("referral_share_discord", {
      wallet_address: walletAddress ?? null,
    });
  }, [resolvedData?.shareableLink, walletAddress]);

  if (!isReferralLive) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/20 dark:border-border/40">
        {/* HERO HEADER */}
        <div className="relative overflow-hidden border-b border-border/20 dark:border-border/40 pb-5 pt-6 px-4 sm:pb-6 sm:pt-8 sm:px-6">
          <div className="relative z-10 flex flex-col items-center text-center space-y-2">
            <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
              {s.shareReferralCode}
            </DialogTitle>

            <div className="flex flex-col items-center">
              <div className="text-4xl sm:text-6xl font-mono font-semibold text-[#16a34a] dark:text-[#4ade80] tracking-tighter">
                {resolvedIsLoading ? (
                  <Skeleton className="h-10 sm:h-14 w-24 sm:w-32 mx-auto" />
                ) : (
                  `+${formatPoints(
                    resolvedData?.stats.lifetimePointsScaled6 || "0",
                  )}`
                )}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-wide mt-2">
                {s.lifetimePointsEarned}
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
              {s.failedToLoad}
            </div>
          ) : (
            <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
              {/* SECTION: YOUR LINK */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                    {s.yourCode}
                  </h3>
                </div>
                <div className="relative flex flex-col sm:flex-row sm:items-center gap-2 p-2 sm:p-1.5 sm:pl-4 rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <div className="flex-1 font-mono text-xs truncate text-muted-foreground select-all px-2 sm:px-0 py-1 sm:py-0">
                    {resolvedData.shareableLink}
                  </div>
                  <div className="flex gap-1 justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "shrink-0",
                        isCopied && "bg-primary/10 text-primary",
                      )}
                      onClick={copyLink}
                      title={s.copyLink}
                      aria-label={s.copyLink}
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
                      className="shrink-0"
                      onClick={shareToTwitter}
                      title={s.shareOnX}
                      aria-label={s.shareOnXTwitter}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={shareToDiscord}
                      title={s.copyForDiscord}
                      aria-label={s.discordMessage}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={openQRCode}
                      title={s.showQrCode}
                      aria-label={s.showReferralQrCode}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 shrink-0"
                      onClick={shareLink}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">{s.share}</span>
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {s.youEarn}
                      </div>
                      <div className="text-xl font-mono font-bold text-foreground">
                        {s.upTo20Pct}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {s.ofFriendsBasePoints}
                      </div>
                    </div>
                    <div className="space-y-1 border-l pl-4">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {s.theyGet}
                      </div>
                      <div className="text-xl font-mono font-bold text-foreground">
                        {s.bonus10Pct}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {s.forTwelveWeeks}
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
                      {s.yourReferrer}
                    </h3>
                    {resolvedStatus.referrer.canChangeReferrer && (
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] bg-background border-yellow-500/30 text-yellow-600 dark:text-yellow-400"
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        {s.gracePeriod}
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
                            {s.linkedOn(
                              new Date(
                                resolvedStatus.referrer.linkedAt,
                              ).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }),
                            )}
                          </span>
                        </div>
                      </div>
                    {resolvedStatus.bonus?.isActive && (
                      <div className="text-right">
                        <div className="text-lg font-mono font-bold text-[#16a34a] dark:text-[#4ade80]">
                          +{resolvedStatus.bonus.bonusPercent}%
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase font-medium">
                          {s.weeksLeft(resolvedStatus.bonus.weeksRemaining)}
                        </div>
                        {resolvedStatus.bonus.bonusProjectedPointsScaled6 &&
                          Number(resolvedStatus.bonus.bonusProjectedPointsScaled6) >
                            0 && (
                            <div className="text-[9px] text-muted-foreground mt-1">
                              {s.ptsProjected(
                                formatPoints(
                                  resolvedStatus.bonus.bonusProjectedPointsScaled6,
                                  { maximumFractionDigits: 2 },
                                ),
                              )}
                            </div>
                          )}
                      </div>
                    )}
                    </div>

                    {/* Activation Bonus */}
                    {resolvedStatus.activationBonus && (
                      <div className={cn(
                        "pt-3 border-t border-dashed",
                        resolvedStatus.activationBonus.awarded && "mt-1"
                      )}>
                        <div className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5",
                          resolvedStatus.activationBonus.awarded
                            ? "bg-[color:var(--color-glow-orange)]/10"
                            : "bg-muted/30"
                        )}>
                          <div className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
                            resolvedStatus.activationBonus.awarded
                              ? "bg-[color:var(--color-glow-orange)]/15"
                              : "bg-muted/50"
                          )}>
                            {resolvedStatus.activationBonus.awarded ? (
                              <CheckCircle2 className="w-4 h-4 text-[color:var(--color-glow-orange)]" />
                            ) : (
                              <Sparkles className="w-4 h-4 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-xs font-semibold",
                                resolvedStatus.activationBonus.awarded
                                  ? "text-[color:var(--color-glow-orange)]"
                                  : "text-muted-foreground"
                              )}>
                                {s.activationBonus}
                              </span>
                              <span className={cn(
                                "text-xs font-mono font-bold",
                                resolvedStatus.activationBonus.awarded
                                  ? "text-[color:var(--color-glow-orange)]"
                                  : "text-muted-foreground/50"
                              )}>
                                +100 pts
                              </span>
                            </div>
                            <p className={cn(
                              "text-[9px] mt-0.5",
                              resolvedStatus.activationBonus.awarded
                                ? "text-[color:var(--color-glow-orange)]/70"
                                : "text-muted-foreground/50"
                            )}>
                              {resolvedStatus.activationBonus.awarded
                                ? s.activationAwarded(
                                    new Date(
                                      resolvedStatus.activationBonus.awardedAt!,
                                    ).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                    }),
                                  )
                                : s.activationLockHint}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {resolvedStatus.referrer.canChangeReferrer && (
                      <div className="pt-3 border-t border-dashed space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {s.gracePeriodEnds}
                          </span>
                          <span className="font-mono font-bold text-foreground">
                            {new Date(
                              resolvedStatus.referrer.gracePeriodEndsAt,
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          {s.gracePeriodNote}
                        </p>
                      </div>
                    )}

                    {!resolvedStatus.referrer.canChangeReferrer && (
                      <div className="pt-3 border-t border-dashed">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Lock className="w-3 h-3" />
                          <span>{s.referrerLinkPermanent}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION: STATS CARDS */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="group relative overflow-hidden rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3 sm:p-4 space-y-1 transition-all hover:bg-muted/40 dark:hover:bg-muted/60">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform hidden sm:block">
                    <Clock className="w-12 h-12" />
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                    {s.thisWeek}
                  </div>
                  <div className="text-2xl sm:text-3xl font-mono font-semibold text-[#16a34a] dark:text-[#4ade80]">
                    +
                    {formatPoints(
                      resolvedData.stats.thisWeekPointsScaled6 || "0",
                    )}
                  </div>
                  <div className="text-[8px] sm:text-[9px] text-muted-foreground/60 dark:text-muted-foreground/80 uppercase font-medium">
                    {nextFinalizationLabel}
                  </div>
                </div>
                <div className="group relative overflow-hidden rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-3 sm:p-4 space-y-1 transition-all hover:bg-muted/40 dark:hover:bg-muted/60">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform hidden sm:block">
                    <Users className="w-12 h-12" />
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                    {s.networkSize}
                  </div>
                  <div className="text-2xl sm:text-3xl font-mono font-semibold text-foreground">
                    {resolvedData.stats.totalReferees ?? resolvedData.referees.length}
                  </div>
                  <div className="text-[8px] sm:text-[9px] text-muted-foreground/60 dark:text-muted-foreground/80 uppercase font-medium">
                    {resolvedData.stats.activeReferees > 0 ? (
                      <span>
                        <span className="text-[#16a34a] dark:text-[#4ade80]">
                          {s.activeCount(resolvedData.stats.activeReferees)}
                        </span>
                        {resolvedData.stats.pendingReferees > 0 && (
                          <span>
                            {" "}
                            ·{" "}
                            {s.pendingCount(
                              resolvedData.stats.pendingReferees,
                            )}
                          </span>
                        )}
                      </span>
                    ) : resolvedData.stats.pendingReferees > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        {s.pendingActivation(
                          resolvedData.stats.pendingReferees,
                        )}
                      </span>
                    ) : (
                      <span>{s.totalReferrals}</span>
                    )}
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
                        {s.progressTiers}
                      </h3>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] bg-background border-primary/20 text-primary"
                      >
                        {isTierLocked ? (
                          <span className="inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {s.locked}
                          </span>
                        ) : (
                          s.levelN(
                            resolvedData.stats.activeReferees >= 7
                              ? 4
                              : resolvedData.stats.activeReferees >= 4
                                ? 3
                                : resolvedData.stats.activeReferees >= 2
                                  ? 2
                                  : 1,
                          )
                        )}
                      </Badge>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-4 sm:p-6 space-y-4 sm:space-y-6">
                      {/* Progress Line */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                            {s.tierName(
                              formatTierName(
                                resolvedData.stats.currentTier.name,
                              ),
                            )}
                          </span>
                          <div className="flex items-center gap-2 text-xs sm:text-sm font-mono">
                            <span className="text-muted-foreground/60 dark:text-muted-foreground/80 font-semibold">
                              {resolvedData.stats.currentTier.percent}%{" "}
                              {s.rewardShare}
                            </span>
                            {isTierLocked && (
                              <span className="text-amber-600 dark:text-amber-400 text-[10px]">
                                {s.earnBaseToUnlock}
                              </span>
                            )}
                            {resolvedData.stats.activeReferees === 0 &&
                              resolvedData.stats.pendingReferees > 0 && (
                                <span className="text-amber-600 dark:text-amber-400 text-[10px]">
                                  {s.pendingParen(
                                    resolvedData.stats.pendingReferees,
                                  )}
                                </span>
                              )}
                          </div>
                        </div>
                        {resolvedData.stats.currentTier.nextTier && (
                          <div className="text-left sm:text-right p-2 rounded-xl bg-muted/50 dark:bg-muted/60 border border-dashed border-border/20 dark:border-border/40">
                            <div className="text-[9px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-wider mb-0.5">
                              {s.upNext}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                              {formatTierName(
                                resolvedData.stats.currentTier.nextTier.name,
                              )}{" "}
                              ({resolvedData.stats.currentTier.nextTier.percent}%)
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 sm:space-y-4">
                        <div className="relative h-2 sm:h-3 w-full bg-muted/50 dark:bg-muted/60 rounded-full overflow-hidden border border-border/20 dark:border-border/40">
                          {/* Active progress (solid) */}
                          <div
                            className="absolute inset-y-0 left-0 bg-[#16a34a] dark:bg-[#4ade80] transition-all duration-1000"
                            style={{
                              width: `${Math.min(
                                100,
                                (resolvedData.stats.activeReferees / 7) * 100,
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
                                  (resolvedData.stats.activeReferees / 7) * 100,
                                )}%`,
                                width: `${Math.min(
                                  100 -
                                    (resolvedData.stats.activeReferees / 7) *
                                      100,
                                  (activationPendingCount / 7) * 100,
                                )}%`,
                              }}
                            />
                          )}
                        </div>

                        <div className="flex justify-between text-[8px] sm:text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-tighter">
                          {[
                            {
                              name: "Aurora",
                              shortName: "1",
                              count: 1,
                              active: resolvedData.stats.activeReferees >= 1,
                              pending:
                                resolvedData.stats.activeReferees < 1 &&
                                projectedTotal >= 1,
                            },
                            {
                              name: "Solaris",
                              shortName: "2",
                              count: 2,
                              active: resolvedData.stats.activeReferees >= 2,
                              pending:
                                resolvedData.stats.activeReferees < 2 &&
                                projectedTotal >= 2,
                            },
                            {
                              name: "Zenith",
                              shortName: "4",
                              count: 4,
                              active: resolvedData.stats.activeReferees >= 4,
                              pending:
                                resolvedData.stats.activeReferees < 4 &&
                                projectedTotal >= 4,
                            },
                            {
                              name: "Eclipse",
                              shortName: "7",
                              count: 7,
                              active: resolvedData.stats.activeReferees >= 7,
                              pending:
                                resolvedData.stats.activeReferees < 7 &&
                                projectedTotal >= 7,
                            },
                          ].map((t) => (
                            <div
                              key={t.name}
                              className="flex flex-col items-center gap-1 sm:gap-1.5"
                            >
                              <div
                                className={cn(
                                  "w-2 h-2 rounded-full border-2 transition-colors",
                                  t.active
                                    ? "bg-[#16a34a] dark:bg-[#4ade80] border-[#16a34a] dark:border-[#4ade80]"
                                    : t.pending
                                      ? "bg-[#16a34a]/30 dark:bg-[#4ade80]/30 border-[#16a34a]/50 dark:border-[#4ade80]/50"
                                      : "bg-muted-foreground/20 border-transparent",
                                )}
                              />
                              <span
                                className={cn(
                                  "hidden sm:inline",
                                  t.active && "text-foreground font-semibold",
                                  t.pending && "text-foreground/60",
                                )}
                              >
                                {t.name}
                              </span>
                              <span
                                className={cn(
                                  "sm:hidden",
                                  t.active && "text-foreground font-semibold",
                                  t.pending && "text-foreground/60",
                                )}
                              >
                                {t.shortName}
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
                              {s.activatingNotice(activationPendingCount)}
                            </span>
                          </p>
                        </div>
                      )}

                      {resolvedData.stats.currentTier.nextTier && !isTierLocked && (
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
                            <span className="font-bold text-foreground">
                              {s.inviteMore(
                                resolvedData.stats.currentTier.nextTier
                                  .referralsNeeded,
                              )}
                            </span>{" "}
                            {s.activeFriendsToLevelUp}
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
                      {s.badgesEarned}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
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
                          name: "Eclipse",
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
                            "relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all overflow-hidden",
                            m.active
                              ? "bg-[#16a34a]/5 dark:bg-[#4ade80]/5 border-[#16a34a]/20 dark:border-[#4ade80]/20"
                              : m.pending
                                ? "bg-[#16a34a]/5 dark:bg-[#4ade80]/5 border-[#16a34a]/10 dark:border-[#4ade80]/10 opacity-60"
                                : "bg-muted/30 dark:bg-muted/50 border-border/20 dark:border-border/40 grayscale opacity-50",
                          )}
                        >
                          <div className="mb-1.5 sm:mb-2">
                            {m.active ? (
                              <m.Icon className="text-foreground" size={24} />
                            ) : m.pending ? (
                              <m.Icon
                                className="text-foreground/60"
                                size={24}
                              />
                            ) : (
                              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground/30" />
                            )}
                          </div>
                          <div
                            className={cn(
                              "text-[9px] sm:text-[10px] font-semibold",
                              m.active || m.pending
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {m.name}
                          </div>
                          <div className="text-[8px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-wider">
                            {m.pending ? s.sundayLabel : s.activeMilestone(m.count)}
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
                    {s.yourNetwork}
                  </h3>
                  <div className="text-[10px] font-medium text-muted-foreground">
                    {s.totalLabel(totalNetworkCount)}
                  </div>
                </div>

                {/* Activation explainer when there are pending referees but no active ones */}
                {totalNetworkCount > 0 &&
                  resolvedData.stats.activeReferees === 0 && (
                    <div className="rounded-xl bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/20 dark:border-amber-400/20 p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-1.5 rounded-lg bg-amber-500/10 dark:bg-amber-400/10">
                          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {s.waitingForActivation}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {s.waitingActivationBody}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                {totalNetworkCount === 0 ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center bg-muted/10">
                    <div className="inline-flex p-4 rounded-2xl bg-muted/50 mb-4">
                      <Users className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {s.inviteFirstFriend}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[220px] mx-auto leading-relaxed">
                      {s.inviteFirstFriendBody}
                    </p>
                    <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={shareToTwitter}
                        disabled={!resolvedData.shareableLink}
                      >
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        {s.postOnX}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={copyLink}
                        disabled={!resolvedData.shareableLink}
                      >
                        <Copy className="w-4 h-4" />
                        {s.copyLink}
                      </Button>
                    </div>
                    <div className="mt-3 flex justify-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground"
                        onClick={shareToDiscord}
                        disabled={!resolvedData.shareableLink}
                      >
                        <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                        {s.discord}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground"
                        onClick={openQRCode}
                        disabled={!resolvedData.shareableLink}
                      >
                        <QrCode className="w-3.5 h-3.5 mr-1.5" />
                        {s.qrCode}
                      </Button>
                    </div>
                  </div>
                ) : activeRefereesForList.length === 0 ? (
                  <div className="rounded-2xl border border-border/20 dark:border-border/40 p-6 text-center bg-muted/20 dark:bg-muted/40">
                    <p className="text-sm font-semibold text-foreground">
                      {s.noActiveYet}
                    </p>
                    {hiddenPendingCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.pendingNotShown(
                          hiddenPendingCount,
                          hiddenPendingCount > 1,
                        )}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/20 dark:border-border/40 overflow-hidden bg-muted/30 dark:bg-muted/50">
                    {hiddenPendingCount > 0 && (
                      <div className="px-4 py-2 border-b border-border/20 dark:border-border/40 bg-muted/40 dark:bg-muted/60">
                        <p className="text-[11px] text-muted-foreground">
                          {s.pendingNotShown(
                            hiddenPendingCount,
                            hiddenPendingCount > 1,
                          )}
                        </p>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/50 dark:bg-muted/60">
                          <TableRow className="hover:bg-transparent border-b border-border/20 dark:border-border/40">
                            <TableHead className="h-10 text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-wider whitespace-nowrap">
                              {s.referralCol}
                            </TableHead>
                            <TableHead className="h-10 text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-wider whitespace-nowrap">
                              {s.statusCol}
                            </TableHead>
                            <TableHead className="h-10 text-right text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-wider whitespace-nowrap">
                              {s.yourEarningsCol}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeRefereesForList.map((ref) => (
                            <TableRow
                              key={ref.refereeWallet}
                              className="group hover:bg-muted/40 dark:hover:bg-muted/60 border-b border-border/20 dark:border-border/40 last:border-0"
                            >
                              <TableCell className="py-3 sm:py-4">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap">
                                    {ref.ensName ||
                                      formatAddress(ref.refereeWallet)}
                                  </span>
                                  <span className="text-[9px] sm:text-[10px] text-muted-foreground/60 dark:text-muted-foreground/80 font-mono whitespace-nowrap">
                                    {new Date(ref.linkedAt).toLocaleDateString(
                                      undefined,
                                      {
                                        month: "short",
                                        day: "numeric",
                                      },
                                    )}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3 sm:py-4">
                                <div className="flex flex-col gap-1">
                                  {ref.activationPending ? (
                                    <Badge
                                      variant="secondary"
                                      className="bg-[#16a34a]/10 text-[#16a34a] dark:bg-[#4ade80]/10 dark:text-[#4ade80] border-[#16a34a]/20 dark:border-[#4ade80]/20 hover:bg-[#16a34a]/10 dark:hover:bg-[#4ade80]/10 gap-1 rounded-lg h-5 sm:h-6 text-[10px] font-semibold whitespace-nowrap"
                                    >
                                      <Sparkles className="w-3 h-3" />{" "}
                                      {s.activating}
                                    </Badge>
                                  ) : ref.status === "active" ? (
                                    <Badge
                                      variant="secondary"
                                      className="bg-[#16a34a]/10 text-[#16a34a] dark:bg-[#4ade80]/10 dark:text-[#4ade80] border-[#16a34a]/20 dark:border-[#4ade80]/20 hover:bg-[#16a34a]/10 dark:hover:bg-[#4ade80]/10 gap-1 rounded-lg h-5 sm:h-6 text-[10px] font-semibold whitespace-nowrap"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />{" "}
                                      {s.active}
                                    </Badge>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      <Badge
                                        variant="secondary"
                                        className="bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-400/20 hover:bg-amber-500/10 dark:hover:bg-amber-400/10 gap-1 rounded-lg h-5 sm:h-6 text-[10px] font-semibold whitespace-nowrap"
                                      >
                                        <Clock className="w-3 h-3" /> {s.pending}
                                      </Badge>
                                      <span className="text-[8px] text-muted-foreground/60 whitespace-nowrap">
                                        {s.needs100pts}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-3 sm:py-4 text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-xs sm:text-sm font-mono font-semibold text-[#16a34a] dark:text-[#4ade80] whitespace-nowrap">
                                    +{formatPoints(ref.lifetimePointsScaled6)}
                                  </span>
                                  {parseFloat(ref.thisWeekPointsScaled6) >
                                    0 && (
                                    <span className="text-[8px] sm:text-[9px] uppercase font-semibold text-muted-foreground/60 dark:text-muted-foreground/80 whitespace-nowrap">
                                      +{formatPoints(ref.thisWeekPointsScaled6)}
                                      {s.perWeekSuffix}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>

              {/* FAQ SECTION */}
              <div className="rounded-xl bg-muted/30 dark:bg-muted/50 p-4 sm:p-5 border border-border/20 dark:border-border/40 space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-[10px] font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                    {s.faq}
                  </h4>
                </div>
                <Accordion
                  type="single"
                  collapsible
                  className="space-y-2"
                  onValueChange={(value) => {
                    if (value) {
                      trackEvent("referral_faq_expand", {
                        faq_id: value,
                        wallet_address: walletAddress ?? null,
                      });
                    }
                  }}
                >
                  <AccordionItem
                    value="activation"
                    className="border-b-0 rounded-lg bg-card dark:bg-card/30 px-3 sm:px-4"
                  >
                    <AccordionTrigger className="py-2.5 sm:py-3 text-[11px] sm:text-xs font-medium text-foreground hover:no-underline [&[data-state=open]>svg]:rotate-180">
                      {s.faqActivationQ}
                    </AccordionTrigger>
                    <AccordionContent className="pb-3 text-[11px] sm:text-xs text-muted-foreground/70 dark:text-muted-foreground/80 leading-relaxed">
                      {s.faqActivationABody1}
                      <span className="text-foreground font-semibold">
                        {s.faqActivationABold}
                      </span>
                      {s.faqActivationABody2}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="rewards"
                    className="border-b-0 rounded-lg bg-card dark:bg-card/30 px-3 sm:px-4"
                  >
                    <AccordionTrigger className="py-2.5 sm:py-3 text-[11px] sm:text-xs font-medium text-foreground hover:no-underline [&[data-state=open]>svg]:rotate-180">
                      {s.faqRewardsQ}
                    </AccordionTrigger>
                    <AccordionContent className="pb-3 text-[11px] sm:text-xs text-muted-foreground/70 dark:text-muted-foreground/80 leading-relaxed space-y-2">
                      <p>{s.faqRewardsBody}</p>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground/50">
                            {s.faqTier1}
                          </span>
                          <span className="text-foreground font-semibold">
                            5%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground/50">
                            {s.faqTier2}
                          </span>
                          <span className="text-foreground font-semibold">
                            10%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground/50">
                            {s.faqTier3}
                          </span>
                          <span className="text-foreground font-semibold">
                            15%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground/50">
                            {s.faqTier4}
                          </span>
                          <span className="text-foreground font-semibold">
                            20%
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="referee-benefit"
                    className="border-b-0 rounded-lg bg-card dark:bg-card/30 px-3 sm:px-4"
                  >
                    <AccordionTrigger className="py-2.5 sm:py-3 text-[11px] sm:text-xs font-medium text-foreground hover:no-underline [&[data-state=open]>svg]:rotate-180">
                      {s.faqRefereeQ}
                    </AccordionTrigger>
                    <AccordionContent className="pb-3 text-[11px] sm:text-xs text-muted-foreground/70 dark:text-muted-foreground/80 leading-relaxed">
                      {s.faqRefereeBody1}
                      <span className="text-foreground font-semibold">
                        {s.faqRefereeBoldA}
                      </span>
                      {s.faqRefereeBody2}
                      <span className="text-foreground font-semibold">
                        {s.faqRefereeBoldB}
                      </span>
                      {s.faqRefereeBody3}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="change-referrer"
                    className="border-b-0 rounded-lg bg-card dark:bg-card/30 px-3 sm:px-4"
                  >
                    <AccordionTrigger className="py-2.5 sm:py-3 text-[11px] sm:text-xs font-medium text-foreground hover:no-underline [&[data-state=open]>svg]:rotate-180">
                      {s.faqChangeQ}
                    </AccordionTrigger>
                    <AccordionContent className="pb-3 text-[11px] sm:text-xs text-muted-foreground/70 dark:text-muted-foreground/80 leading-relaxed">
                      {s.faqChangeBody1}
                      <span className="text-foreground font-semibold">
                        {s.faqChangeBold}
                      </span>
                      {s.faqChangeBody2}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="finalization"
                    className="border-b-0 rounded-lg bg-card dark:bg-card/30 px-3 sm:px-4"
                  >
                    <AccordionTrigger className="py-2.5 sm:py-3 text-[11px] sm:text-xs font-medium text-foreground hover:no-underline [&[data-state=open]>svg]:rotate-180">
                      {s.faqFinalizationQ}
                    </AccordionTrigger>
                    <AccordionContent className="pb-3 text-[11px] sm:text-xs text-muted-foreground/70 dark:text-muted-foreground/80 leading-relaxed">
                      {s.faqFinalizationBody1}
                      <span className="text-foreground font-semibold font-mono">
                        {s.faqFinalizationBold}
                      </span>
                      {s.faqFinalizationBody2}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
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
            title={s.shareReferralCode}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

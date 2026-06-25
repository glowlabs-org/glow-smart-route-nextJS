"use client";

/**
 * Onboarding flow — the logged-out "get started with Glow" experience.
 *
 * Per David's feedback the five steps are now rolled into ONE carousel instead
 * of standalone vertical sections: the steps are visually connected by a single
 * numbered progress rail that fills as the user advances. Slides:
 *   01 Buy GLW · 02 Delegate · 03 Earn · 04 Mine · 05 Learn
 *
 * Two notable rules:
 *   - Slide 04 (Mine) lists the always-on EVERGREEN starter miner, not the
 *     launchpad-gated feed, so the step always has a real, buyable miner.
 *   - Slide 05 (Learn) is a grid finale (protocol metrics + featured post).
 *
 * Aesthetic target: elevenlabs-clean — generous whitespace, high-contrast type,
 * quiet mono labels, subtle low-opacity borders, no shadows (see AGENTS.md).
 * Copy is i18n-driven via the `onboarding` namespace (lib/i18n; en / ko / zh).
 */

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  MapPin,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { formatUnits } from "viem";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import AutoHeight from "embla-carousel-auto-height";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { trackEvent } from "@/lib/telemetry";
import { normalizeMinerWeeksRemainingDisplay } from "@/lib/mining-score";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";
import { useLaunchpadStatus } from "@/hooks/useLaunchpadStatus";
import { useGlowCirculatingSupply } from "@/hooks/useGlowCirculatingSupply";
import { useCountdownTo } from "@/app/components/animated-countdown";
import {
  useEvergreenMiners,
  useMiningScore,
  getMiningScoreForApplication,
  useTotalActivelyDelegated,
} from "@/hooks";
import {
  PointsShopIcon,
  CashMinerIcon,
  DelegationIcon,
} from "@/components/impact-icons";
import { GlowSymbol } from "@/components/glow-symbol";
import { FallbackImage } from "@/components/ui/fallback-image";
import { WidgetErrorBoundary } from "@/components/widget-error-boundary";
import LaunchpadStatusWidget from "./launchpad-status-widget";
import BlogFeaturedWidget from "./blog-featured-widget";
import type { TaggedAuctionApplication } from "@/app/marketplace/launchpad-view";

const DEFINED_POOL_ACTIVITY_URL =
  "https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d";

/** The five onboarding steps, in order; labels come from i18n (t.onboarding.steps). */
const STEPS = [
  { id: "buy" },
  { id: "delegate" },
  { id: "earn" },
  { id: "mine" },
  { id: "learn" },
] as const;

const PANEL = "rounded-3xl border border-border/15 dark:border-white/10";
const SLIDE_GRID =
  "grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch";
const LINK_CARD = cn(
  PANEL,
  "group flex flex-col justify-center gap-5 bg-muted/10 p-7 transition-[background-color,border-color,scale] duration-200 ease-out hover:border-border/30 hover:bg-muted/30 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-white/[0.03] dark:hover:bg-white/[0.06]",
);

/**
 * The connected progress rail — David's "visually connected better". Numbered
 * nodes joined by a hairline that fills left-to-right as the user advances;
 * every node is a jump target. Labels collapse on mobile, numbers stay.
 */
function StepRail({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (index: number) => void;
}) {
  const { t } = useLang();
  return (
    <nav aria-label="Onboarding steps" className="mb-10 sm:mb-12">
      {/* Explicit "step N of M" cue so the multi-step nature is obvious. */}
      <div className="mb-5 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
        {t.onboarding.stepper.stepOf(selected + 1, STEPS.length)}
      </div>
      <div className="flex items-center">
        {STEPS.map((step, index) => {
          const isActive = index === selected;
          const isDone = index < selected;
          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${t.onboarding.steps[step.id]}`}
                className="group flex shrink-0 items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-xs font-bold tabular-nums transition-colors duration-200 ease-out",
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : isDone
                        ? "border-foreground bg-foreground/10 text-foreground"
                        : "border-border text-muted-foreground/70 group-hover:border-foreground/70 group-hover:text-foreground dark:border-white/20",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "hidden text-xs font-mono uppercase tracking-[0.16em] transition-colors duration-200 ease-out sm:inline",
                    isActive
                      ? "font-semibold text-foreground"
                      : isDone
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50 group-hover:text-muted-foreground",
                  )}
                >
                  {t.onboarding.steps[step.id]}
                </span>
              </button>
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="relative mx-2.5 h-0.5 flex-1 overflow-hidden rounded-full bg-border/50 dark:bg-white/10 sm:mx-3.5"
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full bg-foreground transition-[width] duration-300 ease-out",
                      isDone ? "w-full" : isActive ? "w-1/2" : "w-0",
                    )}
                  />
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}

/** Numbered eyebrow + heading + body — the left column of a slide. */
function SlideHeader({
  kicker,
  title,
  children,
  className,
}: {
  kicker?: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col justify-center gap-5", className)}>
      {kicker && (
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
          {kicker}
        </span>
      )}
      <h3 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
        {title}
      </h3>
      {children && (
        <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          {children}
        </p>
      )}
    </div>
  );
}

/** Equal-height slide shell — embla stretches every item to a shared min height. */
function Slide({ children }: { children: React.ReactNode }) {
  return (
    <CarouselItem className="flex min-h-[460px] basis-full flex-col border-0 bg-transparent">
      {children}
    </CarouselItem>
  );
}

/** STEP 01 — Buy GLW: the amber live-price panel. */
function BuyGlwSlide({ onBuyGlowClick }: { onBuyGlowClick: () => void }) {
  const { t } = useLang();
  const { spotPriceUsd } = useGlowSpotPriceSummary();
  const priceLabel =
    spotPriceUsd > 0
      ? `$${spotPriceUsd.toLocaleString(undefined, {
          minimumFractionDigits: spotPriceUsd < 1 ? 3 : 2,
          maximumFractionDigits: spotPriceUsd < 1 ? 3 : 2,
        })}`
      : "--";

  return (
    <div className={SLIDE_GRID}>
      <SlideHeader
        kicker={t.onboarding.buy.kicker}
        title={t.onboarding.buy.title}
      >
        {t.onboarding.buy.body}
      </SlideHeader>
      <div
        className={cn(
          "rounded-3xl border border-border/20 dark:border-white/10",
          "flex h-full flex-col justify-between gap-8 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 p-8 dark:from-amber-500/10 dark:via-transparent dark:to-transparent lg:col-span-2",
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <GlowSymbol className="h-6 w-6 text-amber-500" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
              {t.onboarding.buy.priceLabel}
            </span>
          </div>
          <a
            href={DEFINED_POOL_ACTIVITY_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t.onboarding.buy.priceChart}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-5xl font-bold tracking-tight tabular-nums text-foreground sm:text-6xl">
            {priceLabel}
          </span>
          <span className="text-xs text-muted-foreground">
            {t.onboarding.buy.priceSource}
          </span>
        </div>
        <Button size="lg" className="w-full font-medium" onClick={onBuyGlowClick}>
          {t.onboarding.buy.cta}
        </Button>
      </div>
    </div>
  );
}

/**
 * Bespoke "next listing window" panel for the Delegate slide's not-live state.
 * Replaces the generic shared countdown card (which self-collapses and left a
 * lot of dead space) with a full-height, elevenlabs-clean panel: a live status
 * row, a big tabular countdown as the centerpiece, and a GLW price + CTA footer.
 */
function NextListingCountdownPanel({
  nextBatchAtMs,
  onBuyGlowClick,
}: {
  nextBatchAtMs: number;
  onBuyGlowClick: () => void;
}) {
  const { t } = useLang();
  const remainingMs = useCountdownTo({ targetAtMs: nextBatchAtMs });
  const { spotPriceUsd } = useGlowSpotPriceSummary();

  const totalSeconds = Math.floor(remainingMs / 1000);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const units = [
    {
      label: t.onboarding.countdown.days,
      value: pad2(Math.floor(totalSeconds / 86_400)),
    },
    {
      label: t.onboarding.countdown.hours,
      value: pad2(Math.floor((totalSeconds % 86_400) / 3_600)),
    },
    {
      label: t.onboarding.countdown.minutes,
      value: pad2(Math.floor((totalSeconds % 3_600) / 60)),
    },
    { label: t.onboarding.countdown.seconds, value: pad2(totalSeconds % 60) },
  ];

  const priceLabel =
    spotPriceUsd > 0
      ? `$${spotPriceUsd.toLocaleString(undefined, {
          minimumFractionDigits: spotPriceUsd < 1 ? 3 : 2,
          maximumFractionDigits: spotPriceUsd < 1 ? 3 : 2,
        })}`
      : "--";

  return (
    <div className="flex h-full w-full flex-col justify-between gap-8 overflow-hidden rounded-3xl border border-border/15 bg-gradient-to-br from-muted/30 via-transparent to-transparent p-7 dark:border-white/10 dark:from-white/[0.04] sm:p-8">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
            {t.onboarding.countdown.nextWindow}
          </span>
        </div>
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/40">
          {t.onboarding.countdown.opens}
        </span>
      </div>

      {/* Countdown — the centerpiece */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {units.map((unit) => (
            <div
              key={unit.label}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border/10 bg-background/60 py-5 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <span className="text-4xl font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-5xl">
                {unit.value}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/50">
                {unit.label}
              </span>
            </div>
          ))}
        </div>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {t.onboarding.countdown.note}
        </p>
      </div>

      {/* GLW price + CTA */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-2xl border border-border/10 bg-muted/10 px-5 py-3.5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2.5">
            <GlowSymbol className="h-5 w-5 text-amber-500" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
              {t.onboarding.buy.priceLabel}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {priceLabel}
            </span>
            <a
              href={DEFINED_POOL_ACTIVITY_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              defined.fi
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
        <Button
          size="lg"
          className="w-full font-medium"
          onClick={onBuyGlowClick}
        >
          {t.onboarding.countdown.cta}
        </Button>
      </div>
    </div>
  );
}

/**
 * STEP 02 — Delegate GLW to Solar Farms. When the launchpad is LIVE this shows
 * the real launchpad listing cards (which fill the column); otherwise it shows
 * the bespoke "next listing window" countdown panel above.
 */
function DelegateSlide({
  onPayDeposit,
  onBuyGlowClick,
  isApproaching,
}: {
  onPayDeposit: React.ComponentProps<
    typeof LaunchpadStatusWidget
  >["onPayDeposit"];
  onBuyGlowClick: () => void;
  isApproaching: boolean;
}) {
  const { t } = useLang();
  const { isLive, nextBatchAtMs } = useLaunchpadStatus();

  return (
    <div className={SLIDE_GRID}>
      <SlideHeader
        kicker={t.onboarding.delegate.kicker}
        title={t.onboarding.delegate.title}
      >
        {t.onboarding.delegate.body}
      </SlideHeader>
      <div className="flex lg:col-span-2">
        {isLive ? (
          <WidgetErrorBoundary>
            <LaunchpadStatusWidget
              className="h-full w-full"
              variant="minimal"
              forcedType="delegations"
              isApproaching={isApproaching}
              onPayDeposit={onPayDeposit}
            />
          </WidgetErrorBoundary>
        ) : (
          <NextListingCountdownPanel
            nextBatchAtMs={nextBatchAtMs}
            onBuyGlowClick={onBuyGlowClick}
          />
        )}
      </div>
    </div>
  );
}

/** STEP 03 — Earn Points & Impact: two destination cards. */
function EarnPointsSlide() {
  const { t } = useLang();
  return (
    <div className={SLIDE_GRID}>
      <SlideHeader
        kicker={t.onboarding.earn.kicker}
        title={t.onboarding.earn.title}
      >
        {t.onboarding.earn.body}
      </SlideHeader>
      <Link
        href="/shop"
        target="_blank"
        rel="noreferrer"
        onClick={() =>
          trackEvent("dashboard_onboarding_link_click", {
            source: "bento",
            destination: "shop",
          })
        }
        className={LINK_CARD}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
          <PointsShopIcon className="h-6 w-6 text-amber-500" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-lg font-semibold text-foreground">
            {t.onboarding.earn.shopTitle}
          </span>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {t.onboarding.earn.shopDesc}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
          {t.onboarding.earn.shopCta}
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
      <Link
        href="/leaderboard"
        target="_blank"
        rel="noreferrer"
        onClick={() =>
          trackEvent("dashboard_onboarding_link_click", {
            source: "bento",
            destination: "leaderboard",
          })
        }
        className={LINK_CARD}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
          <Trophy className="h-6 w-6 text-emerald-500" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-lg font-semibold text-foreground">
            {t.onboarding.earn.leaderboardTitle}
          </span>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {t.onboarding.earn.leaderboardDesc}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {t.onboarding.earn.leaderboardCta}
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </div>
  );
}

/**
 * STEP 04 — Become a GLW Miner. Lists the always-on EVERGREEN starter miner
 * (per David: "obviously the miner step should list the evergreen miner"), so
 * the step always shows a real, buyable miner regardless of the launchpad
 * window. Falls back to a calm empty state only if the evergreen feed is down.
 */
function MinerSlide({
  onPayDeposit,
}: {
  onPayDeposit: React.ComponentProps<
    typeof LaunchpadStatusWidget
  >["onPayDeposit"];
}) {
  const { t } = useLang();
  const { applications: minerApps } = useEvergreenMiners({ enabled: true });
  const { miningScoreMap } = useMiningScore({
    applications: minerApps,
    enabled: minerApps.length > 0,
  });
  const { spotPriceUsd } = useGlowSpotPriceSummary();

  // Cheapest available (unfilled, in-stock) evergreen miner listing.
  const cheapest = React.useMemo(() => {
    const available = minerApps.filter((a) =>
      Boolean(
        a.activeFraction &&
          !a.activeFraction.isFilled &&
          (a.activeFraction.remainingSteps ?? 0) > 0,
      ),
    );
    if (!available.length) return null;
    const priceOf = (a: (typeof available)[number]) => {
      const v = Number(a.activeFraction?.stepPrice);
      return Number.isFinite(v) ? v : Infinity;
    };
    return available.reduce((min, a) => (priceOf(a) < priceOf(min) ? a : min));
  }, [minerApps]);

  const card = React.useMemo(() => {
    if (!cheapest) return null;
    const mining = getMiningScoreForApplication(miningScoreMap, cheapest.id);
    const num = (raw: string | null | undefined, decimals: number) => {
      try {
        return parseFloat(formatUnits(BigInt(raw || "0"), decimals));
      } catch {
        return 0;
      }
    };
    const priceUsd = num(cheapest.activeFraction?.stepPrice, 6);
    const weeklyGlw = mining?.weeklyGlwRewards
      ? num(mining.weeklyGlwRewards, 18)
      : null;
    return {
      application: cheapest,
      scoreData: mining
        ? {
            miningScore: mining.miningScore,
            weeklyGlwRewards: mining.weeklyGlwRewards,
            weeklyGlwRewardsUsd: mining.weeklyGlwRewardsUsd,
            weeksOfMinerLifeRemaining: mining.weeksOfMinerLifeRemaining,
          }
        : null,
      priceUsd,
      weeklyGlw,
      weeklyUsd:
        weeklyGlw != null && spotPriceUsd > 0 ? weeklyGlw * spotPriceUsd : null,
      // Use the canonical normalizer (floor + 1, i.e. weeks earnable from the
      // purchase week forward) so this matches the buy-glow dialog and the
      // launchpad card exactly — a raw round here read 1 week low.
      weeks: normalizeMinerWeeksRemainingDisplay(
        mining?.weeksOfMinerLifeRemaining,
      ),
      image: cheapest.afterInstallPictures?.[0]?.url ?? "",
      farmName: cheapest.farmName || "Solar miner",
      region: cheapest.zone?.name ?? "",
    };
  }, [cheapest, miningScoreMap, spotPriceUsd]);

  return (
    <div className={SLIDE_GRID}>
      <SlideHeader
        kicker={t.onboarding.miner.kicker}
        title={t.onboarding.miner.title}
      >
        {t.onboarding.miner.body}
      </SlideHeader>

      <div className="flex lg:col-span-2">
        {card ? (
          <div className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border/20 bg-card transition-[border-color] duration-300 hover:border-border/40 dark:border-border/40 dark:bg-card">
            <div className="relative m-3 mb-0 aspect-[3/2] overflow-hidden rounded-xl sm:aspect-[16/9] lg:aspect-[5/2]">
              <FallbackImage
                src={card.image}
                widthForProxy={800}
                quality={85}
                alt={`${card.farmName} solar farm`}
                className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 transition-transform duration-700 group-hover:scale-105 dark:outline-white/10"
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-black/40 via-transparent to-transparent" />
              <div className="absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
                <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--color-miner)]/50 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-foreground backdrop-blur-xl sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs dark:bg-black/60 dark:text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-miner)]" />
                  Miner
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col px-4 pb-5 pt-4 sm:p-5 lg:p-5">
              <div className="mb-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 text-balance text-xl font-bold tracking-tight text-foreground">
                    {card.farmName}
                  </h3>
                  {card.region && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground sm:mt-1.5 sm:text-sm">
                      <MapPin className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                      <span className="truncate">{card.region}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto grid auto-rows-fr grid-cols-2 gap-2">
                <div className="flex min-w-0 flex-col rounded-lg bg-muted/30 p-3 lg:px-2.5 lg:py-2 dark:bg-muted/50">
                  <span className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t.onboarding.miner.price}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-1">
                    <span className="font-mono text-xl font-bold leading-tight tabular-nums text-foreground lg:text-lg">
                      ${Math.round(card.priceUsd).toLocaleString()}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      USDC
                    </span>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col rounded-lg bg-muted/30 p-3 lg:px-2.5 lg:py-2 dark:bg-muted/50">
                  <div className="mb-1 flex items-center gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {t.onboarding.miner.estWeekly}
                    </span>
                    <HelpCircle className="h-2.5 w-2.5 text-muted-foreground/60 sm:h-3 sm:w-3" />
                  </div>
                  <div className="flex flex-wrap items-baseline gap-1">
                    <span className="font-mono text-xl font-bold leading-tight tabular-nums text-foreground lg:text-lg">
                      {card.weeklyGlw != null
                        ? `+${card.weeklyGlw.toFixed(1)}`
                        : "—"}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      GLW
                      {card.weeklyUsd != null
                        ? ` · $${card.weeklyUsd.toFixed(2)}`
                        : ""}
                    </span>
                  </div>
                  {card.weeks != null && (
                    <span className="text-xs font-medium text-muted-foreground">
                      {t.onboarding.miner.forWeeks(card.weeks)}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <Button
                  className="h-12 w-full rounded-xl text-sm font-semibold"
                  onClick={() =>
                    onPayDeposit?.(
                      {
                        ...card.application,
                        _type: "miners",
                        // Tag as evergreen so the deposit dialog's pre-buy
                        // refetch queries the private evergreen surface, not the
                        // public miner feed (which excludes evergreen rows).
                        _evergreen: true,
                      } as TaggedAuctionApplication,
                      card.scoreData,
                      "USDC",
                    )
                  }
                >
                  {t.onboarding.miner.cta}
                  <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[280px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-border/15 bg-muted/10 p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40 dark:bg-white/[0.06]">
              <CashMinerIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground">
                {t.onboarding.miner.emptyTitle}
              </span>
              <p className="text-pretty text-sm text-muted-foreground">
                {t.onboarding.miner.emptyBody}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** A single protocol-metric tile; stretches to fill its grid cell. */
function StatTile({
  label,
  value,
  sub,
  icon,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col justify-between gap-4 rounded-2xl border border-border/15 bg-muted/20 p-6 dark:border-white/10 dark:bg-white/[0.03]",
        href &&
          "transition-colors hover:border-border/30 hover:bg-muted/30 dark:hover:bg-white/[0.06]",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/60">
          {label}
        </span>
        <span className="text-muted-foreground/50 transition-colors group-hover:text-foreground">
          {icon}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-4xl">
          {value}
        </span>
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/50">
          {sub}
        </span>
      </div>
    </div>
  );

  if (!href) return body;
  return href.startsWith("http") ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group block h-full"
    >
      {body}
    </a>
  ) : (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group block h-full"
    >
      {body}
    </Link>
  );
}

/**
 * STEP 05 — Learn more: the grid finale (David: "that final bit I might have be
 * more of a grid"). A 2×2 grid of live protocol metrics + a "view all stats"
 * CTA on the left, and a full-height featured blog post on the right. The tiles
 * stretch to fill the column exactly, so there's no dead space and the slide
 * doesn't grow taller than its siblings.
 */
function LearnMoreSlide() {
  const { t } = useLang();
  const {
    circulatingSupply,
    marketCap,
    glowPrice,
    isLoading: isSupplyLoading,
  } = useGlowCirculatingSupply();
  const { data: delegatedData, isLoading: isDelegatedLoading } =
    useTotalActivelyDelegated();

  const percentDelegated = React.useMemo(() => {
    if (!circulatingSupply || circulatingSupply === 0) return 0;
    const delegated = delegatedData?.totalGlwDelegatedWei
      ? Number(formatUnits(BigInt(delegatedData.totalGlwDelegatedWei), 18))
      : 0;
    return (delegated / circulatingSupply) * 100;
  }, [circulatingSupply, delegatedData]);

  const dash = "—";
  const priceValue =
    isSupplyLoading || !(glowPrice > 0) ? dash : `$${glowPrice.toFixed(4)}`;
  const marketCapValue = isSupplyLoading
    ? dash
    : `$${(marketCap / 1_000_000).toFixed(1)}M`;
  const delegatedValue =
    isSupplyLoading || isDelegatedLoading
      ? dash
      : `${percentDelegated.toFixed(1)}%`;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <SlideHeader
        kicker={t.onboarding.learn.kicker}
        title={t.onboarding.learn.title}
      >
        {t.onboarding.learn.body}
      </SlideHeader>
      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
        <StatTile
          label={t.onboarding.learn.glwPrice}
          value={priceValue}
          sub={t.onboarding.learn.glwPriceSub}
          icon={<ArrowUpRight className="h-4 w-4" />}
          href="https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d?quoteToken=token1"
        />
        <StatTile
          label={t.onboarding.learn.marketCap}
          value={marketCapValue}
          sub={t.onboarding.learn.marketCapSub}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatTile
          label={t.onboarding.learn.delegated}
          value={delegatedValue}
          sub={t.onboarding.learn.delegatedSub}
          icon={<DelegationIcon className="h-4 w-4" />}
        />
        {/* Dark CTA tile — completes the 2×2 and carries the old "view all
            stats" action. */}
        <Link
          href="/stats"
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            trackEvent("dashboard_onboarding_link_click", {
              source: "bento",
              destination: "stats",
            })
          }
          className="group block h-full"
        >
          <div className="flex h-full flex-col justify-between gap-4 rounded-2xl bg-foreground p-6 text-background transition-colors hover:bg-foreground/90">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-background/60">
                {t.onboarding.learn.exploreLabel}
              </span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-lg font-semibold tracking-tight">
                {t.onboarding.learn.viewAllStats}
              </span>
              <span className="text-[11px] leading-relaxed text-background/60">
                {t.onboarding.learn.viewAllStatsSub}
              </span>
            </div>
          </div>
        </Link>
        {/* Featured post — full height of the right column. */}
        <div className="min-h-[280px] sm:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:min-h-0">
          <WidgetErrorBoundary>
            <BlogFeaturedWidget className="h-full w-full" />
          </WidgetErrorBoundary>
        </div>
      </div>
    </div>
  );
}

interface GetStartedCarouselProps {
  onBuyGlowClick: () => void;
  onPayDeposit: React.ComponentProps<
    typeof LaunchpadStatusWidget
  >["onPayDeposit"];
  isApproaching: boolean;
  /** When the launchpad is live, open on STEP 02 (Delegate) instead of STEP 01. */
  startOnDelegate: boolean;
}

/**
 * The whole onboarding flow as a single five-slide embla carousel with a
 * connected progress rail on top and prev/next controls below. Rolling every
 * step into one carousel is David's "main feedback"; the rail is his "visually
 * connected better".
 */
export function GetStartedCarousel({
  onBuyGlowClick,
  onPayDeposit,
  isApproaching,
  startOnDelegate,
}: GetStartedCarouselProps) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [selected, setSelected] = React.useState(0);
  // Once the user moves the carousel (swipe / arrow / rail), stop auto-positioning.
  const positionedRef = React.useRef(false);
  const lockPosition = React.useCallback(() => {
    positionedRef.current = true;
  }, []);

  const goTo = React.useCallback(
    (index: number) => {
      lockPosition();
      api?.scrollTo(index);
    },
    [api, lockPosition],
  );

  React.useEffect(() => {
    if (!api) return;
    const sync = () => setSelected(api.selectedScrollSnap());
    // Telemetry: which onboarding steps users actually reach (carousel funnel).
    const trackStepView = () => {
      const index = api.selectedScrollSnap();
      const step = STEPS[index];
      if (!step) return;
      trackEvent("dashboard_onboarding_step_view", {
        source: "bento",
        step: step.id,
        step_index: index,
      });
    };
    sync();
    api.on("select", sync);
    api.on("select", trackStepView);
    api.on("reInit", sync);
    api.on("pointerDown", lockPosition); // a swipe counts as user intent
    return () => {
      api.off("select", sync);
      api.off("select", trackStepView);
      api.off("reInit", sync);
      api.off("pointerDown", lockPosition);
    };
  }, [api, lockPosition]);

  // Default to STEP 02 (Delegate) when the launchpad is live — unless the user
  // has already moved the carousel. Imperative rather than embla's startIndex
  // because `startOnDelegate` resolves asynchronously (after the listings load).
  React.useEffect(() => {
    if (!api || positionedRef.current) return;
    if (startOnDelegate) {
      api.scrollTo(1, true);
      positionedRef.current = true;
    }
  }, [api, startOnDelegate]);

  // Auto-height: the carousel follows the active slide's height instead of
  // forcing every slide to the tallest one — kills the large dead space short
  // slides (esp. on mobile, where everything stacks) would otherwise show.
  const autoHeightPlugins = React.useMemo(() => [AutoHeight()], []);

  return (
    <div>
      <StepRail selected={selected} onSelect={goTo} />

      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        plugins={autoHeightPlugins}
        aria-label="Get started with Glow"
      >
        {/* items-start so off-screen slides keep their natural height; the
            plugin sizes the container to the active slide, animated for polish. */}
        <CarouselContent className="items-start transition-[height] duration-300 ease-out">
          <Slide>
            <BuyGlwSlide onBuyGlowClick={onBuyGlowClick} />
          </Slide>
          <Slide>
            <DelegateSlide
              onPayDeposit={onPayDeposit}
              onBuyGlowClick={onBuyGlowClick}
              isApproaching={isApproaching}
            />
          </Slide>
          <Slide>
            <EarnPointsSlide />
          </Slide>
          <Slide>
            <MinerSlide onPayDeposit={onPayDeposit} />
          </Slide>
          <Slide>
            <LearnMoreSlide />
          </Slide>
        </CarouselContent>
      </Carousel>

      {/* Controls — prev/next arrows. The prominent rail above carries the
          step position, so no separate counter here. */}
      <div className="mt-8 flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => {
              lockPosition();
              api?.scrollPrev();
            }}
            aria-label="Previous step"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => {
              lockPosition();
              api?.scrollNext();
            }}
            aria-label="Next step"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

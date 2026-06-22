"use client";

/**
 * Onboarding flow — the logged-out "get started with Glow" experience, adapted
 * from the education-carousel. The page lays these out as numbered sections
 * (STEP 1 / STEP 2 = the carousel, STEP 3 = points + impact, then a miner CTA
 * and a learn-more block); each export here is a section body, the page eyebrow
 * supplies the step label so the bodies stay badge-free where noted.
 *
 * Copy is reused verbatim from the education-carousel slides. English is inline
 * (no i18n for this surface yet).
 */

import React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  MapPin,
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
import { cn } from "@/lib/utils";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";
import {
  useMiningCenter,
  useMiningScore,
  getMiningScoreForApplication,
} from "@/hooks";
import { useLaunchpadStatus } from "@/hooks/useLaunchpadStatus";
import { PointsShopIcon, CashMinerIcon } from "@/components/impact-icons";
import { GlowSymbol } from "@/components/glow-symbol";
import { FallbackImage } from "@/components/ui/fallback-image";
import { WidgetErrorBoundary } from "@/components/widget-error-boundary";
import LaunchpadStatusWidget from "./launchpad-status-widget";
import BlogFeaturedWidget from "./blog-featured-widget";
import ProtocolMetricsWidget from "./protocol-metrics-widget";
import type { TaggedAuctionApplication } from "@/app/marketplace/launchpad-view";

const DEFINED_POOL_ACTIVITY_URL =
  "https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d";

/** Numbered eyebrow + heading + body — the left column of a slide/section. */
function SlideHeader({
  step,
  kicker,
  title,
  children,
  className,
}: {
  step?: string;
  kicker?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col justify-center gap-5", className)}>
      {(step || kicker) && (
        <div className="flex items-center gap-3">
          {step && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground font-mono text-xs font-semibold text-background">
              {step}
            </span>
          )}
          {kicker && (
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
              {kicker}
            </span>
          )}
        </div>
      )}
      <h3 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
        {title}
      </h3>
      <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        {children}
      </p>
    </div>
  );
}

/** Equal-height slide shell — embla stretches every item to the tallest. */
function Slide({ children }: { children: React.ReactNode }) {
  return (
    <CarouselItem className="flex min-h-[460px] basis-full flex-col border-0 bg-transparent">
      {children}
    </CarouselItem>
  );
}

const SLIDE_GRID =
  "grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch";
const PANEL = "rounded-3xl border border-border/15 dark:border-white/10";
const LINK_CARD = cn(
  PANEL,
  "group flex flex-col justify-center gap-5 bg-muted/10 p-7 transition-[background-color,border-color,scale] duration-200 ease-out hover:border-border/30 hover:bg-muted/30 active:scale-[0.98] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]",
);

interface GetStartedCarouselProps {
  onBuyGlowClick: () => void;
  onPayDeposit: React.ComponentProps<
    typeof LaunchpadStatusWidget
  >["onPayDeposit"];
  isApproaching: boolean;
  /** When the launchpad is live, open on STEP 2 (Delegate) instead of STEP 1. */
  startOnDelegate: boolean;
}

/**
 * STEP 1 + STEP 2 of the onboarding flow as a two-slide embla carousel:
 * "Buy GLW" (the amber GLW price panel) and "Delegate GLW to Solar Farms"
 * (the minimal launchpad delegations widget). Controls are dots + arrows,
 * driven directly via the embla api like the education carousel.
 */
export function GetStartedCarousel({
  onBuyGlowClick,
  onPayDeposit,
  isApproaching,
  startOnDelegate,
}: GetStartedCarouselProps) {
  const { spotPriceUsd } = useGlowSpotPriceSummary();
  const priceLabel =
    spotPriceUsd > 0
      ? `$${spotPriceUsd.toLocaleString(undefined, {
          minimumFractionDigits: spotPriceUsd < 1 ? 3 : 2,
          maximumFractionDigits: spotPriceUsd < 1 ? 3 : 2,
        })}`
      : "--";

  const [api, setApi] = React.useState<CarouselApi>();
  const [selected, setSelected] = React.useState(0);
  const [count, setCount] = React.useState(0);
  // Once the user moves the carousel (swipe / arrow / dot), stop auto-positioning.
  const positionedRef = React.useRef(false);
  const lockPosition = React.useCallback(() => {
    positionedRef.current = true;
  }, []);

  React.useEffect(() => {
    if (!api) return;
    const sync = () => {
      setCount(api.scrollSnapList().length);
      setSelected(api.selectedScrollSnap());
    };
    sync();
    api.on("select", sync);
    api.on("reInit", sync);
    api.on("pointerDown", lockPosition); // a swipe counts as user intent
    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
      api.off("pointerDown", lockPosition);
    };
  }, [api, lockPosition]);

  // Default to STEP 2 (Delegate) when the launchpad is live — unless the user
  // has already moved the carousel. Imperative rather than embla's startIndex
  // because `startOnDelegate` resolves asynchronously (after the listings load).
  React.useEffect(() => {
    if (!api || positionedRef.current) return;
    if (startOnDelegate) {
      api.scrollTo(1, true);
      positionedRef.current = true;
    }
  }, [api, startOnDelegate]);

  return (
    <div>
      <Carousel setApi={setApi} opts={{ loop: true }}>
        <CarouselContent>
          {/* STEP 1 — Buy GLW */}
          <Slide>
            <div className={SLIDE_GRID}>
              <SlideHeader
                step="01"
                kicker="The token"
                title="Buy GLW, the fuel of the Glow economy."
              >
                Glow runs on the GLW token, which is used to advocate for solar
                farms using a process called delegation.
              </SlideHeader>
              <div
                className={cn(
                  PANEL,
                  "flex h-full flex-col justify-between gap-8 bg-gradient-to-br from-amber-50 via-white to-white p-8 dark:from-amber-500/10 dark:via-transparent dark:to-transparent lg:col-span-2",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <GlowSymbol className="h-6 w-6 text-amber-500" />
                    <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
                      GLW price
                    </span>
                  </div>
                  <a
                    href={DEFINED_POOL_ACTIVITY_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Price chart
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-5xl font-bold tracking-tight tabular-nums text-foreground sm:text-6xl">
                    {priceLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Live spot price, sourced on-chain.
                  </span>
                </div>
                <Button
                  size="lg"
                  className="w-full font-medium"
                  onClick={onBuyGlowClick}
                >
                  Buy GLW
                </Button>
              </div>
            </div>
          </Slide>

          {/* STEP 2 — Delegate GLW to Solar Farms */}
          <Slide>
            <div className={SLIDE_GRID}>
              <SlideHeader
                step="02"
                kicker="Delegation"
                title="Delegate GLW to Solar Farms"
              >
                Each solar farm produces a variable amount of rewards based on
                how competitive it is. By delegating GLW to a farm you endorse
                its participation in Glow, and you earn rewards (or penalties)
                based on how competitive that farm is.
              </SlideHeader>
              <div className="flex lg:col-span-2">
                <WidgetErrorBoundary>
                  <LaunchpadStatusWidget
                    className="h-full w-full"
                    variant="minimal"
                    forcedType="delegations"
                    isApproaching={isApproaching}
                    onPayDeposit={onPayDeposit}
                  />
                </WidgetErrorBoundary>
              </div>
            </div>
          </Slide>
        </CarouselContent>
      </Carousel>

      {/* Controls — dots + arrows. Drives embla directly via the api since the
          shadcn CarouselPrevious/Next render literal text labels. */}
      <div className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Array.from({ length: count }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                lockPosition();
                api?.scrollTo(index);
              }}
              aria-label={`Go to slide ${index + 1}`}
              className={cn(
                // Extend the tap target vertically (and as far horizontally as
                // the gap allows) without overlapping the neighbouring dots.
                "relative h-2 rounded-full transition-[width,background-color] duration-200 ease-out after:absolute after:-inset-x-1 after:-inset-y-4 after:content-['']",
                index === selected
                  ? "w-6 bg-foreground"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
              )}
            />
          ))}
        </div>
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
            aria-label="Previous slide"
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
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * STEP 3 — "Earn Points, and Impact". A title + body on the left, then two
 * link cards (Points Shop, Impact Leaderboard). No outer card and no step badge
 * (the page eyebrow already says STEP 3); the parent provides the surface.
 */
export function EarnPointsSection() {
  return (
    <div className="flex items-center">
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3 lg:items-center">
        <SlideHeader title="Earn Points, and Impact">
          Delegating GLW earns you points that can be redeemed in the points
          shop. You also receive impact: the ‘watts’ you earn represent
          real-world energy production, and ‘tons of CO₂’ represent real
          emissions eliminated by the farm you powered up.
        </SlideHeader>
        <Link href="/shop" className={LINK_CARD}>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
            <PointsShopIcon className="h-6 w-6 text-amber-500" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-lg font-semibold text-foreground">
              Points Shop
            </span>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              Redeem the points you earn for real rewards.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
            Open shop
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
        <Link href="/leaderboard" className={LINK_CARD}>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
            <Trophy className="h-6 w-6 text-emerald-500" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-lg font-semibold text-foreground">
              Impact Leaderboard
            </span>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              See top wallets ranked by watts &amp; tons of CO₂.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            View leaderboard
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}

/**
 * "Become a GLW Miner". Title + body on the left, a neutral "Starter Miner"
 * panel on the right with the always-on $399 starter miner that needs no
 * launchpad window. Section body only — the parent provides the outer card.
 */
export function BecomeMinerSection({
  onPayDeposit,
}: {
  onPayDeposit: React.ComponentProps<
    typeof LaunchpadStatusWidget
  >["onPayDeposit"];
}) {
  const { isLive } = useLaunchpadStatus();
  const { applications: minerApps } = useMiningCenter({
    filters: { paymentCurrency: "USDC" },
    enabled: isLive,
  });
  const { miningScoreMap } = useMiningScore({
    applications: minerApps,
    enabled: isLive && minerApps.length > 0,
  });
  const { spotPriceUsd } = useGlowSpotPriceSummary();

  // Cheapest available (unfilled, in-stock) miner listing.
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
      weeks: mining?.weeksOfMinerLifeRemaining ?? null,
      image: cheapest.afterInstallPictures?.[0]?.url ?? "",
      farmName: cheapest.farmName || "Solar miner",
      region: cheapest.zone?.name ?? "",
    };
  }, [cheapest, miningScoreMap, spotPriceUsd]);

  return (
    <div className={SLIDE_GRID}>
      <SlideHeader kicker="Mining" title="Become a GLW Miner">
        The fastest way to earn GLW is to buy the Glow on the market. However,
        you can also earn GLW weekly by purchasing a miner. Each miner is
        connected to a single real-world solar farm, and collects some of the
        GLW rewards that are produced by that solar farm.
      </SlideHeader>

      <div className="flex lg:col-span-2">
        {card ? (
          // The cheapest live miner, in the launchpad miner-card layout.
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
                <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--color-miner)]/50 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur-xl sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs dark:bg-black/60 dark:text-white">
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
                    Price
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
                      Est. weekly
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
                      for {Math.round(card.weeks)} weeks
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
                      } as TaggedAuctionApplication,
                      card.scoreData,
                      "USDC",
                    )
                  }
                >
                  Buy miner
                  <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // No miners available right now.
          <div className="flex h-full min-h-[280px] w-full flex-col items-center justify-center gap-3 rounded-3xl border border-border/15 bg-muted/10 p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40 dark:bg-white/[0.06]">
              <CashMinerIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground">
                No miners available right now
              </span>
              <p className="text-pretty text-sm text-muted-foreground">
                Miners sell out fast — new ones are refilled soon. Check back
                shortly.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "Learn More" — live protocol metrics + the featured blog post, side by side.
 * No title (the page eyebrow says LEARN MORE). Section body only.
 */
export function LearnMoreSection() {
  return (
    <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[3fr_2fr]">
      <WidgetErrorBoundary>
        <ProtocolMetricsWidget className="w-full" showChart={false} />
      </WidgetErrorBoundary>
      <WidgetErrorBoundary>
        <BlogFeaturedWidget className="w-full" />
      </WidgetErrorBoundary>
    </div>
  );
}

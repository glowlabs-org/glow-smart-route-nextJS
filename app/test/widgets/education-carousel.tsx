"use client";

/**
 * Education carousel — the logged-out "learn how Glow works" walkthrough.
 *
 * Five numbered slides: explanatory copy on the left, a rich full-height
 * surface on the right that reuses the live dashboard widgets (GLW price,
 * launchpad countdown, points shop, leaderboard, stats, blog). Every slide is
 * stretched to the same height by embla and fills it so none read as empty.
 *
 * Copy lives in `lib/i18n` under `widgets.educationCarousel`.
 */

import React from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { useGlowSpotPriceSummary } from "@/hooks/useGlowSpotPriceSummary";
import { PointsShopIcon } from "@/components/impact-icons";
import { GlowSymbol } from "@/components/glow-symbol";
import { WidgetErrorBoundary } from "@/components/widget-error-boundary";
import LaunchpadStatusWidget from "./launchpad-status-widget";
import BlogFeaturedWidget from "./blog-featured-widget";
import ProtocolMetricsWidget from "./protocol-metrics-widget";

const DEFINED_POOL_ACTIVITY_URL =
  "https://www.defined.fi/eth/0x6fa09ffc45f1ddc95c1bc192956717042f142c5d";

interface EducationCarouselProps {
  onBuyGlowClick: () => void;
  onPayDeposit: React.ComponentProps<
    typeof LaunchpadStatusWidget
  >["onPayDeposit"];
  isApproaching: boolean;
}

/** Numbered eyebrow + heading + body — the left column of each slide. */
function SlideHeader({
  step,
  kicker,
  title,
  children,
  className,
}: {
  step: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col justify-center gap-5", className)}>
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground font-mono text-xs font-semibold text-background">
          {step}
        </span>
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
          {kicker}
        </span>
      </div>
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
const PANEL =
  "rounded-3xl border border-border/15 dark:border-white/10";
const LINK_CARD = cn(
  PANEL,
  "group flex flex-col justify-center gap-5 bg-muted/10 p-7 transition-[background-color,border-color,scale] duration-200 ease-out hover:border-border/30 hover:bg-muted/30 active:scale-[0.98] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]",
);

export default function EducationCarousel({
  onBuyGlowClick,
  onPayDeposit,
  isApproaching,
}: EducationCarouselProps) {
  const { t } = useLang();
  const ec = t.widgets.educationCarousel;

  const { spotPriceUsd } = useGlowSpotPriceSummary();
  const priceLabel =
    spotPriceUsd > 0
      ? `$${spotPriceUsd.toFixed(spotPriceUsd < 1 ? 3 : 2)}`
      : "--";

  const [api, setApi] = React.useState<CarouselApi>();
  const [selected, setSelected] = React.useState(0);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;
    const sync = () => {
      setCount(api.scrollSnapList().length);
      setSelected(api.selectedScrollSnap());
    };
    sync();
    api.on("select", sync);
    api.on("reInit", sync);
    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
    };
  }, [api]);

  return (
    <div>
      <Carousel setApi={setApi} opts={{ loop: true }}>
        <CarouselContent>
          {/* 1 — Buy GLW */}
          <Slide>
            <div className={SLIDE_GRID}>
              <SlideHeader
                step="01"
                kicker={ec.slides.token.kicker}
                title={ec.slides.token.title}
              >
                {ec.slides.token.body}
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
                      {ec.glwPriceLabel}
                    </span>
                  </div>
                  <a
                    href={DEFINED_POOL_ACTIVITY_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {ec.priceChart}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-5xl font-bold tracking-tight tabular-nums text-foreground sm:text-6xl">
                    {priceLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ec.glwPriceSubtext}
                  </span>
                </div>
                <Button
                  size="lg"
                  className="w-full font-medium"
                  onClick={onBuyGlowClick}
                >
                  {t.widgets.launchpadStatus.buyGlw}
                </Button>
              </div>
            </div>
          </Slide>

          {/* 2 — Delegate GLW to Solar Farms */}
          <Slide>
            <div className={SLIDE_GRID}>
              <SlideHeader
                step="02"
                kicker={ec.slides.delegation.kicker}
                title={ec.slides.delegation.title}
              >
                {ec.slides.delegation.body}
              </SlideHeader>
              <div className="flex h-full flex-col gap-3 lg:col-span-2">
                <div className="min-h-0 flex-1">
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
                <Link
                  href="/marketplace"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border/20 px-4 py-2.5 text-sm font-medium text-foreground transition-[background-color,scale] duration-200 ease-out hover:bg-muted/40 active:scale-[0.97] dark:border-white/10"
                >
                  {ec.launchpadCta}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Slide>

          {/* 3 — Earn Points, and Impact */}
          <Slide>
            <div className="flex flex-1 items-center">
              <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
                <SlideHeader
                  step="03"
                  kicker={ec.slides.rewards.kicker}
                  title={ec.slides.rewards.title}
                >
                  {ec.slides.rewards.body}
                </SlideHeader>
                <Link href="/shop" className={LINK_CARD}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
                    <PointsShopIcon className="h-6 w-6 text-amber-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-lg font-semibold text-foreground">
                      {ec.pointsShopTitle}
                    </span>
                    <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                      {ec.pointsShopDesc}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                    {ec.pointsShopCta}
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
                <Link href="/leaderboard" className={LINK_CARD}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                    <Trophy className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-lg font-semibold text-foreground">
                      {ec.leaderboardTitle}
                    </span>
                    <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                      {ec.leaderboardDesc}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {ec.leaderboardCta}
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </div>
            </div>
          </Slide>

          {/* 4 — Become a GLW Miner */}
          <Slide>
            <div className={SLIDE_GRID}>
              <SlideHeader
                step="04"
                kicker={ec.slides.mining.kicker}
                title={ec.slides.mining.title}
              >
                {ec.slides.mining.body}
              </SlideHeader>
              <div className="flex h-full flex-col gap-3 lg:col-span-2">
                <div className="min-h-0 flex-1">
                  <WidgetErrorBoundary>
                    <LaunchpadStatusWidget
                      className="h-full w-full"
                      variant="minimal"
                      forcedType="miners"
                      isApproaching={isApproaching}
                      onPayDeposit={onPayDeposit}
                    />
                  </WidgetErrorBoundary>
                </div>
                <Link
                  href="/marketplace"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border/20 px-4 py-2.5 text-sm font-medium text-foreground transition-[background-color,scale] duration-200 ease-out hover:bg-muted/40 active:scale-[0.97] dark:border-white/10"
                >
                  {ec.minersCta}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Slide>

          {/* 5 — Learn More */}
          <Slide>
            <div className="flex flex-1 flex-col gap-8">
              <SlideHeader
                step="05"
                kicker={ec.slides.resources.kicker}
                title={ec.slides.resources.title}
                className="gap-3"
              >
                {ec.slides.resources.body}
              </SlideHeader>
              <div className="grid flex-1 grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
                <WidgetErrorBoundary>
                  <ProtocolMetricsWidget className="w-full" showChart={false} />
                </WidgetErrorBoundary>
                <WidgetErrorBoundary>
                  <BlogFeaturedWidget className="w-full" />
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
              onClick={() => api?.scrollTo(index)}
              aria-label={ec.goToSlide(index + 1)}
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
            onClick={() => api?.scrollPrev()}
            aria-label={ec.previousSlide}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => api?.scrollNext()}
            aria-label={ec.nextSlide}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

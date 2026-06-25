"use client";

/**
 * Live Solar Farms — a responsive, page-scrollable grid of every farm that has
 * gone live, sorted by installed watts (largest first). Replaces the old
 * two-per-slide carousel so users can scroll one long, dense gallery of real
 * solar farms. Section body only (no outer card).
 *
 * Data comes from the protocol-wide impact endpoint (`useV2ImpactFarms` →
 * `/api/impact/farms`). The endpoint carries no per-farm photo for every farm
 * yet, so cards fall back to bundled on-brand solar photos.
 */

import * as React from "react";

import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { FallbackImage } from "@/components/ui/fallback-image";
import { Skeleton } from "@/components/ui/skeleton";
import { type LiveFarm } from "@/lib/mock/live-farms-mock";
import { useV2ImpactFarms } from "@/hooks/v2-impact";

const PANEL = "rounded-3xl border border-border/15 dark:border-white/10";
const EYEBROW =
  "text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60";
const IMG_OUTLINE =
  "outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10";

// Bundled on-brand solar photos; the impact endpoint has no per-farm photo for
// every farm yet, so cards rotate through these where one is missing.
const FARM_PHOTOS = [
  "/images/sections/panels-array.jpg",
  "/images/sections/flat-field.jpg",
  "/images/sections/residential.jpg",
];

function formatWatts(watts: number): string {
  if (!Number.isFinite(watts) || watts <= 0) return "0 W";
  if (watts >= 1_000_000)
    return `${(watts / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })} MW`;
  if (watts >= 1_000)
    return `${(watts / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} kW`;
  return `${Math.round(watts).toLocaleString()} W`;
}

function formatCo2(tons: number): string {
  if (!Number.isFinite(tons) || tons <= 0) return "0 t CO₂";
  return `${tons.toLocaleString("en-US", { maximumFractionDigits: tons < 100 ? 1 : 0 })} t CO₂`;
}

const LIVE_SINCE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

function formatLiveSince(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return LIVE_SINCE_FMT.format(date);
}

const FarmCard = React.memo(function FarmCard({ farm }: { farm: LiveFarm }) {
  const { t } = useLang();
  return (
    <div
      className={cn(
        PANEL,
        // Outer radius (rounded-3xl) = inner photo radius (rounded-2xl) + p-3.
        "group flex flex-col gap-4 bg-card p-3 transition-[background-color,border-color,transform] duration-200 ease-out hover:border-border/30 hover:-translate-y-0.5 active:scale-[0.98] dark:bg-white/[0.03]",
      )}
    >
      <div className="relative w-full overflow-hidden rounded-2xl">
        <div className="aspect-[16/9] w-full">
          {/* Right-sized for the ~330px grid card (covers 2× retina). Lazy +
              async-decoded so a 100+ card grid never blocks the main thread;
              the proxied URL is deterministic, so the CDN/browser caches it. */}
          <FallbackImage
            src={farm.photoUrl}
            widthForProxy={560}
            quality={80}
            alt={`${farm.name} solar farm`}
            loading="lazy"
            decoding="async"
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className={cn(
              "h-full w-full rounded-2xl object-cover transition-transform duration-500 group-hover:scale-[1.03]",
              IMG_OUTLINE,
            )}
          />
        </div>
        <span
          className={cn(
            EYEBROW,
            "absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 backdrop-blur-sm",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          {t.onboarding.liveFarms.live}
        </span>
      </div>

      <div className="flex flex-col gap-2 px-2 pb-1">
        <h4 className="text-balance text-base font-semibold leading-tight tracking-tight text-foreground">
          {farm.name}
        </h4>
        <div className="flex items-baseline gap-1.5 text-sm font-medium text-foreground">
          <span className="tabular-nums">{formatWatts(farm.watts)}</span>
          <span className="text-muted-foreground/40" aria-hidden>
            ·
          </span>
          <span className="tabular-nums text-muted-foreground">
            {formatCo2(farm.tonsCo2)}
          </span>
        </div>
        <p className="text-pretty text-xs text-muted-foreground/70">
          {farm.region}
          {farm.liveSince
            ? ` · ${t.onboarding.liveFarms.liveSince(formatLiveSince(farm.liveSince))}`
            : ""}
        </p>
      </div>
    </div>
  );
});

function FarmCardSkeleton() {
  return (
    <div className={cn(PANEL, "flex flex-col gap-4 bg-card p-3 dark:bg-white/[0.03]")}>
      <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
      <div className="flex flex-col gap-2 px-2 pb-1">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

const GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

// How many cards mount per batch. The first batch paints immediately; the rest
// reveal as the user scrolls, so a 100+ farm grid never mounts all at once.
const BATCH_SIZE = 24;

export default function LiveSolarFarmsGrid() {
  const { t } = useLang();
  const { data, isLoading } = useV2ImpactFarms();

  // Live protocol-wide farms straight from the impact endpoint, largest first.
  const farms = React.useMemo<LiveFarm[]>(() => {
    const rows = data?.rows;
    if (!rows) return [];
    return rows
      .map((r, i) => ({
        id: r.farmId,
        name: r.name,
        region: r.zoneName || r.regionFullName || r.region,
        photoUrl: r.photoUrl || FARM_PHOTOS[i % FARM_PHOTOS.length]!,
        watts: Number(r.totalWatts) || 0,
        tonsCo2: Number(r.totalCarbonCredits) || 0,
        liveSince: r.fundedAt ?? "",
      }))
      .sort((a, b) => b.watts - a.watts);
  }, [data]);

  const totals = React.useMemo(() => {
    return farms.reduce(
      (acc, f) => {
        acc.watts += f.watts;
        acc.tonsCo2 += f.tonsCo2;
        return acc;
      },
      { watts: 0, tonsCo2: 0 },
    );
  }, [farms]);

  // Progressive reveal: mount the first batch, then more as the user scrolls.
  const [visibleCount, setVisibleCount] = React.useState(BATCH_SIZE);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Reset the window when the farm set changes (e.g. data finishes loading).
  React.useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [farms.length]);

  React.useEffect(() => {
    if (visibleCount >= farms.length) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) =>
            Math.min(count + BATCH_SIZE, farms.length),
          );
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, farms.length]);

  if (isLoading && farms.length === 0) {
    return (
      <div className={GRID}>
        {Array.from({ length: 8 }).map((_, i) => (
          <FarmCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (farms.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t.onboarding.liveFarms.empty}
      </p>
    );
  }

  const visibleFarms = farms.slice(0, visibleCount);
  const hasMore = visibleCount < farms.length;

  return (
    <div className="flex flex-col gap-8">
      {/* Summary — gives the long grid a sense of scale before you scroll. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className={EYEBROW}>
          {t.onboarding.liveFarms.countLine(farms.length)}
        </span>
        <div className="flex items-baseline gap-4 text-sm font-medium tabular-nums text-foreground">
          <span>
            {formatWatts(totals.watts)}{" "}
            <span className="font-normal text-muted-foreground">
              {t.onboarding.liveFarms.installed}
            </span>
          </span>
          <span className="text-muted-foreground/30" aria-hidden>
            ·
          </span>
          <span>
            {formatCo2(totals.tonsCo2)}{" "}
            <span className="font-normal text-muted-foreground">
              {t.onboarding.liveFarms.offset}
            </span>
          </span>
        </div>
      </div>

      <div className={GRID}>
        {visibleFarms.map((farm) => (
          <FarmCard key={farm.id} farm={farm} />
        ))}
      </div>

      {/* Sentinel — entering the viewport reveals the next batch. */}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center gap-2 py-2 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50"
        >
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/40"
            aria-hidden
          />
          {t.onboarding.liveFarms.showing(visibleCount, farms.length)}
        </div>
      )}
    </div>
  );
}

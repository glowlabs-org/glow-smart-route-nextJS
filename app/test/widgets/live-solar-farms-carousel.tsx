"use client";

/**
 * Live Solar Farms carousel — a scannable gallery of farms that have gone live,
 * two per slide, sorted by installed watts (largest first). Renders the SECTION
 * BODY ONLY (no outer card) so it can drop into any surface.
 *
 * Data comes from the protocol-wide impact endpoint (`useV2ImpactFarms` →
 * `/api/impact/farms` → `impact-v2/farms`). The endpoint carries no per-farm
 * photo yet, so the cards rotate through bundled solar photos. Embla wiring,
 * dots + arrow controls, and the eyebrow/border conventions mirror
 * `education-carousel`.
 */

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { FallbackImage } from "@/components/ui/fallback-image";
import { type LiveFarm } from "@/lib/mock/live-farms-mock";
import { useV2ImpactFarms } from "@/hooks/v2-impact";

const PANEL = "rounded-3xl border border-border/15 dark:border-white/10";
const EYEBROW =
  "text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60";
const IMG_OUTLINE =
  "outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10";

// Bundled on-brand solar photos; the impact endpoint has no per-farm photo yet,
// so cards rotate through these for both live and mock data.
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

/** Chunk the sorted farms into pairs so each slide shows two cards (last may hold one). */
function pairFarms(farms: readonly LiveFarm[]): LiveFarm[][] {
  const pairs: LiveFarm[][] = [];
  for (let i = 0; i < farms.length; i += 2) {
    pairs.push(farms.slice(i, i + 2));
  }
  return pairs;
}

function FarmCard({ farm }: { farm: LiveFarm }) {
  return (
    <div
      className={cn(
        PANEL,
        // Outer radius (rounded-3xl) = inner photo radius (rounded-2xl) + p-3.
        "group flex flex-col gap-4 bg-card p-3 transition-[background-color,border-color,scale] duration-200 ease-out hover:border-border/30 active:scale-[0.98] dark:bg-white/[0.03]",
      )}
    >
      <div className="relative w-full overflow-hidden rounded-2xl">
        <div className="aspect-[16/9] w-full">
          {/* Real farm photo (R2) via the image proxy, with a bundled solar
              photo fallback — the same FallbackImage path the launchpad cards
              use. */}
          <FallbackImage
            src={farm.photoUrl}
            widthForProxy={800}
            quality={85}
            alt={`${farm.name} solar farm`}
            loading="lazy"
            className={cn("h-full w-full rounded-2xl object-cover", IMG_OUTLINE)}
          />
        </div>
        <span
          className={cn(
            EYEBROW,
            "absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 backdrop-blur-sm",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          Live
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
            ? ` · Live since ${formatLiveSince(farm.liveSince)}`
            : ""}
        </p>
      </div>
    </div>
  );
}

export default function LiveSolarFarmsCarousel() {
  const { data } = useV2ImpactFarms();

  // Live protocol-wide farms straight from the impact endpoint.
  const farms = React.useMemo<LiveFarm[]>(() => {
    const rows = data?.rows;
    if (!rows) return [];
    return rows.map((r, i) => ({
      id: r.farmId,
      name: r.name,
      region: r.zoneName || r.regionFullName || r.region,
      photoUrl: r.photoUrl || FARM_PHOTOS[i % FARM_PHOTOS.length]!,
      watts: Number(r.totalWatts) || 0,
      tonsCo2: Number(r.totalCarbonCredits) || 0,
      liveSince: r.fundedAt ?? "",
    }));
  }, [data]);

  const slides = React.useMemo(
    () => pairFarms([...farms].sort((a, b) => b.watts - a.watts)),
    [farms],
  );

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
      <Carousel setApi={setApi} opts={{ loop: true, align: "start" }}>
        <CarouselContent className="-ml-4">
          {slides.map((pair, index) => (
            <CarouselItem
              key={index}
              className="basis-full border-0 bg-transparent pl-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {pair.map((farm) => (
                  <FarmCard key={farm.id} farm={farm} />
                ))}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Controls — progress bar + counter + arrows. A bar scales to any farm
          count (134 farms = 67 slides would overflow a dot row). Drives embla
          directly via the api since the shadcn CarouselPrevious/Next render
          literal text labels. */}
      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* left spacer keeps the centre column truly centred */}
        <div aria-hidden />
        <div className="flex items-center justify-center gap-3">
          <div
            className="relative h-2 w-48 overflow-hidden rounded-full bg-muted-foreground/15 sm:w-64"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={count || 1}
            aria-valuenow={count > 0 ? selected + 1 : 0}
            aria-label="Live solar farms position"
          >
            <div
              className="h-full w-full origin-left rounded-full bg-foreground transition-transform duration-300 ease-out"
              style={{
                transform: `scaleX(${count > 0 ? (selected + 1) / count : 0})`,
              }}
            />
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {count > 0 ? selected + 1 : 0} / {count}
          </span>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => api?.scrollPrev()}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => api?.scrollNext()}
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

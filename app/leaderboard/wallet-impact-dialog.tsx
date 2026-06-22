"use client";

import * as React from "react";
import {
  MapPin,
  Sun,
  Zap,
  Leaf,
  TreePine,
  Home,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { FarmImagesBatchResponse } from "@glowlabs-org/utils/browser";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FallbackImage from "@/components/ui/fallback-image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { formatNumber } from "@/utils/format";
import { formatAddress, cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { useRegions } from "@/hooks/control-regions";
import { useV2ImpactWallet } from "@/hooks/v2-impact";
import { trackEvent } from "@/lib/telemetry";

function XLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface WalletImpactDialogProps {
  /** Wallet to show impact details for; `null` keeps the dialog closed. */
  wallet: string | null;
  /** Optional ENS name resolved by the leaderboard, shown in the header. */
  ensName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** parseFloat is fine here — these strings are only used for display. */
function fmt(value: string | null | undefined, decimals = 2): string {
  if (value == null) return "—";
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return "—";
  return formatNumber(n, { maximumFractionDigits: decimals });
}

function num(value: string | null | undefined): number {
  if (value == null) return 0;
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

// Real-world equivalence constants (kept loose on purpose — these are
// "≈" estimates shown next to the hard numbers).
const CO2_KG_PER_TREE_YEAR = 21.77; // ~48 lbs CO2/yr absorbed by a mature tree
const HOMES_PER_WATT = 190 / 1_000_000; // SEIA: ~190 homes per MW of solar
const WATTS_PER_LED_BULB = 10;

function StatTile({
  icon: Icon,
  label,
  value,
  approx,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  approx?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/30 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground/70">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em]">
          {label}
        </p>
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-foreground">
        {approx ? <span className="text-muted-foreground">≈ </span> : null}
        {value}
      </p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-[13px] font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {count != null ? (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
            {count}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** Two-up stat strip shown under each card image. */
function CardStats({
  wattsLabel,
  wattsValue,
  carbonLabel,
  carbonValue,
}: {
  wattsLabel: string;
  wattsValue: string;
  carbonLabel: string;
  carbonValue: string;
}) {
  return (
    <div className="grid grid-cols-2 divide-x divide-border/40 border-t border-border/40">
      <div className="px-3 py-2">
        <p className="text-[9px] uppercase tracking-wide text-muted-foreground/70">
          {wattsLabel}
        </p>
        <p className="mt-0.5 truncate text-[13px] font-semibold tabular-nums">
          {wattsValue}
        </p>
      </div>
      <div className="px-3 py-2">
        <p className="text-[9px] uppercase tracking-wide text-muted-foreground/70">
          {carbonLabel}
        </p>
        <p className="mt-0.5 truncate text-[13px] font-semibold tabular-nums">
          {carbonValue}
        </p>
      </div>
    </div>
  );
}

const CARD_CLASS =
  "group overflow-hidden rounded-lg border border-border/40 bg-background";
const CARD_IMAGE_WRAP = "relative aspect-[16/9] w-full overflow-hidden";
const CARD_OVERLAY =
  "absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent";

/**
 * Carousel with small arrow buttons + dot pagination, used when there are
 * more region cards than comfortably fit in a single row.
 */
function RegionCarousel({ children }: { children: React.ReactNode }) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [selected, setSelected] = React.useState(0);
  const [snaps, setSnaps] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (!api) return;
    const update = () => {
      setSnaps(api.scrollSnapList());
      setSelected(api.selectedScrollSnap());
    };
    update();
    api.on("select", update);
    api.on("reInit", update);
    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

  const arrowClass =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div>
      <Carousel opts={{ align: "start" }} setApi={setApi} className="w-full">
        {/* py-1 gives the cards vertical breathing room so the viewport's
            overflow-hidden doesn't clip their rounded top/bottom corners. */}
        <CarouselContent className="-ml-3 py-1">{children}</CarouselContent>
      </Carousel>
      {snaps.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Previous"
            className={arrowClass}
            onClick={() => api?.scrollPrev()}
            disabled={!api?.canScrollPrev()}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {snaps.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to page ${i + 1}`}
                onClick={() => api?.scrollTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === selected
                    ? "w-4 bg-foreground"
                    : "w-1.5 bg-border hover:bg-foreground/40",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next"
            className={arrowClass}
            onClick={() => api?.scrollNext()}
            disabled={!api?.canScrollNext()}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function WalletImpactDialog({
  wallet,
  ensName,
  open,
  onOpenChange,
}: WalletImpactDialogProps) {
  const { t } = useLang();
  const lb = t.routes.impactLeaderboard;
  const query = useV2ImpactWallet(open ? wallet : null);
  const { regions } = useRegions();

  const data = query.data;

  const regionById = React.useMemo(() => {
    const map = new Map<number, (typeof regions)[number]>();
    for (const r of regions) map.set(r.id, r);
    return map;
  }, [regions]);

  const regionName = React.useCallback(
    (regionId: number): string =>
      regionById.get(regionId)?.name ?? lb.v2RegionFallback(String(regionId)),
    [regionById, lb],
  );

  // Merge the per-region watts + carbon (stored as "policy credits") arrays
  // into one row per region for the region grid, sorted by watts.
  const regionRows = React.useMemo(() => {
    if (!data) return [];
    const wattsByRegion = new Map(
      data.wattsByRegion.map((r) => [r.regionId, r.watts]),
    );
    const carbonByRegion = new Map(
      data.policyCreditsByRegion.map((r) => [r.regionId, r.policyCredits]),
    );
    const ids = new Set<number>([
      ...wattsByRegion.keys(),
      ...carbonByRegion.keys(),
    ]);
    return Array.from(ids)
      .map((regionId) => ({
        regionId,
        watts: wattsByRegion.get(regionId) ?? "0",
        carbon: carbonByRegion.get(regionId) ?? "0",
      }))
      .sort((a, b) => num(b.watts) - num(a.watts));
  }, [data]);

  const farmRows = React.useMemo(() => {
    if (!data) return [];
    return [...data.farms].sort((a, b) => num(b.wattsTotal) - num(a.wattsTotal));
  }, [data]);

  // Farm breakdown can be filtered by region. Reset when the wallet changes.
  const [regionFilter, setRegionFilter] = React.useState<string>("all");
  React.useEffect(() => {
    setRegionFilter("all");
  }, [wallet]);

  const farmRegionOptions = React.useMemo(() => {
    const ids = Array.from(new Set(farmRows.map((f) => f.regionId)));
    return ids
      .map((id) => ({ id, name: regionName(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [farmRows, regionName]);

  const visibleFarms = React.useMemo(() => {
    if (regionFilter === "all") return farmRows;
    const id = Number(regionFilter);
    return farmRows.filter((f) => f.regionId === id);
  }, [farmRows, regionFilter]);

  // Friendly real-world equivalents for the header.
  const equiv = React.useMemo(() => {
    const watts = num(data?.totalWatts);
    const carbon = num(data?.totalCarbonCredits);
    const trees = Math.round((carbon * 1000) / CO2_KG_PER_TREE_YEAR);
    const homes = watts * HOMES_PER_WATT;
    return {
      trees,
      homes: Math.round(homes),
      bulbs: Math.round(watts / WATTS_PER_LED_BULB),
      showHomes: homes >= 1,
    };
  }, [data]);

  const farmIds = React.useMemo(
    () => farmRows.map((f) => f.farmId),
    [farmRows],
  );

  // Farm names + images come from the control API in one batch.
  const farmImagesQuery = useQuery({
    queryKey: ["wallet-impact-farm-images", farmIds],
    enabled: open && farmIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch("/api/farms/images-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmIds }),
      });
      if (!res.ok) throw new Error(`Failed to fetch farm images: ${res.status}`);
      return (await res.json()) as FarmImagesBatchResponse;
    },
  });

  const farmMeta = React.useCallback(
    (farmId: string) => farmImagesQuery.data?.results?.[farmId],
    [farmImagesQuery.data],
  );

  const handleShareOnX = React.useCallback(() => {
    if (typeof window === "undefined" || !data) return;
    const text = [
      "My real-world solar impact on @GlowFND ☀️",
      "",
      `⚡ ${fmt(data.totalWatts, 0)} watts of clean energy`,
      `🌱 ${fmt(data.totalCarbonCredits, 0)} tons of CO₂ (≈ ${fmt(
        String(equiv.trees),
        0,
      )} trees)`,
      "",
      "#Glow",
    ].join("\n");
    const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(
      text,
    )}&url=${encodeURIComponent("https://app.glow.org/leaderboard")}`;
    window.open(intent, "_blank", "noopener,noreferrer");
    trackEvent("wallet_impact_share_x", { wallet_address: wallet ?? null });
  }, [data, equiv, wallet]);

  const renderRegionCard = (r: (typeof regionRows)[number]) => {
    const region = regionById.get(r.regionId);
    return (
      <div className={CARD_CLASS}>
        <div className={CARD_IMAGE_WRAP}>
          <FallbackImage
            src={region?.bannerUrl ?? ""}
            alt={regionName(r.regionId)}
            loading="lazy"
            decoding="async"
            disableProxy
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className={CARD_OVERLAY} />
          <div className="absolute inset-x-2.5 bottom-2">
            <p className="line-clamp-1 text-[13px] font-semibold text-white drop-shadow-sm">
              {regionName(r.regionId)}
            </p>
          </div>
        </div>
        <CardStats
          wattsLabel={lb.v2WalletColWatts}
          wattsValue={`${fmt(r.watts)} ${lb.v2WalletWattsUnit}`}
          carbonLabel={lb.v2WalletCarbonCredits}
          carbonValue={fmt(r.carbon)}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-card sm:max-w-[min(56rem,calc(100%-4rem))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <DialogTitle>{lb.v2WalletTitle}</DialogTitle>
            {data && data.farms.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleShareOnX}
                className="h-7 w-fit gap-1.5 rounded-full px-2.5 text-xs font-medium"
              >
                <XLogo className="h-3 w-3" />
                {lb.v2WalletShareOnX}
              </Button>
            ) : null}
          </div>
          <DialogDescription className="font-mono text-xs">
            {ensName ?? (wallet ? formatAddress(wallet) : "")}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        ) : query.isError ? (
          <p className="py-6 text-sm text-muted-foreground">
            {lb.v2WalletError}
          </p>
        ) : !data || data.farms.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            {lb.v2WalletEmpty}
          </p>
        ) : (
          <div className="space-y-6 py-1">
              {/* Totals + real-world equivalents */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <StatTile
                  icon={Zap}
                  label={lb.v2WalletTotalWatts}
                  value={fmt(data.totalWatts)}
                />
                <StatTile
                  icon={Leaf}
                  label={lb.v2WalletCarbonCredits}
                  value={fmt(data.totalCarbonCredits)}
                />
                <StatTile
                  icon={TreePine}
                  label={lb.v2WalletTrees}
                  value={fmt(String(equiv.trees), 0)}
                  approx
                />
                {equiv.showHomes ? (
                  <StatTile
                    icon={Home}
                    label={lb.v2WalletHomes}
                    value={fmt(String(equiv.homes), 0)}
                    approx
                  />
                ) : (
                  <StatTile
                    icon={Lightbulb}
                    label={lb.v2WalletBulbs}
                    value={fmt(String(equiv.bulbs), 0)}
                    approx
                  />
                )}
              </div>

              {/* Impact by region — one card per region with its image */}
              {regionRows.length > 0 ? (
                <section>
                  <SectionHeader
                    icon={MapPin}
                    title={lb.v2WalletByRegion}
                    count={regionRows.length}
                  />
                  {regionRows.length > 5 ? (
                    <RegionCarousel>
                      {regionRows.map((r) => (
                        <CarouselItem
                          key={`region-${r.regionId}`}
                          className="basis-1/2 border-0 bg-transparent pl-3 sm:basis-1/4"
                        >
                          {renderRegionCard(r)}
                        </CarouselItem>
                      ))}
                    </RegionCarousel>
                  ) : (
                    <div
                      className="grid grid-cols-3 gap-2.5 sm:grid-cols-[repeat(var(--region-cols),minmax(0,1fr))]"
                      style={
                        {
                          "--region-cols": regionRows.length,
                        } as React.CSSProperties
                      }
                    >
                      {regionRows.map((r) => (
                        <React.Fragment key={`region-${r.regionId}`}>
                          {renderRegionCard(r)}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {/* Farm breakdown — one card per farm with its photo + name */}
              <section>
                <SectionHeader
                  icon={Sun}
                  title={lb.v2WalletFarmBreakdown}
                  count={visibleFarms.length}
                >
                  {farmRegionOptions.length > 1 ? (
                    <Select value={regionFilter} onValueChange={setRegionFilter}>
                      <SelectTrigger className="h-8 w-[170px] text-xs">
                        <SelectValue placeholder={lb.v2AllRegions} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{lb.v2AllRegions}</SelectItem>
                        {farmRegionOptions.map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </SectionHeader>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
                  {visibleFarms.map((f) => {
                    const meta = farmMeta(f.farmId);
                    const name =
                      meta?.name ??
                      (f.farmId.length > 14
                        ? `${f.farmId.slice(0, 10)}…`
                        : f.farmId);
                    return (
                      <div key={f.farmId} className={CARD_CLASS}>
                        <div className={CARD_IMAGE_WRAP}>
                          <FallbackImage
                            src={meta?.imageUrl ?? ""}
                            alt={name}
                            loading="lazy"
                            decoding="async"
                            widthForProxy={400}
                            quality={80}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                          <div className={CARD_OVERLAY} />
                          <div className="absolute inset-x-2.5 bottom-2">
                            <p className="line-clamp-1 text-[13px] font-semibold text-white drop-shadow-sm">
                              {name}
                            </p>
                            <p className="line-clamp-1 text-[11px] text-white/75">
                              {regionName(f.regionId)}
                            </p>
                          </div>
                        </div>
                        <CardStats
                          wattsLabel={lb.v2WalletColWatts}
                          wattsValue={`${fmt(f.wattsTotal)} ${lb.v2WalletWattsUnit}`}
                          carbonLabel={lb.v2WalletCarbonCredits}
                          carbonValue={fmt(f.carbonCredits)}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              {data.updatedAt ? (
                <p className="text-[11px] text-muted-foreground">
                  {lb.v2WalletUpdated(
                    new Date(data.updatedAt).toLocaleString(),
                  )}
                </p>
              ) : null}
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

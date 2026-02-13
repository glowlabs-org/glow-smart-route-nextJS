"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import {
  Map as UiMap,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  type MapRef,
} from "@/components/ui/map";
import {
  usePolFarmLocations,
  type PolFarmLocationRow,
} from "@/hooks/usePolFarmLocations";

const ZONE_COLORS: Record<string, string> = {
  "Clean Grid Project": "#34d399",
  "Golden Colorado": "#22d3ee",
  "Noble Oklahoma": "#f43f5e",
  "Rising Utah": "#60a5fa",
  "Shining Missouri": "#f59e0b",
};

const FALLBACK_COLORS = [
  "#34d399",
  "#22d3ee",
  "#60a5fa",
  "#f59e0b",
  "#f43f5e",
] as const;

const ZONE_ID_TO_NAME: Record<number, string> = {
  1: "Clean Grid Project",
  2: "Golden Colorado",
  3: "Noble Oklahoma",
  4: "Rising Utah",
  5: "Shining Missouri",
};

const ZONE_SHORT_LABELS: Record<string, string> = {
  "Clean Grid Project": "CGP",
  "Golden Colorado": "CO",
  "Noble Oklahoma": "OK",
  "Rising Utah": "UT",
  "Shining Missouri": "MO",
  Unassigned: "UN",
};

const COARSE_CLUSTER_STEP_DEGREES = 0.4;
const US_FILTER_KEY = "__US__";
const DEFAULT_US_CENTER: [number, number] = [-98.5, 39.8];
const DEFAULT_US_ZOOM = 2.3;
const CARTO_LIGHT_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const CARTO_DARK_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

type MapCluster = {
  id: string;
  lat: number;
  lng: number;
  bounds: [[number, number], [number, number]];
  zoneName: string;
  color: string;
  farmCount: number;
  panels: number;
  radius: number;
  tooltip: string;
};

type ZoneLegendItem = {
  zoneName: string;
  zoneShort: string;
  color: string;
  clusterCount: number;
  farmCount: number;
};
type PositionedFarm = PolFarmLocationRow & { lat: number; lng: number };

interface ImpactTotals {
  panels: number | null;
  totalFarms: number | null;
  capacityMw: number | null;
  homesPowered: number | null;
  trees: number | null;
}

interface NetworkImpactSectionProps {
  impactTotals: ImpactTotals | null;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatWholeNumber(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatCompactNumber(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatFixed(value: number | null | undefined, digits: number): string {
  if (!isFiniteNumber(value)) return "—";
  return value.toFixed(digits);
}

function resolveZoneName(zoneName: string | null, zoneId: number | null): string {
  if (zoneName && zoneName.trim().length > 0) return zoneName.trim();
  if (zoneId !== null && ZONE_ID_TO_NAME[zoneId]) return ZONE_ID_TO_NAME[zoneId];
  return "Unassigned";
}

function zoneColor(zoneName: string, fallbackIndex: number): string {
  return ZONE_COLORS[zoneName] ?? FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
}

function zoneShortLabel(zoneName: string): string {
  return ZONE_SHORT_LABELS[zoneName] ?? zoneName.slice(0, 2).toUpperCase();
}

function isUsCoordinate(lat: number, lng: number): boolean {
  // Includes continental US + Alaska + Hawaii bounds.
  return lat >= 18 && lat <= 72 && lng >= -170 && lng <= -50;
}

function clusterStepForZoom(zoom: number): number {
  if (zoom >= 5.4) return 0.02;
  if (zoom >= 4.8) return 0.03;
  if (zoom >= 4.2) return 0.05;
  if (zoom >= 3.6) return 0.08;
  if (zoom >= 3.0) return 0.12;
  if (zoom >= 2.4) return 0.2;
  return COARSE_CLUSTER_STEP_DEGREES;
}

function buildClusters(
  farms: PolFarmLocationRow[] | undefined,
  clusterStepDegrees: number
): MapCluster[] {
  const groups = new Map<
    string,
    {
      weightedLatSum: number;
      weightedLngSum: number;
      totalWeight: number;
      farmCount: number;
      panels: number;
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
      zoneCounts: Map<string, number>;
      zoneOrder: string[];
    }
  >();

  for (const farm of farms ?? []) {
    if (!isFiniteNumber(farm.lat) || !isFiniteNumber(farm.lng)) continue;

    const latBucket = Math.round(farm.lat / clusterStepDegrees) * clusterStepDegrees;
    const lngBucket = Math.round(farm.lng / clusterStepDegrees) * clusterStepDegrees;
    const key = `${latBucket.toFixed(2)}:${lngBucket.toFixed(2)}`;

    const panels = Math.max(0, farm.panels || 0);
    const weight = Math.max(1, panels);
    const zoneName = resolveZoneName(farm.zoneName, farm.zoneId);

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        weightedLatSum: farm.lat * weight,
        weightedLngSum: farm.lng * weight,
        totalWeight: weight,
        farmCount: 1,
        panels,
        minLat: farm.lat,
        maxLat: farm.lat,
        minLng: farm.lng,
        maxLng: farm.lng,
        zoneCounts: new Map([[zoneName, 1]]),
        zoneOrder: [zoneName],
      });
      continue;
    }

    existing.weightedLatSum += farm.lat * weight;
    existing.weightedLngSum += farm.lng * weight;
    existing.totalWeight += weight;
    existing.farmCount += 1;
    existing.panels += panels;
    existing.minLat = Math.min(existing.minLat, farm.lat);
    existing.maxLat = Math.max(existing.maxLat, farm.lat);
    existing.minLng = Math.min(existing.minLng, farm.lng);
    existing.maxLng = Math.max(existing.maxLng, farm.lng);

    const currentZoneCount = existing.zoneCounts.get(zoneName) ?? 0;
    existing.zoneCounts.set(zoneName, currentZoneCount + 1);
    if (currentZoneCount === 0) {
      existing.zoneOrder.push(zoneName);
    }
  }

  const clustered = Array.from(groups.entries()).map(([id, group], index) => {
    const dominantZone =
      group.zoneOrder
        .sort((a, b) => (group.zoneCounts.get(b) ?? 0) - (group.zoneCounts.get(a) ?? 0))[0] ??
      "Unassigned";

    const lat = group.weightedLatSum / group.totalWeight;
    const lng = group.weightedLngSum / group.totalWeight;

    return {
      id,
      lat,
      lng,
      bounds: [
        [group.minLng, group.minLat],
        [group.maxLng, group.maxLat],
      ],
      zoneName: dominantZone,
      color: zoneColor(dominantZone, index),
      farmCount: group.farmCount,
      panels: group.panels,
      radius: 0,
      tooltip: `${group.farmCount} farms · ${formatWholeNumber(group.panels)} panels`,
    } as MapCluster;
  });

  const maxPanels = Math.max(1, ...clustered.map((cluster) => cluster.panels));

  return clustered
    .map((cluster) => {
      const intensity = Math.max(0.2, cluster.panels / maxPanels);
      return {
        ...cluster,
        radius: 4 + intensity * 10,
      };
    })
    .sort((a, b) => b.panels - a.panels);
}

export function NetworkImpactSection({
  impactTotals,
}: NetworkImpactSectionProps) {
  const { data, isLoading } = usePolFarmLocations();
  const mapRef = React.useRef<MapRef | null>(null);
  const [activeZone, setActiveZone] = React.useState<string | null>(US_FILTER_KEY);
  const [mapZoom, setMapZoom] = React.useState(DEFAULT_US_ZOOM);

  const clusterStepDegrees = React.useMemo(() => clusterStepForZoom(mapZoom), [mapZoom]);
  const allClusters = React.useMemo(
    () => buildClusters(data?.farms, clusterStepDegrees),
    [data?.farms, clusterStepDegrees]
  );
  const visibleClusters = React.useMemo(() => {
    if (activeZone === US_FILTER_KEY) {
      return allClusters.filter((cluster) => isUsCoordinate(cluster.lat, cluster.lng));
    }
    if (!activeZone) return allClusters;
    return allClusters.filter((cluster) => cluster.zoneName === activeZone);
  }, [allClusters, activeZone]);
  const visibleFarmsForBounds = React.useMemo<PositionedFarm[]>(
    () =>
      (data?.farms ?? []).filter((farm): farm is PositionedFarm => {
        if (!isFiniteNumber(farm.lat) || !isFiniteNumber(farm.lng)) return false;
        if (activeZone === US_FILTER_KEY) return isUsCoordinate(farm.lat, farm.lng);
        if (!activeZone) return true;
        return resolveZoneName(farm.zoneName, farm.zoneId) === activeZone;
      }),
    [data?.farms, activeZone]
  );

  const legendZones = React.useMemo<ZoneLegendItem[]>(() => {
    const byZone = new Map<string, ZoneLegendItem>();

    for (const cluster of allClusters) {
      const existing = byZone.get(cluster.zoneName);
      if (!existing) {
        byZone.set(cluster.zoneName, {
          zoneName: cluster.zoneName,
          zoneShort: zoneShortLabel(cluster.zoneName),
          color: cluster.color,
          clusterCount: 1,
          farmCount: cluster.farmCount,
        });
        continue;
      }

      existing.clusterCount += 1;
      existing.farmCount += cluster.farmCount;
    }

    return Array.from(byZone.values()).sort((a, b) => b.farmCount - a.farmCount);
  }, [allClusters]);
  const usFarmCount = React.useMemo(
    () =>
      allClusters
        .filter((cluster) => isUsCoordinate(cluster.lat, cluster.lng))
        .reduce((sum, cluster) => sum + cluster.farmCount, 0),
    [allClusters]
  );

  const handleClusterClick = React.useCallback((cluster: MapCluster) => {
    const map = mapRef.current;
    if (!map) return;

    if (cluster.farmCount > 1) {
      const [southwest, northeast] = cluster.bounds;
      const latSpread = Math.abs(northeast[1] - southwest[1]);
      const lngSpread = Math.abs(northeast[0] - southwest[0]);

      if (latSpread < 0.025 && lngSpread < 0.025) {
        const currentZoom = map.getZoom();
        map.easeTo({
          center: [cluster.lng, cluster.lat],
          zoom: Math.min(7, currentZoom + 2.6),
          duration: 750,
          essential: true,
        });
        return;
      }

      map.fitBounds(cluster.bounds, {
        padding: 88,
        maxZoom: 6.8,
        duration: 760,
      });
      return;
    }

    const currentZoom = map.getZoom();
    map.easeTo({
      center: [cluster.lng, cluster.lat],
      zoom: Math.min(7, Math.max(2.2, currentZoom + 1.2)),
      duration: 650,
      essential: true,
    });
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!activeZone) {
      map.easeTo({
        center: [8, 22],
        zoom: 1.25,
        duration: 650,
        essential: true,
      });
      return;
    }

    if (visibleFarmsForBounds.length === 0) return;

    if (visibleFarmsForBounds.length === 1) {
      map.easeTo({
        center: [visibleFarmsForBounds[0]!.lng, visibleFarmsForBounds[0]!.lat],
        zoom: 5.2,
        duration: 650,
        essential: true,
      });
      return;
    }

    const lats = visibleFarmsForBounds.map((farm) => farm.lat);
    const lngs = visibleFarmsForBounds.map((farm) => farm.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: 72,
        maxZoom: 5.6,
        duration: 700,
      }
    );
  }, [activeZone, visibleFarmsForBounds]);

  const handleViewportChange = React.useCallback((viewport: { zoom: number }) => {
    setMapZoom((current) => (Math.abs(current - viewport.zoom) > 0.07 ? viewport.zoom : current));
  }, []);

  return (
    <section className="flex flex-col gap-6 pt-16">
      <div className="flex flex-col gap-2">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
          Network Impact
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Live footprint of active Glow-backed farms using verified coordinates.
        </p>
      </div>

      <Card className="!gap-0 overflow-hidden border-border/20">
        <CardContent className="p-6 sm:p-8 lg:p-10">
          <div className="grid gap-8 xl:grid-cols-12 xl:items-center">
            <div className="xl:col-span-4 flex flex-col gap-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                Homes powered by clean energy
              </div>
              <div className="text-6xl sm:text-7xl font-semibold tracking-tight font-mono tabular-nums">
                {isFiniteNumber(impactTotals?.homesPowered) ? (
                  <NumberTicker
                    value={impactTotals.homesPowered}
                    startValue={0}
                    className="tracking-tight"
                  />
                ) : (
                  "—"
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Equivalent households supplied by active Glow-backed solar output.
              </div>
              <a
                href="https://glow.org/audits"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-border/20 bg-muted/30 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-foreground transition-colors hover:bg-muted/50"
              >
                View all farm audits ↗
              </a>
            </div>

            <div className="xl:col-span-8">
              <div className="rounded-2xl border border-border/20 bg-muted/20 dark:bg-[#0b1220] overflow-hidden">
                <div className="h-[320px] sm:h-[360px] w-full">
                  <UiMap
                    ref={mapRef}
                    className="h-full w-full"
                    center={DEFAULT_US_CENTER}
                    zoom={DEFAULT_US_ZOOM}
                    minZoom={0.85}
                    maxZoom={7}
                    onViewportChange={handleViewportChange}
                    styles={{
                      light: CARTO_LIGHT_STYLE,
                      dark: CARTO_DARK_STYLE,
                    }}
                    dragRotate={false}
                    pitchWithRotate={false}
                    maxPitch={0}
                    keyboard={false}
                    doubleClickZoom={false}
                    attributionControl={false}
                  >
                    {visibleClusters.map((cluster, index) => (
                      <MapMarker
                        key={cluster.id}
                        longitude={cluster.lng}
                        latitude={cluster.lat}
                        onClick={() => handleClusterClick(cluster)}
                      >
                        <MarkerContent>
                          <div className="group relative flex items-center justify-center">
                            <span
                              className="pointer-events-none absolute rounded-full animate-pulse"
                              style={{
                                width: `${cluster.radius * 3.6}px`,
                                height: `${cluster.radius * 3.6}px`,
                                backgroundColor: cluster.color,
                                opacity: index < 8 ? 0.36 : 0.24,
                                animationDuration: `${2 + (index % 4) * 0.4}s`,
                                animationDelay: `${(index % 8) * 120}ms`,
                              }}
                            />
                            <span
                              className="pointer-events-none absolute rounded-full border"
                              style={{
                                width: `${cluster.radius * 2.25}px`,
                                height: `${cluster.radius * 2.25}px`,
                                backgroundColor: "transparent",
                                borderColor: "rgba(255,255,255,0.85)",
                                borderWidth: "1px",
                                opacity: 0.85,
                              }}
                            />
                            <span
                              className="pointer-events-none relative flex items-center justify-center rounded-full border font-mono tabular-nums text-[9px] font-semibold text-card transition-transform duration-150 group-hover:scale-105"
                              style={{
                                width: `${cluster.radius * 2}px`,
                                height: `${cluster.radius * 2}px`,
                                minWidth: "12px",
                                minHeight: "12px",
                                backgroundColor: cluster.color,
                                borderColor: "rgba(255,255,255,0.9)",
                                borderWidth: "1px",
                                boxSizing: "border-box",
                              }}
                            >
                              {cluster.farmCount > 1 ? cluster.farmCount : "•"}
                            </span>
                          </div>
                        </MarkerContent>
                        <MarkerTooltip className="!bg-transparent !p-0 !rounded-none">
                          <div className="rounded-xl border border-border/20 dark:border-white/15 bg-card/95 dark:bg-[#0b1220]/90 px-3 py-2 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-foreground dark:text-white">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: cluster.color }}
                              />
                              <span>{zoneShortLabel(cluster.zoneName)}</span>
                              <span className="text-muted-foreground/70 dark:text-white/65">
                                {cluster.zoneName}
                              </span>
                            </div>
                            <div className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground dark:text-white/80">
                              {cluster.tooltip}
                            </div>
                            <div className="mt-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70 dark:text-white/55">
                              Click to zoom
                            </div>
                          </div>
                        </MarkerTooltip>
                      </MapMarker>
                    ))}

                    <MapControls position="bottom-right" showZoom showCompass={false} showFullscreen={false} />
                  </UiMap>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                  Dot map + live farm coordinates
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                  {isLoading
                    ? "Loading map"
                    : `${formatWholeNumber(visibleClusters.length)} clusters`}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveZone(null)}
                  className={
                    activeZone === null
                      ? "inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-foreground px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-background"
                      : "inline-flex items-center gap-1.5 rounded-full border border-border/20 bg-muted/30 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 transition-colors hover:bg-muted/50"
                  }
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveZone((current) =>
                      current === US_FILTER_KEY ? null : US_FILTER_KEY
                    )
                  }
                  className={
                    activeZone === US_FILTER_KEY
                      ? "inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-foreground px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-background"
                      : "inline-flex items-center gap-1.5 rounded-full border border-border/20 bg-muted/30 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 transition-colors hover:bg-muted/50"
                  }
                >
                  <span className="text-[11px] leading-none">🇺🇸</span>
                  <span>US</span>
                  <span
                    className={
                      activeZone === US_FILTER_KEY
                        ? "text-background/70"
                        : "text-muted-foreground/60"
                    }
                  >
                    {usFarmCount}
                  </span>
                </button>
                {legendZones.map((zone) => {
                  const isActive = activeZone === zone.zoneName;
                  return (
                    <button
                      key={zone.zoneName}
                      type="button"
                      onClick={() =>
                        setActiveZone((current) =>
                          current === zone.zoneName ? null : zone.zoneName
                        )
                      }
                      className={
                        isActive
                          ? "inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-foreground px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-background"
                          : "inline-flex items-center gap-1.5 rounded-full border border-border/20 bg-muted/30 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 transition-colors hover:bg-muted/50"
                      }
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: zone.color }}
                      />
                      <span>{zone.zoneShort}</span>
                      <span className={isActive ? "text-background/70" : "text-muted-foreground/60"}>
                        {zone.farmCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
            <div className="rounded-xl border border-border/20 bg-muted/20 p-5 lg:p-6">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                Total Panels
              </div>
              <div className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight font-mono tabular-nums">
                {formatWholeNumber(impactTotals?.panels ?? null)}
              </div>
            </div>
            <div className="rounded-xl border border-border/20 bg-muted/20 p-5 lg:p-6">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                Installed Capacity
              </div>
              <div className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight font-mono tabular-nums">
                {formatFixed(impactTotals?.capacityMw ?? null, 1)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">MW</div>
            </div>
            <div className="rounded-xl border border-border/20 bg-muted/20 p-5 lg:p-6">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 dark:text-muted-foreground/70">
                Trees Equivalent
              </div>
              <div className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight font-mono tabular-nums">
                {formatCompactNumber(impactTotals?.trees ?? null)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  MarketingLaunchpadApplication,
  MarketingMinerApplication,
} from "@/lib/internal/marketing-launchpad";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "sgctl" | "glw";
type Tab = "delegation" | "miners";

async function fetchLaunchpadApplications(): Promise<
  MarketingLaunchpadApplication[]
> {
  const res = await fetch("/api/internal/toolbox/upcoming-launchpad", {
    cache: "no-store",
  });
  if (!res.ok)
    throw new Error(`Failed to load launchpad listings: ${res.status}`);
  return (await res.json()) as MarketingLaunchpadApplication[];
}

async function fetchMinerFarms(): Promise<MarketingMinerApplication[]> {
  const res = await fetch("/api/internal/toolbox/miner-farms", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load miner farms: ${res.status}`);
  return (await res.json()) as MarketingMinerApplication[];
}

function formatUsd(usd6: string | null | undefined): string {
  if (!usd6) return "—";
  try {
    const n = Number(BigInt(usd6)) / 1_000_000;
    if (!Number.isFinite(n)) return "—";
    return `$${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(Math.round(n))}`;
  } catch {
    return "—";
  }
}

function formatAtomic(
  atomic: string | null | undefined,
  decimals: number,
  fractionDigits: number,
): string {
  if (!atomic) return "—";
  try {
    const big = BigInt(atomic);
    const divisor = 10n ** BigInt(decimals);
    const whole = Number(big / divisor);
    const frac = Number(big % divisor) / Number(divisor);
    return (whole + frac).toFixed(fractionDigits);
  } catch {
    return "—";
  }
}

function formatWindow(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}

function StepBadge({ n, label }: { n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/25 bg-muted/20 px-2.5 py-1 dark:border-border/40">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[9px] font-semibold text-background">
        {n}
      </span>
      <span className="font-medium text-foreground/80">{label}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function WindowRow({
  label,
  iso,
}: {
  label: string;
  iso: string | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="font-medium">{formatWindow(iso)}</span>
    </div>
  );
}

function applicationLabel(app: MarketingLaunchpadApplication): string {
  const farm = app.farmName?.trim() || app.id.slice(0, 8);
  const zone = app.zone?.name?.trim() ? ` · ${app.zone.name}` : "";
  const status = app.activeFraction?.status
    ? ` · ${app.activeFraction.status}`
    : "";
  return `${farm}${zone}${status}`;
}

function hasRequiredFractionData(app: MarketingLaunchpadApplication): boolean {
  const fraction = app.activeFraction;
  if (!fraction) return false;
  if (fraction.isFilled) return false;
  if (fraction.remainingSteps <= 0) return false;
  if (!app.finalProtocolFee) return false;
  if (!app.auditFields?.netCarbonCreditEarningWeekly) return false;
  if (!app.zone?.id) return false;
  return true;
}

export function ToolboxClient() {
  const [tab, setTab] = React.useState<Tab>("delegation");
  const listings = useQuery({
    queryKey: ["internal-toolbox", "launchpad-applications"],
    queryFn: fetchLaunchpadApplications,
    staleTime: 60_000,
  });

  const selectable = React.useMemo(() => {
    if (!listings.data) return [];
    return listings.data
      .filter(hasRequiredFractionData)
      .sort((a, b) => (a.farmName ?? "").localeCompare(b.farmName ?? ""));
  }, [listings.data]);

  const [applicationId, setApplicationId] = React.useState<string | null>(null);
  const [variant, setVariant] = React.useState<Variant>("sgctl");
  const [cacheBuster, setCacheBuster] = React.useState(0);

  React.useEffect(() => {
    if (applicationId) return;
    const first = selectable[0];
    if (first) setApplicationId(first.id);
  }, [selectable, applicationId]);

  const selectedApp = React.useMemo(
    () => selectable.find((a) => a.id === applicationId) ?? null,
    [selectable, applicationId],
  );

  const imageSrc = React.useMemo(() => {
    if (!applicationId) return null;
    const params = new URLSearchParams({ applicationId, variant });
    if (cacheBuster > 0) params.set("v", String(cacheBuster));
    return `/api/internal/toolbox/marketing-card?${params.toString()}`;
  }, [applicationId, variant, cacheBuster]);

  const downloadName = React.useMemo(() => {
    if (!selectedApp) return "glow-marketing-card.png";
    const farm = (selectedApp.farmName ?? selectedApp.id)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `glow-${farm}-${variant}.png`;
  }, [selectedApp, variant]);

  return (
    <div className="min-h-screen bg-background">
      <section className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-12 pb-16 pt-8">
        <div className="flex flex-col gap-8">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
              Internal · Toolbox
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {tab === "delegation"
                ? "Launchpad promo images"
                : "Miner promo images"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground/70 max-w-2xl">
              {tab === "delegation"
                ? "Promote an upcoming farm launch. Pick a farm, choose the sale window, and download a ready-to-share image."
                : "Promote open miner positions. Pick a farm or fill in the details, then download a ready-to-share image."}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex gap-2 rounded-2xl border border-border/25 bg-muted/25 p-1 w-fit dark:border-border/40 dark:bg-muted/20">
              {(["delegation", "miners"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    "h-10 rounded-xl px-5 text-sm font-semibold transition-all",
                    tab === value
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground/80 hover:text-foreground",
                  )}
                >
                  {value === "delegation" ? "Launchpad" : "Miners"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
              <StepBadge n={1} label="Pick" />
              <span className="text-muted-foreground/40">→</span>
              <StepBadge n={2} label="Preview" />
              <span className="text-muted-foreground/40">→</span>
              <StepBadge n={3} label="Download" />
            </div>
          </div>

          {tab === "miners" ? (
            <MinerTab />
          ) : (
            <div className="grid gap-8 lg:grid-cols-[minmax(340px,400px)_1fr]">
              <div className="flex flex-col gap-5">
                <div className="overflow-hidden rounded-3xl border border-border/20 bg-card dark:border-border/40">
                  <div className="p-6">
                    <label
                      htmlFor="toolbox-fraction"
                      className="block text-xs font-semibold text-foreground/90"
                    >
                      1. Which farm are you promoting?
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      Only farms with an upcoming launch are listed.
                    </p>
                    <select
                      id="toolbox-fraction"
                      value={applicationId ?? ""}
                      onChange={(event) =>
                        setApplicationId(event.target.value || null)
                      }
                      disabled={listings.isLoading || selectable.length === 0}
                      className="mt-3 h-12 w-full rounded-2xl border border-border/30 bg-background px-4 text-sm font-medium outline-none transition-colors focus:border-foreground/40 disabled:opacity-50"
                    >
                      {listings.isLoading ? (
                        <option>Loading farms…</option>
                      ) : selectable.length === 0 ? (
                        <option>No farms launching soon</option>
                      ) : (
                        selectable.map((app) => (
                          <option key={app.id} value={app.id}>
                            {applicationLabel(app)}
                          </option>
                        ))
                      )}
                    </select>
                    {listings.error ? (
                      <div className="mt-2 text-xs text-destructive">
                        {listings.error instanceof Error
                          ? listings.error.message
                          : "Failed to load listings"}
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-border/15 p-6 dark:border-border/30">
                    <div className="text-xs font-semibold text-foreground/90">
                      2. Which sale window?
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      Each window gets its own image with different numbers.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-border/25 bg-muted/25 p-1 dark:border-border/40 dark:bg-muted/20">
                      {(["sgctl", "glw"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setVariant(value)}
                          className={cn(
                            "flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-sm font-semibold transition-all",
                            variant === value
                              ? "bg-foreground text-background shadow-sm"
                              : "text-muted-foreground/80 hover:text-foreground",
                          )}
                        >
                          <span>
                            {value === "sgctl" ? "sGCTL presale" : "GLW launch"}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-normal",
                              variant === value
                                ? "text-background/70"
                                : "text-muted-foreground/60",
                            )}
                          >
                            {value === "sgctl"
                              ? "Tue 9 AM ET"
                              : "Tue 9 AM ET"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border/15 p-6 dark:border-border/30">
                    <div className="text-xs font-semibold text-foreground/90">
                      3. Save the image
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        asChild
                        disabled={!imageSrc}
                        className="h-12 flex-1 rounded-2xl px-5 text-sm font-semibold"
                      >
                        <a href={imageSrc ?? "#"} download={downloadName}>
                          <Download className="mr-2 h-4 w-4" /> Download PNG
                        </a>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 rounded-2xl px-5"
                        onClick={() => setCacheBuster((n) => n + 1)}
                      >
                        Regenerate
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground/70">
                      Numbers update live from the reward backend.
                    </p>
                  </div>
                </div>

                {selectedApp ? (
                  <div className="rounded-3xl border border-border/20 bg-card p-6 dark:border-border/40">
                    <div className="text-xs font-semibold text-foreground/90">
                      Farm details
                    </div>
                    <div className="mt-4">
                      <div className="text-xl font-semibold tracking-tight">
                        {selectedApp.farmName ?? "—"}
                      </div>
                      <div className="text-sm text-muted-foreground/70">
                        {selectedApp.zone?.name ?? "—"}
                      </div>
                    </div>
                    {selectedApp.activeFraction ? (
                      <div className="mt-5 space-y-2 rounded-2xl border border-border/20 bg-muted/20 p-4 text-xs dark:border-border/30 dark:bg-muted/10">
                        <WindowRow
                          label="sGCTL presale opens"
                          iso={selectedApp.activeFraction.sgctlVisibleAt}
                        />
                        <WindowRow
                          label="sGCTL presale ends"
                          iso={selectedApp.activeFraction.sgctlEndsAt}
                        />
                        <WindowRow
                          label="GLW launch opens"
                          iso={selectedApp.activeFraction.glwVisibleAt}
                        />
                      </div>
                    ) : null}
                    <details className="mt-4 text-sm">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground/70 hover:text-foreground">
                        Show technical details
                      </summary>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <Stat
                          label="Sponsor bonus"
                          value={`${selectedApp.sponsorSplitPercent}%`}
                        />
                        <Stat
                          label="GLW slots"
                          value={String(
                            selectedApp.activeFraction?.totalSteps ?? "—",
                          )}
                        />
                        <Stat
                          label="Funding target"
                          value={formatUsd(selectedApp.finalProtocolFee)}
                        />
                        <Stat
                          label="sGCTL per slot"
                          value={
                            selectedApp.activeFraction?.sgctlStepAtomic
                              ? `${formatAtomic(
                                  selectedApp.activeFraction.sgctlStepAtomic,
                                  6,
                                  0,
                                )} sGCTL`
                              : "—"
                          }
                        />
                      </dl>
                    </details>
                  </div>
                ) : null}
              </div>

              <div className="relative flex min-h-[600px] flex-col items-center justify-center rounded-3xl border border-border/20 bg-muted/20 p-6 dark:border-border/40 dark:bg-muted/10">
                {imageSrc ? (
                  <MarketingCardPreview key={imageSrc} src={imageSrc} />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="text-sm font-medium">
                      Pick a farm on the left
                    </div>
                    <div className="text-xs text-muted-foreground/60">
                      The preview shows up here.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MinerTab() {
  const listings = useQuery({
    queryKey: ["internal-toolbox", "miner-farms"],
    queryFn: fetchMinerFarms,
    staleTime: 60_000,
  });
  const farmOptions = React.useMemo(() => {
    if (!listings.data) return [];
    return listings.data
      .filter((app) => (app.farmName ?? "").trim().length > 0)
      .sort((a, b) => (a.farmName ?? "").localeCompare(b.farmName ?? ""));
  }, [listings.data]);

  const [farmName, setFarmName] = React.useState("");
  const [zoneName, setZoneName] = React.useState("");
  const [minersCount, setMinersCount] = React.useState("");
  const [perMinerUsd, setPerMinerUsd] = React.useState("");
  const [glwPerWeek, setGlwPerWeek] = React.useState("");
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [remoteImageUrl, setRemoteImageUrl] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);

  const filteredFarms = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return farmOptions.slice(0, 25);
    return farmOptions
      .filter((app) => {
        const haystack = [app.farmName, app.zone?.name]
          .filter((s): s is string => typeof s === "string" && s.length > 0)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 25);
  }, [farmOptions, search]);

  React.useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!searchContainerRef.current) return;
      if (!searchContainerRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleFarmSelect(app: MarketingMinerApplication) {
    setFarmName(app.farmName ?? "");
    setZoneName(app.zone?.name ?? "");
    const firstPicture = app.afterInstallPictures?.[0]?.url ?? null;
    setRemoteImageUrl(firstPicture);
    setImageFile(null);
    setSearch(app.farmName ?? "");
    setSearchOpen(false);
  }


  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const canSubmit =
    farmName.trim().length > 0 &&
    perMinerUsd.trim().length > 0 &&
    glwPerWeek.trim().length > 0;

  const downloadName = React.useMemo(() => {
    const farm = (farmName || "miner")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `glow-${farm || "miner"}-miners.png`;
  }, [farmName]);

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("farmName", farmName.trim());
      formData.set("zoneName", zoneName.trim());
      formData.set("minersCount", minersCount.trim());
      formData.set("perMinerUsd", perMinerUsd.trim());
      formData.set("glwPerWeek", glwPerWeek.trim());
      if (imageFile) {
        formData.set("image", imageFile);
      } else if (remoteImageUrl) {
        formData.set("imageUrl", remoteImageUrl);
      }

      const response = await fetch("/api/internal/toolbox/miner-card", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render card");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(340px,400px)_1fr]">
      <form onSubmit={handleGenerate} className="flex flex-col gap-5">
        <div className="overflow-hidden rounded-3xl border border-border/20 bg-card dark:border-border/40">
          <div className="p-6">
            <label
              htmlFor="miner-farm-search"
              className="block text-xs font-semibold text-foreground/90"
            >
              1. Start from an existing farm (optional)
            </label>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Picks the farm name, zone, and photo for you. You can still edit
              anything below.
            </p>
            <div ref={searchContainerRef} className="relative mt-3">
              <input
                id="miner-farm-search"
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder={
                  listings.isLoading
                    ? "Loading farms…"
                    : farmOptions.length === 0
                    ? "No farms available"
                    : "Search by farm or zone…"
                }
                disabled={listings.isLoading || farmOptions.length === 0}
                className="h-12 w-full rounded-2xl border border-border/30 bg-background px-4 text-sm font-medium outline-none transition-colors focus:border-foreground/40 disabled:opacity-50"
                autoComplete="off"
              />
              {searchOpen && filteredFarms.length > 0 ? (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-10 max-h-64 overflow-y-auto rounded-2xl border border-border/25 bg-popover p-1 shadow-lg dark:border-border/40">
                  {filteredFarms.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => handleFarmSelect(app)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted/40"
                    >
                      <span className="flex flex-col">
                        <span className="font-medium">
                          {app.farmName ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground/70">
                          {app.zone?.name ?? "—"}
                        </span>
                      </span>
                      <span className="font-mono text-xs text-muted-foreground/60">
                        {app.foundationGlowSplitPercent
                          ? `${app.foundationGlowSplitPercent}%`
                          : ""}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {remoteImageUrl ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border/20 bg-muted/20 p-3 dark:border-border/30 dark:bg-muted/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={remoteImageUrl}
                  alt="Selected farm"
                  className="h-14 w-14 rounded-xl object-cover"
                />
                <div className="flex flex-col text-xs">
                  <span className="font-semibold">Farm photo linked</span>
                  <span className="text-muted-foreground/70">
                    Upload your own below to replace it.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
          <div className="border-t border-border/15 p-6 dark:border-border/30">
            <div className="text-xs font-semibold text-foreground/90">
              2. Farm name &amp; location
            </div>
            <div className="mt-3 flex flex-col gap-4">
              <FormField
                label="Farm name"
                value={farmName}
                onChange={setFarmName}
                placeholder="Zenithal Grange"
              />
              <FormField
                label="Zone"
                value={zoneName}
                onChange={setZoneName}
                placeholder="Idaho"
              />
            </div>
          </div>
          <div className="border-t border-border/15 p-6 dark:border-border/30">
            <div className="text-xs font-semibold text-foreground/90">
              3. Numbers to show on the image
            </div>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Leave the first one blank to hide it.
            </p>
            <div className="mt-3 flex flex-col gap-4">
              <FormField
                label="How many miners are available? (optional)"
                value={minersCount}
                onChange={setMinersCount}
                placeholder="58"
                inputMode="numeric"
              />
              <FormField
                label="Price per miner (USD)"
                value={perMinerUsd}
                onChange={setPerMinerUsd}
                placeholder="499"
                inputMode="numeric"
              />
              <FormField
                label="GLW earned per week"
                value={glwPerWeek}
                onChange={setGlwPerWeek}
                placeholder="42.9"
                inputMode="decimal"
              />
            </div>
          </div>
          <div className="border-t border-border/15 p-6 dark:border-border/30">
            <label className="block text-xs font-semibold text-foreground/90">
              4. Farm photo (optional)
            </label>
            <p className="mt-1 text-xs text-muted-foreground/70">
              JPG or PNG. Large photos are resized automatically.
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                setImageFile(event.target.files?.[0] ?? null)
              }
              className="mt-3 block w-full text-sm file:mr-3 file:h-10 file:rounded-xl file:border-0 file:bg-foreground file:px-4 file:text-sm file:font-semibold file:text-background hover:file:opacity-90"
            />
            {imageFile ? (
              <div className="mt-2 text-xs text-muted-foreground/70">
                {imageFile.name} ({(imageFile.size / 1024 / 1024).toFixed(1)}{" "}
                MB)
              </div>
            ) : null}
          </div>
          <div className="border-t border-border/15 p-6 dark:border-border/30">
            <div className="text-xs font-semibold text-foreground/90">
              5. Save the image
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={!canSubmit || loading}
                className="h-12 flex-1 rounded-2xl px-5 text-sm font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  "Generate & download"
                )}
              </Button>
              {previewUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl px-5"
                  onClick={() => {
                    const anchor = document.createElement("a");
                    anchor.href = previewUrl;
                    anchor.download = downloadName;
                    document.body.appendChild(anchor);
                    anchor.click();
                    anchor.remove();
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> Download again
                </Button>
              ) : null}
            </div>
            {!canSubmit ? (
              <p className="mt-2 text-xs text-muted-foreground/70">
                Fill in farm name, price per miner, and GLW per week to continue.
              </p>
            ) : null}
            {error ? (
              <div className="mt-3 text-xs text-destructive whitespace-pre-wrap break-all">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </form>

      <div className="relative flex min-h-[600px] flex-col items-center justify-center rounded-3xl border border-border/20 bg-muted/20 p-6 dark:border-border/40 dark:bg-muted/10">
        {previewUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt="Miner marketing card preview"
            className="w-full max-w-[520px] rounded-2xl shadow-sm"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="text-sm font-medium">Your image shows up here</div>
            <div className="text-xs text-muted-foreground/60">
              Fill in the form on the left and click Generate.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "decimal" | "text";
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-12 w-full rounded-2xl border border-border/30 bg-background px-4 text-sm font-medium outline-none transition-colors focus:border-foreground/40"
      />
    </label>
  );
}

function MarketingCardPreview({ src }: { src: string }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
  }, [src]);

  return (
    <div className="relative w-full max-w-[520px]">
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
        </div>
      ) : null}
      {error ? (
        <div className="text-xs text-destructive whitespace-pre-wrap break-all">
          {error}
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt="Marketing card preview"
          className="w-full rounded-2xl shadow-sm"
          onLoad={() => setLoading(false)}
          onError={async () => {
            setLoading(false);
            let detail = "Failed to render marketing card.";
            try {
              const response = await fetch(src, { cache: "no-store" });
              const body = await response.text();
              detail = `HTTP ${response.status}: ${body.slice(0, 500)}`;
            } catch {
              // ignore
            }
            setError(detail);
          }}
        />
      )}
    </div>
  );
}

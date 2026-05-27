"use client";

import * as React from "react";
import Image from "next/image";
import { useAccount } from "wagmi";
import {
  Coins,
  Clock,
  Sun,
  Trophy,
  Ticket,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Receipt,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectButton } from "@/components/connect-button";
import {
  Carousel,
  CarouselContent,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/telemetry";
import { formatNumber } from "@/utils/format";
import { useCountdownTo } from "@/app/components/animated-countdown";
import { getLaunchpadNowMs } from "@/utils/launchpad-now";
import { nextShopRestock } from "@/lib/time/shop-restock";
import { useV2PointsBalance } from "@/hooks/v2-points";
import {
  useV2ShopCurrent,
  useV2ShopPurchases,
  type V2ShopItem,
  type V2ShopItemKind,
  type V2ShopPurchaseRow,
} from "@/hooks/v2-points-shop";
import { shopItemMeta } from "@/app/shop/shop-item-meta";
import { PurchaseDialog } from "@/app/shop/purchase-dialog";
import {
  useShopMinerFarms,
  getShopMinerValueUsd,
  isMinerLikeItem,
  type ShopMinerFarmInfo,
} from "@/hooks/v2-shop-miner";
import { useWalletRewardSplitOwnership } from "@/hooks/control-farms";
import { FallbackImage } from "@/components/ui/fallback-image";
import { ImpactScoreBreakdownDialog } from "@/components/dialogs/impact-score-breakdown-dialog";
import {
  INITIAL_POSITION_USD_GRACE,
  MIN_INITIAL_POSITION_USD,
} from "@/lib/initial-position-guard";

const KIND_ICON: Record<
  V2ShopItemKind,
  React.ComponentType<{ className?: string }>
> = {
  miner: Coins,
  watts: Sun,
  mega: Trophy,
  early_access: Ticket,
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0h 0m";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Shared micro-label: uppercase, wide tracking, muted. */
function Overline({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
      {children}
    </p>
  );
}

function RestockBlock() {
  // Anchor the target to the same clock the countdown ticks on
  // (`getLaunchpadNowMs`), which a local time override can shift away
  // from the real clock.
  const targetAtMs = React.useMemo(
    () => nextShopRestock(new Date(getLaunchpadNowMs())).getTime(),
    [],
  );
  const remainingMs = useCountdownTo({ targetAtMs });
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background dark:border-white/10">
        <Clock className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <Overline>Next restock</Overline>
        <p className="mt-0.5 text-sm font-semibold tabular-nums">
          {formatRemaining(remainingMs)}
        </p>
      </div>
    </div>
  );
}

function inventoryLabel(item: V2ShopItem): string {
  if (item.inventoryRemaining === null) return "Unlimited";
  if (item.inventoryRemaining <= 0) return "Sold out";
  return `${item.inventoryRemaining} left`;
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 dark:border-white/10 dark:bg-zinc-900">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
        {label}
      </p>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/** Compact GLW amount: more precision for sub-1 values. */
function formatGlwAmount(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
  });
}

function BuyButton({
  item,
  isConnected,
  canAfford,
  onBuy,
  className,
}: {
  item: V2ShopItem;
  isConnected: boolean;
  canAfford: boolean;
  onBuy: (item: V2ShopItem) => void;
  className?: string;
}) {
  const soldOut =
    item.inventoryRemaining !== null && item.inventoryRemaining <= 0;

  if (soldOut) {
    return (
      <Button disabled variant="outline" className={className}>
        Sold out
      </Button>
    );
  }
  if (!item.available) {
    return (
      <Button disabled variant="outline" className={className}>
        Unavailable
      </Button>
    );
  }
  if (!isConnected) {
    return (
      <Button disabled variant="outline" className={className}>
        Connect wallet to buy
      </Button>
    );
  }
  if (!canAfford) {
    return (
      <Button disabled className={className}>
        Not enough points
      </Button>
    );
  }
  return (
    <Button className={className} onClick={() => onBuy(item)}>
      Redeem prize
    </Button>
  );
}

/** Ticket-style visual pane for early-access prizes (no photo). */
function TicketVisual() {
  return (
    <div className="glow-gradient-b relative flex h-full min-h-[220px] items-center justify-center overflow-hidden">
      <Ticket
        className="relative h-24 w-24 text-black/55"
        strokeWidth={1.25}
      />
    </div>
  );
}

/** The large, full-width prize card shown as one carousel slide. */
function PrizeSlide({
  item,
  isConnected,
  canAfford,
  onBuy,
  minerFarm,
}: {
  item: V2ShopItem;
  isConnected: boolean;
  canAfford: boolean;
  onBuy: (item: V2ShopItem) => void;
  minerFarm?: ShopMinerFarmInfo;
}) {
  const meta = shopItemMeta(item);
  const Icon = KIND_ICON[item.kind] ?? Coins;
  const soldOut =
    item.inventoryRemaining !== null && item.inventoryRemaining <= 0;

  // A miner(-like) item linked to a real farm shows the farm's after-install
  // photo and a live reward estimate in place of the static placeholder. This
  // covers both the regular miner and the mega "miner_500" headline prize.
  const farmMiner = isMinerLikeItem(item) ? minerFarm : undefined;
  const wattsSource =
    item.kind === "watts" ? item.impactSourcePreview?.sources?.[0] : undefined;
  const farmImageUrl =
    farmMiner && farmMiner.resolved
      ? farmMiner.imageUrl
      : wattsSource?.imageUrl ?? null;
  const tagline =
    farmMiner && farmMiner.resolved && farmMiner.farmName
      ? farmMiner.farmName
      : meta.tagline;

  let stats: { label: string; value: React.ReactNode }[];
  if (farmMiner && farmMiner.isLoading) {
    stats = [
      { label: "Est. reward", value: <Skeleton className="h-5 w-24" /> },
      { label: "Weeks left", value: <Skeleton className="h-5 w-16" /> },
    ];
  } else if (farmMiner && farmMiner.resolved) {
    stats = [
      {
        label: "Est. reward",
        value:
          farmMiner.weeklyGlwRewards != null
            ? `${formatGlwAmount(farmMiner.weeklyGlwRewards)} GLW/wk`
            : "-",
      },
      {
        label: "Weeks left",
        value:
          farmMiner.weeksRemaining != null
            ? `${farmMiner.weeksRemaining} ${
                farmMiner.weeksRemaining === 1 ? "week" : "weeks"
              }`
            : "-",
      },
    ];
  } else {
    stats = meta.stats;
  }

  return (
    <div className="relative">
      <article
        className={cn(
          "grid overflow-hidden rounded-3xl border bg-card shadow-sm dark:bg-zinc-800 md:grid-cols-2",
          meta.isMega
            ? "border-amber-400/50 ring-1 ring-amber-400/30"
            : "border-border/60 dark:border-white/10",
        )}
      >
      {/* Visual pane */}
      <div className="relative min-h-[220px] md:min-h-[400px]">
        {meta.isTicket ? (
          <TicketVisual />
        ) : farmImageUrl ? (
          <FallbackImage
            src={farmImageUrl}
            alt={tagline ?? item.label}
            widthForProxy={760}
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              soldOut && "grayscale",
            )}
          />
        ) : meta.image?.startsWith("http") ? (
          <FallbackImage
            src={meta.image}
            alt={tagline ?? item.label}
            widthForProxy={760}
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              soldOut && "grayscale",
            )}
          />
        ) : meta.image ? (
          <Image
            src={meta.image}
            alt={item.label}
            fill
            sizes="(max-width: 768px) 100vw, 560px"
            className={cn("object-cover", soldOut && "grayscale")}
          />
        ) : (
          <TicketVisual />
        )}
      </div>

      {/* Content pane */}
      <div className="flex flex-col gap-5 p-6 md:p-8">
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wider",
              meta.isMega
                ? "bg-amber-400/90 text-black"
                : "bg-muted text-muted-foreground dark:bg-white/10 dark:text-zinc-300",
            )}
          >
            {meta.isMega ? (
              <Sparkles className="h-3 w-3" />
            ) : (
              <Icon className="h-3 w-3" />
            )}
            {meta.eyebrow}
          </span>
          <span
            className={cn(
              "text-xs font-medium",
              soldOut ? "text-red-600" : "text-muted-foreground",
            )}
          >
            {inventoryLabel(item)}
          </span>
        </div>

        <div>
          <h3 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
            {meta.headline}
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{tagline}</p>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {meta.blurb}
        </p>

        {stats.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <StatTile key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-border/50 pt-5 dark:border-white/10">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
              Price
            </p>
            <p className="text-2xl font-semibold tabular-nums leading-tight">
              {formatNumber(item.pricePoints)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                points
              </span>
            </p>
          </div>
          <BuyButton
            item={item}
            isConnected={isConnected}
            canAfford={canAfford}
            onBuy={onBuy}
            className="min-w-[160px] px-8"
          />
        </div>
      </div>

        {/* Ticket perforation line down the stub divide. */}
        {meta.isTicket ? (
          <div className="pointer-events-none absolute inset-y-7 left-1/2 hidden -translate-x-1/2 border-l-2 border-dashed border-black/20 md:block" />
        ) : null}
      </article>

      {/* Ticket notches punched at the stub divide. */}
      {meta.isTicket ? (
        <>
          <span
            aria-hidden
            className="absolute left-1/2 top-0 hidden h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted dark:bg-zinc-900 md:block"
          />
          <span
            aria-hidden
            className="absolute bottom-0 left-1/2 hidden h-7 w-7 -translate-x-1/2 translate-y-1/2 rounded-full bg-muted dark:bg-zinc-900 md:block"
          />
        </>
      ) : null}
    </div>
  );
}

function ArrowButton({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={direction === "prev" ? "Previous prize" : "Next prize"}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-card text-foreground shadow-md transition-all hover:scale-105 hover:bg-foreground hover:text-background dark:border-white/10 dark:bg-zinc-800",
        direction === "prev" ? "left-1 sm:left-3" : "right-1 sm:right-3",
      )}
    >
      {direction === "prev" ? (
        <ChevronLeft className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </button>
  );
}

function ShopCarousel({
  items,
  isConnected,
  canAfford,
  onBuy,
  minerFarms,
}: {
  items: V2ShopItem[];
  isConnected: boolean;
  canAfford: (item: V2ShopItem) => boolean;
  onBuy: (item: V2ShopItem) => void;
  minerFarms: Map<string, ShopMinerFarmInfo>;
}) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [selected, setSelected] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;
    const sync = () => setSelected(api.selectedScrollSnap());
    sync();
    api.on("select", sync);
    api.on("reInit", sync);
    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
    };
  }, [api]);

  return (
    <div className="rounded-[28px] border border-border/60 bg-muted p-3 dark:border-white/10 dark:bg-zinc-900 sm:p-5">
      <div className="relative">
        <Carousel
          setApi={setApi}
          opts={{ align: "center", loop: items.length > 1 }}
        >
          <CarouselContent className="-ml-4">
            {items.map((item, i) => (
              <div
                key={item.itemId}
                role="group"
                aria-roledescription="slide"
                onClick={() => {
                  if (i !== selected) api?.scrollTo(i);
                }}
                className={cn(
                  "flex min-w-0 shrink-0 grow-0 basis-[88%] items-center pl-4 sm:basis-[80%] lg:basis-[72%]",
                  i !== selected && "cursor-pointer",
                )}
              >
                <div
                  className={cn(
                    "w-full transition-all duration-500 ease-out",
                    i === selected
                      ? "scale-100 opacity-100"
                      : "scale-[0.86] opacity-40",
                  )}
                >
                  <div className={cn(i !== selected && "pointer-events-none")}>
                    <PrizeSlide
                      item={item}
                      isConnected={isConnected}
                      canAfford={canAfford(item)}
                      onBuy={onBuy}
                      minerFarm={minerFarms.get(item.itemId)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CarouselContent>
        </Carousel>

        {items.length > 1 ? (
          <>
            <ArrowButton direction="prev" onClick={() => api?.scrollPrev()} />
            <ArrowButton direction="next" onClick={() => api?.scrollNext()} />
          </>
        ) : null}
      </div>

      {items.length > 1 ? (
        <div className="mt-5 flex items-center justify-center gap-2">
          {items.map((item, i) => (
            <button
              key={item.itemId}
              type="button"
              aria-label={`Go to prize ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === selected
                  ? "w-7 bg-foreground"
                  : "w-2 bg-border hover:bg-muted-foreground/50 dark:bg-white/20",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** One stat column in the connected balance bar. */
function StatCell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-center px-4 py-3 sm:p-6",
        className,
      )}
    >
      <Overline>{label}</Overline>
      <div className="mt-1.5 sm:mt-2">{children}</div>
    </div>
  );
}

function SecondaryValue({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base font-semibold tracking-tight tabular-nums sm:text-xl">
      {children}
    </p>
  );
}

/** Restock column: same shape as a stat cell, driven by the countdown. */
function RestockCell({ className }: { className?: string }) {
  const targetAtMs = React.useMemo(
    () => nextShopRestock(new Date(getLaunchpadNowMs())).getTime(),
    [],
  );
  const remainingMs = useCountdownTo({ targetAtMs });
  return (
    <StatCell label="Next restock" className={className}>
      <SecondaryValue>{formatRemaining(remainingMs)}</SecondaryValue>
    </StatCell>
  );
}

function BalancePanel({
  isConnected,
  address,
  availablePoints,
  lifetimeEarned,
  lifetimeSpent,
  streakWeeks,
  isLoading,
  onOpenBreakdown,
}: {
  isConnected: boolean;
  address: string | undefined;
  availablePoints: number | null;
  lifetimeEarned: number | null;
  lifetimeSpent: number | null;
  streakWeeks: number | null;
  isLoading: boolean;
  onOpenBreakdown?: () => void;
}) {
  if (!isConnected || !address) {
    return (
      <div className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-card dark:border-white/10 dark:bg-zinc-800">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Overline>Your balance</Overline>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              Connect a wallet to see your points and redeem this week's
              prizes.
            </p>
          </div>
          <div className="flex items-center gap-5">
            <RestockBlock />
            <ConnectButton variant="default" size="small" />
          </div>
        </div>
      </div>
    );
  }

  const streak = streakWeeks ?? 0;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="flex flex-col divide-y divide-border/50 dark:divide-white/10 sm:flex-row sm:items-stretch sm:divide-x sm:divide-y-0">
        {/* Available points — hero */}
        <StatCell label="Available points" className="sm:flex-[1.2]">
          {isLoading ? (
            <Skeleton className="h-11 w-44" />
          ) : (
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold leading-none tracking-tight tabular-nums sm:text-5xl">
                  {formatNumber(availablePoints ?? 0)}
                </span>
                <span className="text-sm text-muted-foreground">points</span>
              </div>
              {onOpenBreakdown && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-[11px] font-medium border-border/40 bg-transparent"
                  onClick={onOpenBreakdown}
                >
                  Breakdown
                </Button>
              )}
            </div>
          )}
        </StatCell>

        {/* Supporting stats */}
        <div className="grid grid-cols-2 divide-x divide-y divide-border/50 dark:divide-white/10 sm:flex sm:flex-[4] sm:divide-y-0">
          <StatCell label="Lifetime earned" className="sm:flex-1">
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <SecondaryValue>{formatNumber(lifetimeEarned ?? 0)}</SecondaryValue>
            )}
          </StatCell>
          <StatCell label="Redeemed" className="sm:flex-1">
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <SecondaryValue>{formatNumber(lifetimeSpent ?? 0)}</SecondaryValue>
            )}
          </StatCell>
          <StatCell label="Streak" className="sm:flex-1">
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <SecondaryValue>
                {streak} {streak === 1 ? "week" : "weeks"}
              </SecondaryValue>
            )}
          </StatCell>
          <RestockCell className="sm:flex-1" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center dark:border-white/10">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

function purchaseRowLabel(row: V2ShopPurchaseRow): string {
  switch (row.grant.kind) {
    case "miner":
      return row.grant.minerValueUsd != null
        ? `$${row.grant.minerValueUsd} miner`
        : "Miner";
    case "mega":
      if (row.grant.megaKey === "miner_500") return "$500 miner";
      if (row.grant.megaKey === "watts_20000") return "20,000 watts";
      return "Mega prize";
    case "watts":
      return `${formatNumber(Number(row.grant.wattsGranted))} watts`;
    case "early_access":
      return "Miner early access";
    default:
      return "Prize";
  }
}

function formatPurchaseDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Shop purchase history for the connected wallet. */
function PurchaseHistory({ wallet }: { wallet?: string }) {
  const purchasesQuery = useV2ShopPurchases(wallet);
  if (!wallet) return null;

  const rows = purchasesQuery.data?.rows ?? [];

  return (
    <div className="mt-12">
      <div className="mb-4 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-tight">Your purchases</h2>
      </div>

      {purchasesQuery.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-muted/20 px-5 py-8 text-center dark:border-white/10 dark:bg-zinc-900">
          <p className="text-sm text-muted-foreground">
            No purchases yet. Redeem your points on a prize above.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card dark:divide-white/10 dark:border-white/10 dark:bg-zinc-800">
          {rows.map((row) => (
            <li
              key={row.purchaseId}
              className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-white/10">
                  <Coins className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {purchaseRowLabel(row)}
                    {row.quantity > 1 ? ` ×${row.quantity}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatPurchaseDate(row.createdAt)}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  -{formatNumber(Number(row.pricePointsTotal))}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  points
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ShopView() {
  const { address, isConnected } = useAccount();
  const shopQuery = useV2ShopCurrent();
  const balanceQuery = useV2PointsBalance(address);
  const [selectedItem, setSelectedItem] = React.useState<V2ShopItem | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isPointsBreakdownOpen, setIsPointsBreakdownOpen] = React.useState(false);

  const hasTrackedRef = React.useRef(false);
  React.useEffect(() => {
    if (hasTrackedRef.current) return;
    hasTrackedRef.current = true;
    trackEvent("shop_viewed", {
      wallet_connected: isConnected,
      wallet: address ?? null,
    });
  }, [isConnected, address]);

  const availablePoints = balanceQuery.data?.availablePoints ?? null;
  const lifetimeEarned = balanceQuery.data?.lifetimeEarnedPoints ?? null;
  const lifetimeSpent = balanceQuery.data?.lifetimeSpentPoints ?? null;
  const streakWeeks = balanceQuery.data?.currentStreak?.streakWeek ?? null;

  const shopItems = React.useMemo(
    () => shopQuery.data?.items ?? [],
    [shopQuery.data],
  );
  const minerFarms = useShopMinerFarms(shopItems);
  const hasSmallMinerPrize = React.useMemo(
    () =>
      shopItems.some((item) => {
        if (!isMinerLikeItem(item)) return false;
        const minerValueUsd = getShopMinerValueUsd(item);
        return (
          minerValueUsd > 0 &&
          minerValueUsd + INITIAL_POSITION_USD_GRACE < MIN_INITIAL_POSITION_USD
        );
      }),
    [shopItems],
  );
  const rewardSplitOwnership = useWalletRewardSplitOwnership({
    walletAddress: address,
    enabled: isConnected && hasSmallMinerPrize,
  });

  const handleBuy = React.useCallback(
    (item: V2ShopItem) => {
      trackEvent("shop_item_clicked", {
        itemId: item.itemId,
        kind: item.kind,
        wallet: address ?? null,
      });
      setSelectedItem(item);
      setDialogOpen(true);
    },
    [address],
  );

  const canAfford = React.useCallback(
    (item: V2ShopItem) =>
      availablePoints !== null && availablePoints >= item.pricePoints,
    [availablePoints],
  );

  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 pb-20 pt-8 sm:px-6 lg:px-12">
      <header className="mb-5">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Points Shop
        </h1>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Spend your Glow points on this week's prizes. Fresh inventory drops
          every Tuesday at 1:00 PM ET.
        </p>
      </header>

      <BalancePanel
        isConnected={isConnected}
        address={address}
        availablePoints={availablePoints}
        lifetimeEarned={lifetimeEarned}
        lifetimeSpent={lifetimeSpent}
        streakWeeks={streakWeeks}
        isLoading={isConnected && balanceQuery.isLoading}
        onOpenBreakdown={
          isConnected && address
            ? () => {
                trackEvent("shop_points_breakdown_open_click", {
                  wallet: address,
                });
                setIsPointsBreakdownOpen(true);
              }
            : undefined
        }
      />

      {shopQuery.isLoading ? (
        <div className="rounded-[28px] border border-border/60 bg-muted p-5 dark:border-white/10 dark:bg-zinc-900">
          <Skeleton className="mx-auto h-[400px] w-[72%] rounded-3xl" />
        </div>
      ) : shopQuery.isError ? (
        <EmptyState
          title="Unable to load the shop"
          body="Something went wrong fetching this week's inventory. Try again shortly."
        />
      ) : !shopQuery.data?.weekKey || shopQuery.data.items.length === 0 ? (
        <EmptyState
          title="This week's shop is being prepared"
          body="New prizes drop every Tuesday at 1:00 PM ET. Check back shortly."
        />
      ) : (
        <ShopCarousel
          items={shopQuery.data.items}
          isConnected={isConnected}
          canAfford={canAfford}
          onBuy={handleBuy}
          minerFarms={minerFarms}
        />
      )}

      <PurchaseHistory wallet={address} />

      <PurchaseDialog
        item={selectedItem}
        availablePoints={availablePoints}
        minerFarm={
          selectedItem ? minerFarms.get(selectedItem.itemId) : undefined
        }
        hasExistingRewardSplits={rewardSplitOwnership.hasRewardSplits}
        isCheckingRewardSplitOwnership={
          hasSmallMinerPrize &&
          (rewardSplitOwnership.isLoading || rewardSplitOwnership.isFetching)
        }
        isRewardSplitOwnershipError={
          hasSmallMinerPrize && rewardSplitOwnership.isError
        }
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <ImpactScoreBreakdownDialog
        open={isPointsBreakdownOpen}
        onOpenChange={setIsPointsBreakdownOpen}
        walletAddress={address ?? null}
        title="Available Points"
      />
    </section>
  );
}

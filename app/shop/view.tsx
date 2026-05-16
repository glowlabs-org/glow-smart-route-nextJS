"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { Coins, Clock, Zap, Trophy, Ticket } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectButton } from "@/components/connect-button";
import { trackEvent } from "@/lib/telemetry";
import { formatNumber } from "@/utils/format";
import { useCountdownTo } from "@/app/components/animated-countdown";
import { nextShopRestock } from "@/lib/time/shop-restock";
import { useV2PointsBalance } from "@/hooks/v2-points";
import {
  useV2ShopCurrent,
  type V2ShopItem,
  type V2ShopItemKind,
} from "@/hooks/v2-points-shop";
import { PurchaseDialog } from "@/app/shop/purchase-dialog";

const KIND_ICON: Record<V2ShopItemKind, React.ComponentType<{ className?: string }>> = {
  miner: Coins,
  watts: Zap,
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

function RestockCountdown() {
  const targetAtMs = React.useMemo(() => nextShopRestock().getTime(), []);
  const remainingMs = useCountdownTo({ targetAtMs });
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span>Restocks in {formatRemaining(remainingMs)}</span>
    </div>
  );
}

function itemSubtitle(item: V2ShopItem): string | null {
  const d = item.details ?? {};
  switch (item.kind) {
    case "watts":
      return "Watts come from the Foundation's watt balance.";
    case "early_access":
      return "15 minutes early on miner windows · valid 4 weeks · miners only · does not guarantee inventory.";
    case "mega":
      return "Weekly mega prize.";
    case "miner":
      return typeof d === "object" && d && "minerValueUsd" in d
        ? `A $${(d as { minerValueUsd?: number }).minerValueUsd} mining position.`
        : null;
    default:
      return null;
  }
}

function ShopItemCard({
  item,
  canAfford,
  onBuy,
}: {
  item: V2ShopItem;
  canAfford: boolean;
  onBuy: (item: V2ShopItem) => void;
}) {
  const Icon = KIND_ICON[item.kind] ?? Coins;
  const soldOut =
    item.inventoryRemaining !== null && item.inventoryRemaining <= 0;
  const subtitle = itemSubtitle(item);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{item.label}</CardTitle>
          <Icon className="h-5 w-5 shrink-0 text-muted-foreground/70" />
        </div>
        {subtitle ? (
          <CardDescription className="text-xs">{subtitle}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
              Price
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {formatNumber(item.pricePoints)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                points
              </span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {item.inventoryRemaining === null
              ? "Unlimited"
              : `${item.inventoryRemaining} left`}
          </p>
        </div>
        {soldOut ? (
          <Button disabled variant="outline" className="w-full">
            Sold out
          </Button>
        ) : !item.available ? (
          <Button disabled variant="outline" className="w-full">
            Unavailable
          </Button>
        ) : (
          <Button
            className="w-full"
            disabled={!canAfford}
            onClick={() => onBuy(item)}
          >
            {canAfford ? "Buy" : "Not enough points"}
          </Button>
        )}
      </CardContent>
    </Card>
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

  return (
    <section className="mx-auto w-full max-w-screen-lg px-4 pb-16 pt-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Points Shop</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Spend your points on this week's prizes. Restocks every Tuesday at
            1:00 PM ET.
          </p>
        </div>
        <RestockCountdown />
      </div>

      {/* Balance strip */}
      <Card className="mb-6">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          {isConnected && address ? (
            <>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                  Available points
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {balanceQuery.isLoading ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    formatNumber(availablePoints ?? 0)
                  )}
                </p>
              </div>
              <Coins className="h-6 w-6 text-muted-foreground/60" />
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connect a wallet to see your balance and buy.
              </p>
              <ConnectButton variant="default" size="small" />
            </>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      {shopQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      ) : shopQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Unable to load the shop
            </CardTitle>
            <CardDescription>
              Something went wrong fetching this week's inventory. Try again
              shortly.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : !shopQuery.data?.weekKey || shopQuery.data.items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              This week's shop is being prepared
            </CardTitle>
            <CardDescription>Check back shortly.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shopQuery.data.items.map((item) => (
            <ShopItemCard
              key={item.itemId}
              item={item}
              canAfford={
                availablePoints !== null && availablePoints >= item.pricePoints
              }
              onBuy={handleBuy}
            />
          ))}
        </div>
      )}

      <PurchaseDialog
        item={selectedItem}
        availablePoints={availablePoints}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </section>
  );
}

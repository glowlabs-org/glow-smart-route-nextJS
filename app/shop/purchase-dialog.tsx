"use client";

import * as React from "react";
import Image from "next/image";
import { useAccount, useChainId, useSignTypedData } from "wagmi";
import { Loader2, CheckCircle2, XCircle, Ticket } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FallbackImage } from "@/components/ui/fallback-image";
import { formatNumber } from "@/utils/format";
import { trackEvent } from "@/lib/telemetry";
import { V2ApiError } from "@/lib/api/v2-api-client";
import {
  pointsShopEIP712Domain,
  purchaseEIP712Types,
  useV2ShopPurchase,
  type V2ShopItem,
  type V2ShopPurchaseResult,
} from "@/hooks/v2-points-shop";
import { shopItemMeta } from "@/app/shop/shop-item-meta";
import type { ShopMinerFarmInfo } from "@/hooks/v2-shop-miner";

function formatGlwAmount(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
  });
}

/** The prize visual shown at the top of the purchase flow. */
function ItemBanner({
  item,
  minerFarm,
}: {
  item: V2ShopItem;
  minerFarm?: ShopMinerFarmInfo;
}) {
  const meta = shopItemMeta(item);
  const farmImage =
    item.kind === "miner" && minerFarm?.resolved ? minerFarm.imageUrl : null;
  const tagline =
    item.kind === "miner" && minerFarm?.resolved && minerFarm.farmName
      ? minerFarm.farmName
      : meta.tagline;

  if (meta.isTicket) {
    return (
      <div className="glow-gradient-b relative flex h-36 w-full flex-col justify-end overflow-hidden rounded-2xl p-4">
        <Ticket className="absolute right-4 top-4 h-6 w-6 text-black/55" />
        <span className="mb-1.5 w-fit rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white">
          {meta.eyebrow}
        </span>
        <p className="text-lg font-semibold leading-tight text-black/85">
          {meta.headline}
        </p>
        <p className="mt-0.5 text-xs text-black/55">{tagline}</p>
      </div>
    );
  }

  return (
    <div className="relative h-36 w-full overflow-hidden rounded-2xl">
      {farmImage ? (
        <FallbackImage
          src={farmImage}
          alt={tagline ?? item.label}
          widthForProxy={640}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : meta.image ? (
        <Image
          src={meta.image}
          alt={item.label}
          fill
          sizes="480px"
          className="object-cover"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/5" />
      <span className="absolute left-4 top-4 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white ring-1 ring-white/25 backdrop-blur-md">
        {meta.eyebrow}
      </span>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-lg font-semibold leading-tight text-white">
          {meta.headline}
        </p>
        <p className="mt-0.5 text-xs text-white/75">{tagline}</p>
      </div>
    </div>
  );
}

/** A compact "what you get" strip for a farm-linked miner. */
function MinerEstimateStrip({ minerFarm }: { minerFarm: ShopMinerFarmInfo }) {
  if (!minerFarm.resolved) return null;
  const reward =
    minerFarm.weeklyGlwRewards != null
      ? `${formatGlwAmount(minerFarm.weeklyGlwRewards)} GLW/wk`
      : null;
  const weeks =
    minerFarm.weeksRemaining != null ? `${minerFarm.weeksRemaining} weeks` : null;
  if (!reward && !weeks) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 dark:border-white/10 dark:bg-zinc-900">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          Est. reward
        </p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums">
          {reward ?? "-"}
        </p>
      </div>
      <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 dark:border-white/10 dark:bg-zinc-900">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          Weeks left
        </p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums">
          {weeks ?? "-"}
        </p>
      </div>
    </div>
  );
}

interface PurchaseDialogProps {
  item: V2ShopItem | null;
  /** Wallet's available point balance, for the affordability check + display. */
  availablePoints: number | null;
  /** Resolved source-farm info when the item is a farm-linked miner. */
  minerFarm?: ShopMinerFarmInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase = "confirm" | "pending" | "success" | "error";

// Map the CRM error `code` to a plain, user-facing reason.
function errorMessageForCode(code: string | undefined, fallback: string): string {
  switch (code) {
    case "INSUFFICIENT_POINTS":
      return "You don't have enough points for this item.";
    case "SOLD_OUT":
      return "This item just sold out.";
    case "WEEK_CLOSED":
      return "This shop week has closed.";
    case "ITEM_DISABLED":
      return "This item is no longer available.";
    case "BAD_NONCE":
      return "Purchase conflict. Please try again.";
    case "FOUNDATION_WATTS_INSUFFICIENT":
    case "FOUNDATION_SPLIT_INSUFFICIENT":
      return "This prize is temporarily unavailable. Try again later.";
    case "IDEMPOTENCY_KEY_REUSED_DIFFERENT_BODY":
      return "Purchase conflict. Please close this and start over.";
    case "INVALID_SIGNATURE":
      return "Signature verification failed. Please try again.";
    default:
      return fallback;
  }
}

function GrantSummary({ result }: { result: V2ShopPurchaseResult }) {
  const g = result.grant;
  switch (g.kind) {
    case "miner":
      return (
        <p className="text-sm text-muted-foreground">
          Your ${g.minerValueUsd ?? "?"} miner prize is recorded. It will be
          fulfilled to your wallet.
        </p>
      );
    case "watts":
      return (
        <p className="text-sm text-muted-foreground">
          {formatNumber(Number(g.wattsGranted))} watts added to your impact
          {g.newWalletWatts != null
            ? `, you now hold ${formatNumber(Number(g.newWalletWatts))} watts.`
            : "."}
        </p>
      );
    case "mega":
      return (
        <p className="text-sm text-muted-foreground">
          Mega prize claimed. The team will follow up on fulfilment.
        </p>
      );
    case "early_access":
      return (
        <p className="text-sm text-muted-foreground">
          Early access active: {g.earlyAccessMinutes} minutes early on miner
          windows, valid until {new Date(g.expiresAt).toLocaleDateString()}.
        </p>
      );
    default:
      return null;
  }
}

export function PurchaseDialog({
  item,
  availablePoints,
  minerFarm,
  open,
  onOpenChange,
}: PurchaseDialogProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();
  const purchaseMutation = useV2ShopPurchase();

  const [phase, setPhase] = React.useState<Phase>("confirm");
  const [result, setResult] = React.useState<V2ShopPurchaseResult | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string>("");

  // One idempotency key per dialog session, stable across retries so a
  // lost-response retry is deduped server-side.
  const idempotencyKeyRef = React.useRef<string>("");

  // Reset state each time the dialog opens for a (new) item.
  React.useEffect(() => {
    if (open) {
      setPhase("confirm");
      setResult(null);
      setErrorMsg("");
      idempotencyKeyRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `shop-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, [open, item?.itemId]);

  if (!item) return null;

  const price = item.pricePoints;
  const balance = availablePoints ?? 0;
  const canAfford = balance >= price;
  const balanceAfter = Math.max(0, balance - price);
  const showMinerEstimate = item.kind === "miner" && Boolean(minerFarm?.resolved);

  async function handleConfirm() {
    if (!address || !item) return;
    setPhase("pending");
    setErrorMsg("");
    trackEvent("shop_purchase_attempted", {
      itemId: item.itemId,
      kind: item.kind,
      price_points: price,
      wallet: address,
    });

    try {
      // Nonce: a fresh monotonic value per attempt (the backend requires
      // strictly-increasing per-wallet nonces). Millisecond clock works.
      const nonce = BigInt(Date.now());
      const idempotencyKey = idempotencyKeyRef.current;
      const message = {
        wallet: address as `0x${string}`,
        itemId: item.itemId,
        quantity: 1n,
        idempotencyKey,
        nonce,
      } as const;

      let signature: string;
      try {
        signature = await signTypedDataAsync({
          account: address as `0x${string}`,
          domain: pointsShopEIP712Domain(chainId),
          types: purchaseEIP712Types,
          primaryType: "Purchase",
          message,
        });
      } catch {
        // User rejected the signature (or wallet error); return to confirm,
        // no error state.
        setPhase("confirm");
        return;
      }

      const purchaseResult = await purchaseMutation.mutateAsync({
        wallet: address,
        itemId: item.itemId,
        quantity: 1,
        idempotencyKey,
        nonce: nonce.toString(),
        signature,
      });

      setResult(purchaseResult);
      setPhase("success");
      trackEvent("shop_purchase_succeeded", {
        itemId: item.itemId,
        kind: item.kind,
        purchase_id: purchaseResult.purchaseId,
        wallet: address,
      });
    } catch (err) {
      const code = err instanceof V2ApiError ? err.code : undefined;
      const fallback =
        err instanceof Error ? err.message : "The purchase could not complete.";
      setErrorMsg(errorMessageForCode(code, fallback));
      setPhase("error");
      trackEvent("shop_purchase_failed", {
        itemId: item.itemId,
        kind: item.kind,
        error_code: code ?? "unknown",
        wallet: address,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
        {phase === "success" && result ? (
          <div className="flex flex-col">
            <div className="p-3">
              <ItemBanner item={item} minerFarm={minerFarm} />
            </div>
            <div className="flex flex-col gap-4 px-6 pb-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Purchase complete
                </DialogTitle>
                <DialogDescription>
                  Your prize is recorded and on its way.
                </DialogDescription>
              </DialogHeader>
              <GrantSummary result={result} />
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm dark:border-white/10 dark:bg-zinc-900">
                <span className="text-muted-foreground">New point balance</span>
                <span className="text-base font-semibold tabular-nums">
                  {formatNumber(Number(result.newPointsBalance))}
                </span>
              </div>
              <DialogFooter>
                <Button className="w-full" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          </div>
        ) : phase === "error" ? (
          <div className="flex flex-col gap-4 p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Purchase failed
              </DialogTitle>
              <DialogDescription>{errorMsg}</DialogDescription>
            </DialogHeader>
            <p className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground dark:border-white/10 dark:bg-zinc-900">
              Your points were not spent.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => setPhase("confirm")}>Try again</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="p-3">
              <ItemBanner item={item} minerFarm={minerFarm} />
            </div>
            <div className="flex flex-col gap-4 px-6 pb-6">
              <DialogHeader>
                <DialogTitle>Confirm purchase</DialogTitle>
                <DialogDescription>
                  Review and redeem this week's prize.
                </DialogDescription>
              </DialogHeader>

              {showMinerEstimate && minerFarm ? (
                <MinerEstimateStrip minerFarm={minerFarm} />
              ) : null}

              {/* Cost summary */}
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 dark:border-white/10 dark:bg-zinc-900">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                    Cost
                  </span>
                  <span className="text-2xl font-semibold tabular-nums leading-none">
                    {formatNumber(price)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      points
                    </span>
                  </span>
                </div>
                <div className="my-3 border-t border-border/50 dark:border-white/10" />
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your balance</span>
                    <span className="tabular-nums">
                      {formatNumber(balance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Balance after</span>
                    <span className="font-semibold tabular-nums">
                      {canAfford ? formatNumber(balanceAfter) : "-"}
                    </span>
                  </div>
                </div>
                {!canAfford ? (
                  <p className="mt-2.5 text-xs font-medium text-red-600">
                    You don't have enough points for this prize.
                  </p>
                ) : null}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={phase === "pending"}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!canAfford || phase === "pending" || !address}
                >
                  {phase === "pending" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Confirming
                    </>
                  ) : (
                    "Confirm purchase"
                  )}
                </Button>
              </DialogFooter>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

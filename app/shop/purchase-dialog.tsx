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

/** The prize visual shown at the top of the purchase flow. */
function ItemBanner({ item }: { item: V2ShopItem }) {
  const meta = shopItemMeta(item);

  if (meta.image) {
    return (
      <div className="relative h-32 w-full overflow-hidden rounded-xl">
        <Image
          src={meta.image}
          alt={item.label}
          fill
          sizes="480px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/5" />
        <span className="absolute left-3 top-3 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white ring-1 ring-white/25 backdrop-blur-md">
          {meta.eyebrow}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="text-base font-semibold leading-tight text-white">
            {meta.headline}
          </p>
          <p className="mt-0.5 text-[11px] text-white/75">{meta.tagline}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glow-gradient-b relative flex h-32 w-full flex-col justify-end overflow-hidden rounded-xl p-3">
      <Ticket className="absolute right-3 top-3 h-5 w-5 text-black/55" />
      <span className="mb-1 w-fit rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white">
        {meta.eyebrow}
      </span>
      <p className="text-base font-semibold leading-tight text-black/85">
        {meta.headline}
      </p>
      <p className="mt-0.5 text-[11px] text-black/55">{meta.tagline}</p>
    </div>
  );
}

interface PurchaseDialogProps {
  item: V2ShopItem | null;
  /** Wallet's available point balance, for the affordability check + display. */
  availablePoints: number | null;
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
      <DialogContent className="sm:max-w-md">
        {phase === "success" && result ? (
          <>
            <ItemBanner item={item} />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Purchase complete
              </DialogTitle>
              <DialogDescription>
                Your prize is recorded and on its way.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <GrantSummary result={result} />
              <div className="rounded-xl bg-muted/40 px-3 py-2 text-sm">
                New point balance:{" "}
                <span className="font-semibold tabular-nums">
                  {formatNumber(Number(result.newPointsBalance))}
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : phase === "error" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Purchase failed
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <p className="text-sm">{errorMsg}</p>
              <p className="text-xs text-muted-foreground">
                Your points were not spent.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => setPhase("confirm")}>Try again</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <ItemBanner item={item} />
            <DialogHeader>
              <DialogTitle>Confirm purchase</DialogTitle>
              <DialogDescription>
                Spend your points to redeem this prize.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost</span>
                <span className="font-semibold tabular-nums">
                  {formatNumber(price)} points
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your balance</span>
                <span className="tabular-nums">{formatNumber(balance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance after</span>
                <span className="tabular-nums">
                  {canAfford ? formatNumber(balanceAfter) : "-"}
                </span>
              </div>
              {!canAfford ? (
                <p className="pt-1 text-xs text-red-600">
                  You don't have enough points for this item.
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
                    Confirming…
                  </>
                ) : (
                  "Confirm purchase"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

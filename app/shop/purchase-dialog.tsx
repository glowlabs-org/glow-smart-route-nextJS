"use client";

import * as React from "react";
import Image from "next/image";
import { useAccount, useChainId, useSignTypedData } from "wagmi";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Ticket,
  Share2,
  Minus,
  Plus,
} from "lucide-react";

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
import {
  getShopMinerValueUsd,
  isMinerLikeItem,
  type ShopMinerFarmInfo,
} from "@/hooks/v2-shop-miner";
import {
  getInitialPositionValueGuard,
  INITIAL_POSITION_USD_GRACE,
  MIN_INITIAL_POSITION_USD,
} from "@/lib/initial-position-guard";

function formatGlwAmount(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
  });
}

// Zero-width spaces keep the share text from auto-linking the domain (mirrors
// the marketplace deposit dialog's share copy).
const SHOP_SHARE_DOMAIN = "app.\u200Bglow.\u200Borg";

/**
 * Builds an X (Twitter) intent URL the buyer can post after redeeming a prize,
 * mirroring the marketplace Miners/Delegations share prompts. Copy is tailored
 * per item kind so a watts or early-access purchase never claims a miner.
 */
function buildShopShareUrl(item: V2ShopItem): string {
  const headline = isMinerLikeItem(item)
    ? "I just used my Points to buy a Glow Miner in the Rewards Shop and started earning GLW tokens weekly."
    : item.kind === "watts"
      ? "I just used my Points to buy Watts in the Glow Rewards Shop and grew my clean-energy impact."
      : "I just unlocked early miner access in the Glow Rewards Shop.";
  const text = [headline, "", SHOP_SHARE_DOMAIN].join("\n");
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
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
  const minerLike = isMinerLikeItem(item);
  // Any watts prize (featured or regular) overlays its live source-farm photo
  // (the "farm story") when one exists; when there's no source preview, the
  // banner falls back to meta.image (watts-mega.jpg for the featured prize).
  const wattsSource =
    item.kind === "watts"
      ? item.impactSourcePreview?.sources?.[0]
      : undefined;
  const farmImage =
    minerLike && minerFarm?.resolved
      ? minerFarm.imageUrl
      : wattsSource?.imageUrl ?? null;
  const tagline =
    minerLike && minerFarm?.resolved && minerFarm.farmName
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
      ) : meta.image?.startsWith("http") ? (
        <FallbackImage
          src={meta.image}
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
/** True when a miner grant's Control split-transfer hasn't completed yet (the
 * public grant keeps a safe fulfilment `status`). */
function minerFulfillmentPending(grant: unknown): boolean {
  const status = (grant as { fulfillment?: { status?: string } } | null)
    ?.fulfillment?.status;
  return status === "pending" || status === "pending_retry";
}

function MinerEstimateStrip({
  minerFarm,
  isManualFulfillment,
}: {
  minerFarm: ShopMinerFarmInfo;
  isManualFulfillment?: boolean;
}) {
  if (!minerFarm.resolved) return null;
  const reward =
    minerFarm.weeklyGlwRewards != null
      ? `${formatGlwAmount(minerFarm.weeklyGlwRewards)} GLW/wk`
      : null;
  const weeks =
    minerFarm.weeksRemaining != null ? `${minerFarm.weeksRemaining} weeks` : null;
  if (!reward && !weeks) return null;

  return (
    <div className="space-y-1.5">
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
      {isManualFulfillment ? (
        <p className="text-[10px] leading-relaxed text-muted-foreground/70">
          Estimated — this prize is fulfilled manually by the team, so the
          exact reward split and timing may differ.
        </p>
      ) : null}
    </div>
  );
}

function WattsSourceStrip({
  item,
  quantity = 1,
}: {
  item: V2ShopItem;
  /** Buyer-selected quantity; the previewed watts/carbon are per-unit, so they
   * scale by this for the total a bulk purchase would attribute. */
  quantity?: number;
}) {
  if (item.kind !== "watts") return null;
  const sources = item.impactSourcePreview?.sources ?? [];
  if (sources.length === 0) return null;
  const perUnitWatts = sources.reduce(
    (acc, source) => acc + (Number(source.watts) || 0),
    0,
  );
  const perUnitCarbon = sources.reduce(
    (acc, source) => acc + (Number(source.carbonCredits) || 0),
    0,
  );
  const totalWatts = perUnitWatts * quantity;
  const totalCarbon = perUnitCarbon * quantity;
  const first = sources[0];
  const farmName = first.farmName ?? "Foundation solar farm";
  const region = first.regionName ?? `Region ${first.regionId}`;
  const extraCount = Math.max(0, sources.length - 1);

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        These watts come from <span className="font-medium text-foreground">{farmName}</span>
        {region ? ` in ${region}` : ""}
        {extraCount > 0
          ? ` and ${extraCount} more farm${extraCount === 1 ? "" : "s"}`
          : ""}
        . The watts are the main thing; their associated impact comes with
        them, including Tons of CO₂ today and the Solar Footprint equivalents
        they power.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 dark:border-white/10 dark:bg-zinc-900">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            Watts attributed
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {formatNumber(totalWatts)} W
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 dark:border-white/10 dark:bg-zinc-900">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            Tons of CO₂
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {formatNumber(totalCarbon)}
          </p>
        </div>
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
  /** True when Control reports that this wallet already owns reward splits. */
  hasExistingRewardSplits: boolean;
  /** Strict Control ownership check used before small miner redemptions. */
  isCheckingRewardSplitOwnership: boolean;
  isRewardSplitOwnershipError: boolean;
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
    case "INITIAL_POSITION_TOO_SMALL":
      return "This miner prize is only available after your wallet already has miner or delegated rewards.";
    case "REWARD_SPLIT_OWNERSHIP_UNVERIFIED":
      return "We couldn't verify your existing reward splits. Please try again before redeeming this miner.";
    default:
      return fallback;
  }
}

function GrantSummary({
  result,
  item,
}: {
  result: V2ShopPurchaseResult;
  item: V2ShopItem;
}) {
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
      {
        const carbon =
          g.carbonCreditsGranted != null
            ? Number(g.carbonCreditsGranted)
            : null;
        const firstSource = g.sourceFarmTransfers?.[0];
        const previewSource = item.impactSourcePreview?.sources?.[0];
        const sourceName =
          firstSource?.farmName ??
          previewSource?.farmName ??
          "Foundation solar farm";
        const regionName = firstSource?.regionName ?? previewSource?.regionName;
        return (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              {formatNumber(Number(g.wattsGranted))} watts added to your impact
              {carbon != null && Number.isFinite(carbon)
                ? ` with ${formatNumber(carbon)} tons of CO₂`
                : ""}
              {g.newWalletWatts != null
                ? `, you now hold ${formatNumber(Number(g.newWalletWatts))} watts.`
                : "."}
            </p>
            {firstSource ? (
              <p>
                Source: {sourceName}
                {regionName ? `, ${regionName}` : ""}.
              </p>
            ) : null}
          </div>
        );
      }
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
  hasExistingRewardSplits,
  isCheckingRewardSplitOwnership,
  isRewardSplitOwnershipError,
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
  // Buyer-selected quantity (watts prizes only; see allowsQuantity below).
  const [quantity, setQuantity] = React.useState(1);

  // One idempotency key per (wallet, item), PERSISTED across reopen and rotated
  // only after a confirmed success (see handleConfirm). This is what makes an
  // accidental close+reopen mid-flight safe: the reopened dialog reuses the
  // same key, so the backend dedupes on (wallet, idempotencyKey) instead of
  // charging twice.
  const idempotencyKeyRef = React.useRef<{ for: string; key: string }>({
    for: "",
    key: "",
  });

  // Reset transient UI state each time the dialog opens, and mint a NEW
  // idempotency key only when (wallet, item) changed since last time.
  React.useEffect(() => {
    if (open) {
      setPhase("confirm");
      setResult(null);
      setErrorMsg("");
      setQuantity(1);
      const currentFor = `${address?.toLowerCase() ?? ""}:${item?.itemId ?? ""}`;
      if (idempotencyKeyRef.current.for !== currentFor) {
        idempotencyKeyRef.current = {
          for: currentFor,
          key:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `shop-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
      }
    }
  }, [open, item?.itemId, address]);

  // Post-purchase "Share on X" CTA (mirrors the marketplace Miners/Delegations
  // share prompts). Declared before the early return so hook order is stable.
  const shareUrl = React.useMemo(
    () => (item ? buildShopShareUrl(item) : null),
    [item],
  );
  const handleShareOnX = React.useCallback(() => {
    if (!item || !shareUrl) return;
    trackEvent("shop_purchase_share_x_click", {
      itemId: item.itemId,
      kind: item.kind,
      wallet: address,
    });
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }, [item, shareUrl, address]);

  if (!item) return null;

  const unitPrice = item.pricePoints;
  // Only watts prizes can be bought in bulk: the backend pins miners to qty 1
  // (INVALID_MINER_QUANTITY) and early access is a single entitlement.
  const allowsQuantity = item.kind === "watts";
  // Hard ceiling mirrors the EIP-712 schema bound (quantity is a uint, max 100),
  // further capped by this item's remaining inventory.
  const QTY_HARD_MAX = 100;
  const inventoryCap =
    item.inventoryRemaining == null ? QTY_HARD_MAX : item.inventoryRemaining;
  const maxQuantity = allowsQuantity
    ? Math.max(1, Math.min(QTY_HARD_MAX, inventoryCap))
    : 1;
  // Clamp the live selection so inventory shrinking under us (a refetch after
  // someone else buys) can never let the signed quantity exceed availability.
  const effectiveQuantity = Math.min(Math.max(1, quantity), maxQuantity);
  const perUnitWatts =
    item.kind === "watts" ? Number(item.details?.wattsQuantity ?? 0) : 0;
  const totalPrice = unitPrice * effectiveQuantity;
  const fulfillmentPending =
    result != null && minerFulfillmentPending(result.grant);
  const balance = availablePoints ?? 0;
  const canAfford = balance >= totalPrice;
  const balanceAfter = Math.max(0, balance - totalPrice);
  // The "+" stepper stops at inventory/hard-max AND at what the wallet can still
  // afford, so a bulk selection can never be built past the balance.
  const canIncrement =
    allowsQuantity &&
    effectiveQuantity < maxQuantity &&
    balance >= unitPrice * (effectiveQuantity + 1);
  const canDecrement = effectiveQuantity > 1;
  const showMinerEstimate =
    isMinerLikeItem(item) && Boolean(minerFarm?.resolved);
  const minerValueUsd = getShopMinerValueUsd(item);
  const requiresExistingRewardSplit =
    isMinerLikeItem(item) &&
    minerValueUsd > 0 &&
    minerValueUsd + INITIAL_POSITION_USD_GRACE < MIN_INITIAL_POSITION_USD;
  const initialPositionGuard = getInitialPositionValueGuard({
    purchaseValueUsd: minerValueUsd,
    hasExistingPositions: hasExistingRewardSplits,
  });
  const rewardSplitGuardMessage = requiresExistingRewardSplit
    ? isCheckingRewardSplitOwnership
      ? "Checking whether this wallet already has miner or delegated rewards."
      : isRewardSplitOwnershipError
        ? "We couldn't verify your existing reward splits from Control. Try again before redeeming this miner."
        : initialPositionGuard.isBlocked
          ? `Small miner prizes are for wallets that already have miner or delegated rewards. Your first miner or delegation should total at least $${MIN_INITIAL_POSITION_USD.toLocaleString()} so future reward claims stay worth the gas.`
          : null
    : null;
  const isRewardSplitGuardBlocked =
    requiresExistingRewardSplit &&
    (isCheckingRewardSplitOwnership ||
      isRewardSplitOwnershipError ||
      initialPositionGuard.isBlocked);

  async function handleConfirm() {
    if (!address || !item) return;
    if (isRewardSplitGuardBlocked) {
      setErrorMsg(
        rewardSplitGuardMessage ??
          "This miner prize is not available for this wallet yet.",
      );
      setPhase("error");
      trackEvent("shop_purchase_blocked_initial_position", {
        itemId: item.itemId,
        kind: item.kind,
        miner_value_usd: minerValueUsd,
        wallet: address,
      });
      return;
    }
    setPhase("pending");
    setErrorMsg("");
    trackEvent("shop_purchase_attempted", {
      itemId: item.itemId,
      kind: item.kind,
      price_points: totalPrice,
      quantity: effectiveQuantity,
      wallet: address,
    });

    try {
      // Nonce: a fresh monotonic value per attempt (the backend requires
      // strictly-increasing per-wallet nonces). Millisecond clock works.
      const nonce = BigInt(Date.now());
      const idempotencyKey = idempotencyKeyRef.current.key;
      // scaled6 micros: authorize exactly the displayed total (unitPrice * qty).
      // The backend rejects PRICE_CHANGED if the live price is higher.
      const maxPointsCost = BigInt(Math.round(totalPrice * 1_000_000));
      const message = {
        wallet: address as `0x${string}`,
        itemId: item.itemId,
        quantity: BigInt(effectiveQuantity),
        maxPointsCost,
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
        quantity: effectiveQuantity,
        maxPointsCost: maxPointsCost.toString(),
        idempotencyKey,
        nonce: nonce.toString(),
        signature,
        // Verify against the same chain the domain was signed on.
        chainId,
      });

      setResult(purchaseResult);
      setPhase("success");
      // Rotate the idempotency key so a later purchase of the same item is a
      // NEW sale, not a dedup of the one just completed.
      idempotencyKeyRef.current = { for: "", key: "" };
      trackEvent("shop_purchase_succeeded", {
        itemId: item.itemId,
        kind: item.kind,
        purchase_id: purchaseResult.purchaseId,
        quantity: effectiveQuantity,
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Block closing mid-flight: the signature/POST may still commit the
        // spend server-side, and a close+reopen used to mint a new idempotency
        // key and double-charge.
        if (phase === "pending" && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="gap-0 overflow-hidden bg-white p-0 sm:max-w-sm dark:bg-card"
        showCloseButton={phase !== "pending"}
        onEscapeKeyDown={(e) => {
          if (phase === "pending") e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (phase === "pending") e.preventDefault();
        }}
      >
        {phase === "success" && result ? (
          <div className="flex flex-col">
            <div className="p-3">
              <ItemBanner item={item} minerFarm={minerFarm} />
            </div>
            <div className="flex flex-col gap-4 px-6 pb-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  {fulfillmentPending ? "Purchase recorded" : "Purchase complete"}
                </DialogTitle>
                <DialogDescription>
                  {fulfillmentPending
                    ? "Recorded — your miner is being fulfilled and will appear shortly."
                    : "Your prize is recorded and on its way."}
                </DialogDescription>
              </DialogHeader>
              <GrantSummary result={result} item={item} />
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm dark:border-white/10 dark:bg-zinc-900">
                <span className="text-muted-foreground">New point balance</span>
                <span className="text-base font-semibold tabular-nums">
                  {formatNumber(Number(result.newPointsBalance))}
                </span>
              </div>
              <div className="space-y-2">
                {shareUrl ? (
                  <Button className="w-full" onClick={handleShareOnX}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share on X
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => onOpenChange(false)}
                >
                  Done
                </Button>
              </div>
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
                <MinerEstimateStrip
                  minerFarm={minerFarm}
                  isManualFulfillment={false}
                />
              ) : null}

              <WattsSourceStrip item={item} quantity={effectiveQuantity} />

              {allowsQuantity ? (
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 dark:border-white/10 dark:bg-zinc-900">
                  <div>
                    <p className="text-sm font-medium">Quantity</p>
                    {perUnitWatts > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(perUnitWatts)} W each
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() =>
                        setQuantity(Math.max(1, effectiveQuantity - 1))
                      }
                      disabled={!canDecrement || phase === "pending"}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center text-lg font-semibold tabular-nums">
                      {effectiveQuantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={() =>
                        setQuantity(Math.min(maxQuantity, effectiveQuantity + 1))
                      }
                      disabled={!canIncrement || phase === "pending"}
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}

              {rewardSplitGuardMessage ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  {rewardSplitGuardMessage}
                </p>
              ) : null}

              {/* Cost summary */}
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 dark:border-white/10 dark:bg-zinc-900">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                    Cost
                  </span>
                  <span className="text-2xl font-semibold tabular-nums leading-none">
                    {formatNumber(totalPrice)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      points
                    </span>
                  </span>
                </div>
                {effectiveQuantity > 1 ? (
                  <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
                    {formatNumber(effectiveQuantity)} × {formatNumber(unitPrice)}{" "}
                    points
                  </p>
                ) : null}
                <div className="my-3 border-t border-border/50 dark:border-white/10" />
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your balance</span>
                    <span className="tabular-nums">
                      {/* Floor so the display never overstates holdings (and
                          thus never implies you can afford something you can't);
                          affordability itself uses the exact value. */}
                      {formatNumber(Math.floor(balance))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Balance after</span>
                    <span className="font-semibold tabular-nums">
                      {canAfford ? formatNumber(Math.floor(balanceAfter)) : "-"}
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
                  disabled={
                    !canAfford ||
                    phase === "pending" ||
                    !address ||
                    isRewardSplitGuardBlocked
                  }
                >
                  {phase === "pending" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Confirming
                    </>
                  ) : isCheckingRewardSplitOwnership &&
                    requiresExistingRewardSplit ? (
                    "Checking wallet"
                  ) : isRewardSplitGuardBlocked ? (
                    "Not eligible"
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

"use client";

/**
 * V2 points-shop hooks — weekly inventory, purchase history, early-access
 * entitlements, and the purchase mutation.
 *
 * All hit the app-local proxy routes under `/api/points-shop/*`. The
 * purchase mutation accepts an already-EIP-712-signed body; building the
 * typed-data signature is the purchase-flow's responsibility (see the
 * shop purchase UI).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { v2ApiGet, v2ApiPost } from "@/lib/api/v2-api-client";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { STALE_TIMES } from "@/hooks/query-config";

// --- EIP-712 purchase signing ----------------------------------------------
// The `/points-shop/purchase` POST is authenticated by an EIP-712 signature
// over the Purchase struct, signed by the buyer wallet. Mirrors the
// referral-router signing pattern (see hooks/use-referral.ts). The backend
// verifies against this exact domain + type.

export const pointsShopEIP712Domain = (chainId: number) =>
  ({
    name: "GlowPointsShop",
    version: "1",
    chainId,
    verifyingContract: "0x0000000000000000000000000000000000000000" as const,
  }) as const;

export const purchaseEIP712Types = {
  Purchase: [
    { name: "wallet", type: "address" },
    { name: "itemId", type: "string" },
    { name: "quantity", type: "uint256" },
    { name: "idempotencyKey", type: "string" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export type V2ShopItemKind = "miner" | "watts" | "mega" | "early_access";

export interface V2ShopItem {
  itemId: string;
  kind: V2ShopItemKind;
  label: string;
  pricePoints: number;
  inventoryTotal: number | null;
  inventoryRemaining: number | null;
  details: Record<string, unknown> | null;
  /** Backend-computed: enabled AND (uncapped OR inventoryRemaining > 0). */
  available: boolean;
}

export interface V2ShopCurrent {
  weekKey: string | null;
  openedAt?: string;
  closesAt?: string;
  items: V2ShopItem[];
}

// --- Grant payloads, discriminated by `kind` -------------------------------

export interface V2MinerGrant {
  kind: "miner";
  minerEntitlementId: string;
  minerValueUsd: number | null;
  /** Present only for fulfilment-aware items (Phase 4). */
  splitTransferRef?: {
    farmId: string;
    epoch: number;
    glowPercent6Decimals: string;
  };
}

export interface V2WattsGrant {
  kind: "watts";
  wattsGranted: string;
  newWalletWatts: string | null;
}

export interface V2MegaGrant {
  kind: "mega";
  megaKey: string | null;
  details: Record<string, unknown>;
}

export interface V2EarlyAccessGrant {
  kind: "early_access";
  entitlementId: string;
  startsAt: string;
  expiresAt: string;
  earlyAccessMinutes: number;
}

export type V2ShopGrant =
  | V2MinerGrant
  | V2WattsGrant
  | V2MegaGrant
  | V2EarlyAccessGrant;

// --- Purchase --------------------------------------------------------------

/** The fully-signed POST body for `/api/points-shop/purchase`. */
export interface V2ShopPurchaseRequest {
  wallet: string;
  itemId: string;
  quantity: number;
  idempotencyKey: string;
  /** Decimal-encoded uint; must be strictly greater than the wallet's prior nonce. */
  nonce: string;
  /** EIP-712 signature over the Purchase typed-data. */
  signature: string;
  /** Chain the wallet signed the EIP-712 domain on; the backend verifies
   * against exactly this. */
  chainId: number;
}

export interface V2ShopPurchaseResult {
  purchaseId: string;
  wallet: string;
  itemId: string;
  kind: V2ShopItemKind;
  quantity: number;
  pricePointsTotal: string;
  grant: V2ShopGrant;
  newPointsBalance: string;
  alreadyProcessed: boolean;
  createdAt: string;
}

export interface V2ShopPurchaseRow {
  purchaseId: string;
  createdAt: string;
  itemId: string;
  kind: V2ShopItemKind;
  quantity: number;
  pricePointsTotal: string;
  grant: V2ShopGrant;
}

export interface V2ShopPurchasesResponse {
  wallet: string;
  rows: V2ShopPurchaseRow[];
  nextCursor: string | null;
}

// --- Early access ----------------------------------------------------------

export interface V2EarlyAccessEntitlement {
  entitlementId: string;
  scope: "miner";
  startsAt: string;
  expiresAt: string;
  earlyAccessMinutes: number;
  active: boolean;
  sourcePurchaseId: string | null;
}

export interface V2EarlyAccessResponse {
  wallet: string;
  now: string;
  entitlements: V2EarlyAccessEntitlement[];
}

// --- Hooks -----------------------------------------------------------------

export function useV2ShopCurrent() {
  return useQuery({
    queryKey: QUERY_KEYS.v2.shopCurrent(),
    queryFn: () => v2ApiGet<V2ShopCurrent>("/api/points-shop/current"),
    staleTime: STALE_TIMES.NORMAL,
    refetchOnWindowFocus: false,
  });
}

export function useV2ShopPurchases(wallet: string | null | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.v2.shopPurchases(wallet),
    queryFn: () =>
      v2ApiGet<V2ShopPurchasesResponse>(
        `/api/points-shop/purchases?wallet=${encodeURIComponent(wallet!)}`,
      ),
    enabled: Boolean(wallet),
    staleTime: STALE_TIMES.NORMAL,
    refetchOnWindowFocus: false,
  });
}

export function useV2EarlyAccess(wallet: string | null | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.v2.earlyAccess(wallet),
    queryFn: () =>
      v2ApiGet<V2EarlyAccessResponse>(
        `/api/points-shop/early-access?wallet=${encodeURIComponent(wallet!)}`,
      ),
    enabled: Boolean(wallet),
    staleTime: STALE_TIMES.NORMAL,
    refetchOnWindowFocus: false,
  });
}

/**
 * Submit a signed shop purchase. On success, invalidates the wallet's
 * point balance + purchase history + early-access entitlements and the
 * shared shop inventory (a purchase decrements `inventoryRemaining`).
 */
export function useV2ShopPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: V2ShopPurchaseRequest) =>
      v2ApiPost<V2ShopPurchaseResult>("/api/points-shop/purchase", body),
    onSuccess: (result) => {
      const wallet = result.wallet.toLowerCase();
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.v2.pointsBalance(wallet),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.v2.pointsLedger(wallet),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.v2.shopPurchases(wallet),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.v2.earlyAccess(wallet),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.v2.shopCurrent(),
      });
    },
  });
}

"use client";

export interface WalletRewardClaimRow {
  id: string;
  source: "minerPool" | "rewardsKernel";
  wallet: `0x${string}`;
  claimant?: `0x${string}` | null;
  token: `0x${string}`;
  amount: string;
  nonce?: string | null;
  timestamp: number;
  blockNumber: number;
  txHash: `0x${string}`;
  logIndex: number;
  subIndex: number;
}

export interface WalletRewardClaimsResponse {
  address: `0x${string}`;
  limit: number;
  indexingComplete: boolean;
  claims: WalletRewardClaimRow[];
}

export interface WalletRewardClaimsIndex {
  indexingComplete: boolean;
  claimedV2Nonces: Set<string>;
  claimedV1Buckets: Set<string>;
  hasMinerPoolBucketIds: boolean;
}

export interface FetchWalletRewardClaimsIndexParams {
  walletAddress: `0x${string}`;
  limit: number;
  baseUrl?: string;
}

const DEFAULT_POSITIONS_API_BASE =
  process.env.NEXT_PUBLIC_POSITIONS_API_BASE || "http://localhost:42069";

export const DEFAULT_WALLET_CLAIMS_LIMIT = 5000;

function asLowerHexAddress(value: `0x${string}`): `0x${string}` {
  return value.toLowerCase() as `0x${string}`;
}

export async function fetchWalletRewardClaimsIndex(
  params: FetchWalletRewardClaimsIndexParams
): Promise<WalletRewardClaimsIndex> {
  const { walletAddress, limit, baseUrl } = params;
  const addressLower = asLowerHexAddress(walletAddress);
  const resolvedBase = baseUrl || DEFAULT_POSITIONS_API_BASE;
  const url = `${resolvedBase}/rewards/claims/${addressLower}?limit=${limit}`;

  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as
    | WalletRewardClaimsResponse
    | { error?: string; indexingComplete?: boolean }
    | null;

  if (!res.ok) {
    const indexingComplete = (body as any)?.indexingComplete ?? true;
    if (res.status === 503 && indexingComplete === false) {
      return {
        indexingComplete: false,
        claimedV2Nonces: new Set(),
        claimedV1Buckets: new Set(),
        hasMinerPoolBucketIds: false,
      };
    }

    const message =
      (body as any)?.error || `Failed to fetch wallet reward claims`;
    throw new Error(message);
  }

  const claims = (body as WalletRewardClaimsResponse | null)?.claims ?? [];

  const claimedV2Nonces = new Set<string>();
  const claimedV1Buckets = new Set<string>();
  let hasMinerPoolBucketIds = false;

  for (const claim of claims) {
    if (claim.source === "rewardsKernel" && claim.nonce) {
      claimedV2Nonces.add(claim.nonce);
      continue;
    }

    if (claim.source === "minerPool" && claim.nonce) {
      hasMinerPoolBucketIds = true;
      claimedV1Buckets.add(claim.nonce);
    }
  }

  return {
    indexingComplete: (body as WalletRewardClaimsResponse).indexingComplete,
    claimedV2Nonces,
    claimedV1Buckets,
    hasMinerPoolBucketIds,
  };
}



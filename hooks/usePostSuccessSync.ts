// Post-success cache orchestration for the deposit dialog: optimistic cache
// updates, query invalidation, fresh-cache projection, and the staged V2
// points re-poll. Extracted verbatim from deposit-dialog.tsx (behavior-preserving).
import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DECIMALS_BY_TOKEN,
  type FarmWithRewards,
} from "@glowlabs-org/utils/browser";
import { fetchSponsorListings, type AuctionApplication } from "@/hooks";
import {
  resolveGlwRemainingSteps,
  type SplitActivity,
  type SplitsActivityResponse,
} from "@/hooks/hub-listings";
import type { RewardsBreakdownResponse } from "@/hooks/hub-fractions";
import { QUERY_KEYS } from "@/hooks/query-keys";
import { hubGet } from "@/lib/api/hub-client";
import type { DepositSelectedCurrency } from "../app/marketplace/deposit-dialog-utils";

export function updateApplicationAfterSuccessfulPurchase(
  application: AuctionApplication,
  quantity: number,
  currency: DepositSelectedCurrency,
): AuctionApplication {
  const fraction = application.activeFraction;
  if (!fraction) return application;

  const purchased = Math.max(0, quantity);

  // sGCTL purchases consume the sGCTL leg only; the on-chain GLW step ledger
  // (splitsSold / remainingSteps / totalSteps) is untouched.
  if (currency === "SGCTL") {
    const sgctlLeg = fraction.sgctl;
    if (!sgctlLeg) return application;
    const nextRemainingUnits = Math.max(0, sgctlLeg.remainingUnits - purchased);
    return {
      ...application,
      activeFraction: {
        ...fraction,
        sgctl: {
          ...sgctlLeg,
          remainingUnits: nextRemainingUnits,
        },
      },
    };
  }

  const totalSteps = Math.max(0, Math.floor(fraction.totalSteps ?? 0));
  const prevRemaining = resolveGlwRemainingSteps(fraction);
  const nextRemaining = Math.max(0, prevRemaining - purchased);
  const nextSplitsSold = Math.max(
    0,
    Math.floor(fraction.splitsSold ?? 0) + purchased,
  );
  const filled = Math.max(0, totalSteps - nextRemaining);
  const progressPercent =
    totalSteps > 0 ? Number(((filled / totalSteps) * 100).toFixed(2)) : 0;

  return {
    ...application,
    activeFraction: {
      ...fraction,
      glw: fraction.glw
        ? { ...fraction.glw, remainingSteps: nextRemaining }
        : fraction.glw,
      remainingSteps: nextRemaining,
      splitsSold: nextSplitsSold,
      progressPercent,
      isFilled: nextRemaining <= 0,
    },
  };
}

function prependSuccessfulSplitActivity(
  previous: SplitsActivityResponse | undefined,
  params: {
    txHash: string;
    walletAddress: string;
    application: AuctionApplication;
    quantity: number;
    amount: bigint;
    currency: DepositSelectedCurrency;
  },
): SplitsActivityResponse | undefined {
  if (!previous) return previous;

  const currency =
    params.currency === "USDC" ? "USDC" : params.currency === "SGCTL" ? "SGCTL" : "GLW";
  const fraction = params.application.activeFraction;
  if (!fraction) return previous;

  const alreadyPresent = previous.activity.some(
    (item) => item.transactionHash === params.txHash,
  );
  if (alreadyPresent) return previous;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const updatedApplication = updateApplicationAfterSuccessfulPurchase(
    params.application,
    params.quantity,
    params.currency,
  );
  const fractionType: SplitActivity["fractionType"] =
    fraction.type === "mining-center" ? "mining-center" : "launchpad";

  const optimisticEntry: SplitActivity = {
    transactionHash: params.txHash,
    blockNumber: 0,
    buyer: params.walletAddress,
    creator: fraction.owner,
    stepsPurchased: params.quantity,
    amount: params.amount.toString(),
    step: fraction.step,
    timestamp: nowSeconds,
    purchaseDate: new Date(nowSeconds * 1000).toISOString(),
    fractionId: fraction.id,
    applicationId: params.application.id,
    farmId: params.application.farmId ?? null,
    farmName: params.application.farmName ?? "",
    fractionType,
    fractionStatus: fraction.status,
    currency,
    currencyDecimals: DECIMALS_BY_TOKEN[currency],
    isFilled: updatedApplication.activeFraction?.isFilled ?? false,
    progressPercent: updatedApplication.activeFraction?.progressPercent ?? 0,
    rewardScore: updatedApplication.activeFraction?.rewardScore ?? null,
    stepPrice: fraction.stepPrice,
    totalValue: params.amount.toString(),
  };

  return {
    ...previous,
    activity: [optimisticEntry, ...previous.activity],
    summary: {
      ...previous.summary,
      totalTransactions: previous.summary.totalTransactions + 1,
      totalStepsPurchased:
        previous.summary.totalStepsPurchased + Math.max(0, params.quantity),
      totalAmountSpent: previous.summary.totalAmountSpent,
    },
  };
}

function replaceApplicationInSponsorListings(
  old: unknown,
  application: AuctionApplication,
) {
  if (!Array.isArray(old)) return old;
  return old.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      (item as AuctionApplication).id !== application.id
    ) {
      return item;
    }
    return application;
  });
}

async function fetchFreshSplitsActivityResponse(params: {
  walletAddress: string;
  limit: number;
  fractionType?: "launchpad" | "mining-center";
}): Promise<SplitsActivityResponse> {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit));
  search.set("walletAddress", params.walletAddress);
  if (params.fractionType) {
    search.set("fractionType", params.fractionType);
  }

  const endpoint = params.fractionType
    ? "/api/fractions/splits-activity-by-type"
    : "/api/fractions/splits-activity";
  const response = await fetch(`${endpoint}?${search.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch fresh splits activity: ${response.status}`,
    );
  }

  return (await response.json()) as SplitsActivityResponse;
}

async function fetchFreshWalletFarmsResponse(
  walletAddress: string,
): Promise<FarmWithRewards[]> {
  const baseUrl = process.env.NEXT_PUBLIC_CONTROL_API_URL;
  if (!baseUrl) {
    throw new Error("Environment variable NEXT_PUBLIC_CONTROL_API_URL is not set");
  }

  const response = await fetch(
    `${baseUrl}/farms/wallet/${encodeURIComponent(
      walletAddress,
    )}/farms-with-rewards?_=${Date.now()}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch fresh wallet farms: ${response.status}`);
  }

  const body = (await response.json()) as
    | { farms?: FarmWithRewards[] }
    | FarmWithRewards[];

  return Array.isArray(body) ? body : body.farms ?? [];
}

async function fetchFreshRewardsBreakdownResponse(params: {
  walletAddress?: string | null;
  farmId?: string | null;
  startWeek?: number;
  endWeek?: number;
}): Promise<RewardsBreakdownResponse | null> {
  if (!params.walletAddress && !params.farmId) {
    return null;
  }

  return await hubGet<RewardsBreakdownResponse | null>(
    "/fractions/rewards-breakdown",
    {
      params: {
        walletAddress: params.walletAddress ?? undefined,
        farmId: params.farmId ?? undefined,
        startWeek: params.startWeek,
        endWeek: params.endWeek,
      },
      notFound: null,
      init: {
        cache: "no-store",
      },
    },
  );
}

export function usePostSuccessSync({
  open,
  address,
  chainId,
  runtimeSelectedCurrency,
  invalidateGctlQueries,
}: {
  open: boolean;
  address: `0x${string}` | undefined;
  chainId: number;
  runtimeSelectedCurrency: DepositSelectedCurrency;
  invalidateGctlQueries: () => unknown;
}) {
  const queryClient = useQueryClient();
  const postSuccessRefreshTimeoutsRef = React.useRef<number[]>([]);

  const invalidatePostSuccessQueries = React.useCallback(
    async (fractionId: string) => {
      const normalizedAddress = address?.toLowerCase() ?? null;

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["sponsor-listings"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["sponsor-listings-live-soon"],
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["reward-scores"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["mining-scores"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["splits-activity"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["rewards-breakdown"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["wallet-farms"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.fractions.splits(address, fractionId),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: ["wallet-rewards"],
          exact: false,
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.impact.score(address),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.impact.glowWorth(address),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.impact.scoreBreakdown(address),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.impact.leaderboard(),
          refetchType: "none",
        }),
        // V2 points: refetch the balance + ledger so the success screen
        // reflects the points this purchase grants once they land.
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.v2.pointsBalance(address),
        }),
        // Prefix-invalidate so every ledger page refreshes; the 4-element
        // pointsLedger key ends in `null` and matches no limit-bearing query.
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.v2.pointsLedgerAll(address),
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.balances.tokens(chainId, address),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.fractions.splits(normalizedAddress, fractionId),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.wallets.farms(normalizedAddress ?? undefined),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.wallets.rewards(normalizedAddress ?? undefined),
          refetchType: "none",
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.fractions.rewardsBreakdown({
            walletAddress: normalizedAddress,
          }),
          refetchType: "none",
        }),
      ]);

      if (runtimeSelectedCurrency === "SGCTL") {
        await invalidateGctlQueries();
      }
    },
    [
      address,
      chainId,
      invalidateGctlQueries,
      queryClient,
      runtimeSelectedCurrency,
    ],
  );

  const syncFreshPostSuccessCaches = React.useCallback(async () => {
    const normalizedAddress = address?.toLowerCase();
    if (!normalizedAddress) return;

    const sponsorQueryCache = queryClient.getQueryCache().findAll({
      queryKey: ["sponsor-listings"],
    });
    const sponsorResults = new Map<string, AuctionApplication[]>();

    for (const query of sponsorQueryCache) {
      const [, rawFilters, discriminator] = query.queryKey as [
        string,
        Record<string, any>?,
        string?,
      ];
      // Early-access buckets (queryKey[2] === "early-access:<hash>") are
      // wallet/header-specific. Overwriting them with a public (header-less)
      // response would revert an early-revealed launchpad listing to its public
      // (hidden) state right after a holder's buy. Invalidate instead, so the
      // bucket refetches through useSponsorListings with its own
      // x-glow-early-access header.
      if (
        typeof discriminator === "string" &&
        discriminator.startsWith("early-access")
      ) {
        queryClient.invalidateQueries({ queryKey: query.queryKey });
        continue;
      }
      const filters = rawFilters ?? {};
      const cacheKey = JSON.stringify(filters);
      let fresh = sponsorResults.get(cacheKey);
      if (!fresh) {
        fresh = await fetchSponsorListings(filters);
        sponsorResults.set(cacheKey, fresh);
      }
      queryClient.setQueryData(query.queryKey, fresh);
    }

    const splitQueryCache = queryClient.getQueryCache().findAll({
      queryKey: ["splits-activity"],
    });
    const splitResults = new Map<string, SplitsActivityResponse>();

    for (const query of splitQueryCache) {
      const [, rawLimit, rawWalletAddress, rawFractionType] = query.queryKey as [
        string,
        number | undefined,
        string | undefined,
        "launchpad" | "mining-center" | undefined,
      ];

      const queryWallet = rawWalletAddress?.toLowerCase();
      if (queryWallet && queryWallet !== normalizedAddress) continue;

      const limit =
        typeof rawLimit === "number" && Number.isFinite(rawLimit)
          ? rawLimit
          : 50;
      const fractionType =
        rawFractionType === "launchpad" || rawFractionType === "mining-center"
          ? rawFractionType
          : undefined;
      const cacheKey = `${limit}:${fractionType ?? "all"}`;

      let fresh = splitResults.get(cacheKey);
      if (!fresh) {
        fresh = await fetchFreshSplitsActivityResponse({
          walletAddress: normalizedAddress,
          limit,
          fractionType,
        });
        splitResults.set(cacheKey, fresh);
      }
      queryClient.setQueryData(query.queryKey, fresh);
    }

    const walletFarmQueryCache = queryClient.getQueryCache().findAll({
      queryKey: ["wallet-farms"],
    });
    if (walletFarmQueryCache.length > 0) {
      const freshWalletFarms =
        await fetchFreshWalletFarmsResponse(normalizedAddress);

      for (const query of walletFarmQueryCache) {
        const [, rawWalletAddress] = query.queryKey as [
          string,
          string | undefined,
        ];
        const queryWallet = rawWalletAddress?.toLowerCase();
        if (queryWallet && queryWallet !== normalizedAddress) continue;
        queryClient.setQueryData(query.queryKey, freshWalletFarms);
      }
    }

    const rewardsBreakdownQueryCache = queryClient.getQueryCache().findAll({
      queryKey: ["rewards-breakdown"],
    });
    const rewardsBreakdownResults = new Map<string, RewardsBreakdownResponse | null>();

    for (const query of rewardsBreakdownQueryCache) {
      const [
        ,
        rawWalletAddress,
        rawFarmId,
        rawStartWeek,
        rawEndWeek,
      ] = query.queryKey as [
        string,
        string | null | undefined,
        string | null | undefined,
        number | undefined,
        number | undefined,
      ];

      const queryWallet = rawWalletAddress?.toLowerCase() ?? null;
      if (queryWallet && queryWallet !== normalizedAddress) continue;

      const cacheKey = JSON.stringify([
        queryWallet,
        rawFarmId ?? null,
        rawStartWeek ?? null,
        rawEndWeek ?? null,
      ]);

      let fresh = rewardsBreakdownResults.get(cacheKey);
      if (fresh === undefined) {
        fresh = await fetchFreshRewardsBreakdownResponse({
          walletAddress: rawWalletAddress ?? undefined,
          farmId: rawFarmId ?? undefined,
          startWeek: rawStartWeek,
          endWeek: rawEndWeek,
        });
        rewardsBreakdownResults.set(cacheKey, fresh);
      }

      queryClient.setQueryData(query.queryKey, fresh);
    }
  }, [address, queryClient]);

  const clearScheduledPostSuccessRefreshes = React.useCallback(() => {
    for (const timeoutId of postSuccessRefreshTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    postSuccessRefreshTimeoutsRef.current = [];
  }, []);

  const schedulePostSuccessRefreshes = React.useCallback(() => {
    clearScheduledPostSuccessRefreshes();

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          await syncFreshPostSuccessCaches();
        } catch {
          // Best effort only. Late projection passes should never surface
          // an additional error once the transaction is already successful.
        }
      })();
    }, 5_000);

    postSuccessRefreshTimeoutsRef.current.push(timeoutId);

    // The V2 points award lands asynchronously (BullMQ realtime), seconds after
    // the deposit tx commits, so a single post-success refresh would still show
    // "Pending". Re-poll the points balance + ledger a few times so the
    // credited number appears without a manual reload. (Timeouts are tracked in
    // the same ref, so they're cleared on close/unmount.)
    const lowered = address?.toLowerCase();
    if (lowered) {
      for (const delay of [3_000, 7_000, 12_000]) {
        const id = window.setTimeout(() => {
          void queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.v2.pointsBalance(lowered),
          });
          void queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.v2.pointsLedgerAll(lowered),
          });
        }, delay);
        postSuccessRefreshTimeoutsRef.current.push(id);
      }
    }
  }, [
    address,
    clearScheduledPostSuccessRefreshes,
    queryClient,
    syncFreshPostSuccessCaches,
  ]);

  React.useEffect(() => {
    if (open) return;
    clearScheduledPostSuccessRefreshes();
  }, [clearScheduledPostSuccessRefreshes, open]);

  React.useEffect(() => {
    return () => {
      clearScheduledPostSuccessRefreshes();
    };
  }, [clearScheduledPostSuccessRefreshes]);

  const applyOptimisticPostSuccessUpdates = React.useCallback(
    (params: {
      txHash: string;
      application: AuctionApplication;
      fallbackApplication?: AuctionApplication | null;
      quantity: number;
      amount: bigint;
      currency: DepositSelectedCurrency;
    }) => {
      const normalizedAddress = address?.toLowerCase();
      if (!normalizedAddress) return;

      queryClient.setQueriesData(
        { queryKey: ["sponsor-listings"], exact: false },
        (old: unknown) =>
          replaceApplicationInSponsorListings(old, params.application),
      );

      queryClient.setQueriesData(
        { queryKey: ["splits-activity"], exact: false },
        (old: unknown) =>
          prependSuccessfulSplitActivity(
            old as SplitsActivityResponse | undefined,
            {
              txHash: params.txHash,
              walletAddress: normalizedAddress,
              application:
                params.fallbackApplication ?? params.application,
              quantity: params.quantity,
              amount: params.amount,
              currency: params.currency,
            },
          ),
      );
    },
    [address, queryClient],
  );

  return {
    invalidatePostSuccessQueries,
    syncFreshPostSuccessCaches,
    schedulePostSuccessRefreshes,
    applyOptimisticPostSuccessUpdates,
  };
}

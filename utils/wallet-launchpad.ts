"use client";

import type { AuctionApplication, SplitActivity } from "@/hooks/hub-listings";
import {
  parseDelegationAmountFromBaseUnits,
  resolveDelegationCurrency,
  resolveDelegationCurrencyFromSplitActivity,
} from "@/utils/launchpad-rewards";

export type DelegationAmountsByAsset = Partial<Record<"GLW" | "SGCTL", number>>;

const TERMINAL_SPLIT_STATUSES = new Set([
  "filled",
  "expired",
  "cancelled",
  "closed",
]);

export function isSplitActivityStillActive(params: {
  split: Pick<
    SplitActivity,
    "fractionStatus" | "isFilled" | "progressPercent"
  >;
  listing?: Pick<AuctionApplication, "activeFraction"> | null;
}) {
  const { split, listing } = params;
  const status = (split.fractionStatus ?? "").toLowerCase();
  const progress =
    listing?.activeFraction?.progressPercent ?? split.progressPercent ?? 0;
  const isFilled =
    Boolean(listing?.activeFraction?.isFilled) ||
    Boolean(split.isFilled) ||
    TERMINAL_SPLIT_STATUSES.has(status) ||
    progress >= 100;

  return !isFilled;
}

export function resolveLaunchpadSplitCurrency(params: {
  currency?: string | null;
  listingCurrency?: string | null;
  amount?: string | null;
  stepPrice?: string | null;
  transactionHash?: string | null;
}) {
  return resolveDelegationCurrencyFromSplitActivity({
    currency: params.currency,
    amount: params.amount,
    stepPrice: params.stepPrice,
    transactionHash: params.transactionHash,
    listingCurrency: params.listingCurrency,
  });
}

export function resolveLaunchpadActivityFarmId(params: {
  applicationId?: string | null;
  activityFarmId?: string | null;
  listingFarmId?: string | null;
}) {
  return (
    params.activityFarmId ?? params.listingFarmId ?? params.applicationId ?? null
  );
}

export function buildCurrentLaunchpadCurrencyByFarmId(
  sponsorListings: AuctionApplication[]
) {
  const map = new Map<string, "GLW" | "SGCTL">();

  for (const app of sponsorListings) {
    const currency = resolveDelegationCurrency(app);
    map.set(app.id, currency);
    if (app.farmId) {
      map.set(app.farmId, currency);
    }
  }

  return map;
}

export function buildLaunchpadCurrenciesByFarmId(params: {
  splitsActivity: SplitActivity[];
  sponsorListingById: Map<string, AuctionApplication>;
}) {
  const { splitsActivity, sponsorListingById } = params;
  const map = new Map<string, Set<"GLW" | "SGCTL">>();

  for (const evt of splitsActivity) {
    if (evt.fractionType !== "launchpad") continue;

    const listing = sponsorListingById.get(evt.applicationId);
    const farmId = resolveLaunchpadActivityFarmId({
      applicationId: evt.applicationId,
      activityFarmId: evt.farmId,
      listingFarmId: listing?.farmId,
    });
    if (!farmId) continue;

    const currency = resolveLaunchpadSplitCurrency({
      currency: evt.currency,
      amount: evt.amount,
      stepPrice: evt.stepPrice,
      transactionHash: evt.transactionHash,
      listingCurrency: listing ? resolveDelegationCurrency(listing) : null,
    });

    const existing = map.get(farmId) ?? new Set<"GLW" | "SGCTL">();
    existing.add(currency);
    map.set(farmId, existing);
  }

  return map;
}

export function buildLaunchpadDelegatedAmountsByFarmId(params: {
  splitsActivity: SplitActivity[];
  sponsorListingById: Map<string, AuctionApplication>;
}) {
  const { splitsActivity, sponsorListingById } = params;
  const map = new Map<string, DelegationAmountsByAsset>();

  for (const evt of splitsActivity) {
    if (evt.fractionType !== "launchpad") continue;

    const listing = sponsorListingById.get(evt.applicationId);
    const farmId = resolveLaunchpadActivityFarmId({
      applicationId: evt.applicationId,
      activityFarmId: evt.farmId,
      listingFarmId: listing?.farmId,
    });
    if (!farmId) continue;

    const currency = resolveLaunchpadSplitCurrency({
      currency: evt.currency,
      amount: evt.amount,
      stepPrice: evt.stepPrice,
      transactionHash: evt.transactionHash,
      listingCurrency: listing ? resolveDelegationCurrency(listing) : null,
    });
    const amount = parseDelegationAmountFromBaseUnits(evt.amount, currency);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const existing = map.get(farmId) ?? {};
    existing[currency] = (existing[currency] ?? 0) + amount;
    map.set(farmId, existing);
  }

  return map;
}

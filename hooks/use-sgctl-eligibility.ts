"use client";

import React from "react";

import { useWalletRegionAvailableStakeMap } from "@/hooks/control-wallets";
import type { AuctionApplication } from "@/hooks/hub-listings";

/**
 * sGCTL eligibility gate (UI-only, per spec §1.4).
 *
 * A wallet may see sGCTL UI for a listing only if its available staked GCTL in
 * the farm's region covers at least one sGCTL unit (`availableStakedGctl >=
 * sgctl.unitAtomic`). Logged-out / no-wallet states are ineligible everywhere.
 *
 * Listings stay wallet-agnostic (cache-safe); this hook is pure client-side
 * composition: it batch-reads available stake for the regions of the supplied
 * listings and folds it against each listing's locked `sgctl.unitAtomic`
 * (6-decimal GCTL atomics). Server-side purchase enforcement stays in Control.
 *
 * This is the single source of truth for ALL sGCTL UI visibility — card
 * sections, dialog tab, and stats.
 */

function parseUnitAtomic(value: string | null | undefined): bigint | null {
  if (value == null) return null;
  try {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function getSgctlLeg(
  application: AuctionApplication,
): { regionId: number; unitAtomic: bigint } | null {
  const sgctlLeg = application.activeFraction?.sgctl;
  if (!sgctlLeg) return null;

  const unitAtomic = parseUnitAtomic(sgctlLeg.unitAtomic);
  if (unitAtomic == null) return null;

  const regionId = application.zone?.id;
  if (typeof regionId !== "number" || !Number.isFinite(regionId)) return null;

  return { regionId, unitAtomic };
}

export interface UseSgctlEligibilityParams {
  applications: AuctionApplication[];
  walletAddress?: string | null;
  enabled?: boolean;
}

export interface UseSgctlEligibilityResult {
  /** application.id -> can the wallet see/use the sGCTL leg of this listing. */
  eligibilityByApplicationId: Map<string, boolean>;
  isEligibilityLoading: boolean;
  isEligibilityFetching: boolean;
  /** Convenience reader: false for unknown ids and for no-wallet states. */
  isSgctlEligible: (applicationId: string) => boolean;
}

export function useSgctlEligibility(
  params: UseSgctlEligibilityParams,
): UseSgctlEligibilityResult {
  const { applications, walletAddress, enabled = true } = params;

  const normalizedWalletAddress = walletAddress
    ? walletAddress.toLowerCase()
    : null;

  // Only the listings that actually have an sGCTL leg contribute regions to the
  // batch read. No sGCTL leg -> no sGCTL UI regardless of stake.
  const sgctlListings = React.useMemo(() => {
    const list: Array<{
      applicationId: string;
      regionId: number;
      unitAtomic: bigint;
    }> = [];
    for (const application of applications) {
      const leg = getSgctlLeg(application);
      if (!leg) continue;
      list.push({
        applicationId: application.id,
        regionId: leg.regionId,
        unitAtomic: leg.unitAtomic,
      });
    }
    return list;
  }, [applications]);

  const regionIds = React.useMemo(
    () => sgctlListings.map((listing) => listing.regionId),
    [sgctlListings],
  );

  const {
    availableStakedGctlByRegion,
    isAvailableStakeMapLoading,
    isAvailableStakeMapFetching,
  } = useWalletRegionAvailableStakeMap({
    walletAddress: normalizedWalletAddress ?? undefined,
    regionIds,
    enabled: enabled && Boolean(normalizedWalletAddress),
  });

  const eligibilityByApplicationId = React.useMemo(() => {
    const map = new Map<string, boolean>();
    // No wallet -> ineligible for everything (no sGCTL UI at all).
    if (!normalizedWalletAddress) return map;

    for (const listing of sgctlListings) {
      const availableStakedGctl =
        availableStakedGctlByRegion.get(listing.regionId) ?? 0n;
      map.set(
        listing.applicationId,
        availableStakedGctl >= listing.unitAtomic,
      );
    }
    return map;
  }, [availableStakedGctlByRegion, normalizedWalletAddress, sgctlListings]);

  const isSgctlEligible = React.useCallback(
    (applicationId: string) =>
      eligibilityByApplicationId.get(applicationId) === true,
    [eligibilityByApplicationId],
  );

  return {
    eligibilityByApplicationId,
    isEligibilityLoading: isAvailableStakeMapLoading,
    isEligibilityFetching: isAvailableStakeMapFetching,
    isSgctlEligible,
  } as const;
}

import type { ActiveFraction, AuctionApplication } from "@/hooks/hub-listings";
import {
  isSgctlOrganicLegFrozen,
  resolveGlwRemainingSteps,
  resolveSgctlRemainingUnits,
} from "@/hooks/hub-listings";
import { getLaunchpadNowMs } from "@/utils/launchpad-now";

/**
 * Consolidated launch window — two-distinct-tiles model (product decision
 * 2026-06-13). A delegation farm with an sGCTL leg renders as TWO separate
 * single-asset tiles, never one mixed/morphing card:
 *   - a GLW-only tile (always, for everyone), and
 *   - an sGCTL-only tile (only when the wallet is eligible).
 * Each tile shows its own reward score and opens its own deposit dialog. This
 * helper turns a tagged listing list into the per-tile entries every surface
 * renders, so the behavior is identical across the marketplace, the status
 * widget, and the bento.
 */

export type LaunchpadCardLeg = "GLW" | "SGCTL" | null;

export interface LaunchpadCardEntry<
  T extends AuctionApplication = AuctionApplication,
> {
  application: T;
  /** "GLW"/"SGCTL" for delegation tiles; null for non-delegation (miner) tiles. */
  leg: LaunchpadCardLeg;
  /** Stable React key, distinct per leg so one farm can yield two tiles. */
  key: string;
  /**
   * Per-leg sold-out: GLW when no steps remain; sGCTL when no units remain —
   * the latter also covers the Foundation backstop having filled the sGCTL leg
   * (GLW full + 1h grace). Always false for miner entries (the surface computes
   * miner availability itself).
   */
  legSoldOut: boolean;
  /**
   * sGCTL early-access FE gate: true for an sGCTL tile that is being shown
   * early (an entitled wallet sees the listing before its PUBLIC `visibleAt`).
   * Early access covers miners + the GLW leg only; the sGCTL leg opens at the
   * public launch (Tue 9 AM ET), so the surface renders this tile DISABLED with
   * an "opens at public launch" affordance instead of a buyable CTA. Always
   * false for GLW and miner entries, and false once `now >= public visibleAt`.
   * This is belt-and-suspenders against the backend forcing `delegationAsset`
   * to GLW in the early bucket (so an early sGCTL leg should not exist at all).
   */
  legNotYetOpen: boolean;
}

/**
 * True when the listing is still before its PUBLIC visible-at, i.e. an entitled
 * wallet is seeing it early. The early window covers miners + the GLW leg only;
 * the sGCTL leg stays gated until the PUBLIC launch. Reads `marketplaceVisibleAt`
 * FIRST because that field is always the public 9 AM slot: the backend shifts the
 * consolidated `visibleAt` earlier for early-access reads (so `visibleAt` is NOT a
 * safe public boundary here), but keeps `marketplaceVisibleAt` public. Falls back
 * to `visibleAt` only when the public field is absent. Returns false when no
 * visible-at is known (never gate on a missing boundary).
 */
export function isBeforePublicVisibleAt(
  fraction:
    | Pick<ActiveFraction, "visibleAt" | "marketplaceVisibleAt">
    | null
    | undefined,
  nowMs?: number,
): boolean {
  if (!fraction) return false;
  // Public-first: marketplaceVisibleAt is never shifted; the consolidated
  // visibleAt IS shifted earlier for early-access reads, so using it here would
  // wrongly open the sGCTL leg ~15 min before the public launch.
  const publicVisibleAt = fraction.marketplaceVisibleAt ?? fraction.visibleAt;
  if (!publicVisibleAt) return false;
  const visibleAtMs = Date.parse(publicVisibleAt);
  if (!Number.isFinite(visibleAtMs)) return false;
  return getLaunchpadNowMs(nowMs) < visibleAtMs;
}

/**
 * A listing has a real, buyable sGCTL leg only when the leg object exists and
 * carries a positive unit price. GLW-only farms get no sGCTL tile.
 */
export function hasBuyableSgctlLeg(
  application: Pick<AuctionApplication, "activeFraction">,
): boolean {
  const leg = application.activeFraction?.sgctl;
  if (!leg || leg.unitAtomic == null) return false;
  try {
    return BigInt(leg.unitAtomic) > 0n;
  } catch {
    return false;
  }
}

/**
 * Expand a tagged listing list into per-tile entries:
 *   - non-delegations (miners) -> a single entry (leg = null),
 *   - delegations -> always a GLW tile, plus an sGCTL tile when the farm has a
 *     buyable sGCTL leg AND the wallet is eligible AND the sGCTL leg is not
 *     FROZEN (GLW sold out + past the 1h grace -> only the Foundation backstop
 *     fills it, so it is no longer buyable; hide the tile).
 * Ineligible / logged-out wallets never get an sGCTL entry, so they only ever
 * see the GLW tile and its GLW score (spec §1.2 / §1.4).
 */
export function expandLaunchpadCardEntries<T extends AuctionApplication>(params: {
  applications: T[];
  isSgctlEligible: (applicationId: string) => boolean;
  isDelegation: (application: T) => boolean;
  /** Injectable for tests / SSR; the freeze check is time-dependent. */
  nowMs?: number;
}): Array<LaunchpadCardEntry<T>> {
  const { applications, isSgctlEligible, isDelegation, nowMs } = params;
  const entries: Array<LaunchpadCardEntry<T>> = [];

  for (const application of applications) {
    if (!isDelegation(application)) {
      entries.push({
        application,
        leg: null,
        key: `${application.id}:MINER`,
        legSoldOut: false,
        legNotYetOpen: false,
      });
      continue;
    }

    const fraction = application.activeFraction;

    entries.push({
      application,
      leg: "GLW",
      key: `${application.id}:GLW`,
      legSoldOut: resolveGlwRemainingSteps(fraction) <= 0,
      legNotYetOpen: false,
    });

    if (
      hasBuyableSgctlLeg(application) &&
      isSgctlEligible(application.id) &&
      !isSgctlOrganicLegFrozen(fraction, nowMs)
    ) {
      // sGCTL early-access gate: if this listing is being revealed early (its
      // PUBLIC visibleAt is still future), the sGCTL leg is NOT buyable yet —
      // only miners + the GLW leg open early. Surface it DISABLED with an
      // "opens at public launch" affordance rather than a buyable CTA.
      entries.push({
        application,
        leg: "SGCTL",
        key: `${application.id}:SGCTL`,
        legSoldOut: resolveSgctlRemainingUnits(fraction) <= 0,
        legNotYetOpen: isBeforePublicVisibleAt(fraction, nowMs),
      });
    }
  }

  return entries;
}

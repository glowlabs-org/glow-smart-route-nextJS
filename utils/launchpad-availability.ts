// Single source of truth for "how many units of this launchpad listing are
// still for sale, and is it sold out". Three places in the UI used to compute
// this inline with subtly different math (launchpad-view, launchpad-status-widget,
// farms-performance-dialog). The composition was the bug surface for the
// wk128 Spectrum Canopy regression: `total` from resolveLaunchpadDelegationShareCount
// returned sGCTL-share units while `remaining` from resolveFractionRemainingSteps
// returned GLW-step units, so the displayed "sold" was computed by subtracting
// values in different units. Centralizing the math here forces every caller
// through the same invariant.

import {
  isFractionOpenForMarketplace,
  type ActiveFraction,
} from "@/hooks/hub-listings";
import {
  resolveLaunchpadDelegationShareCount,
  type DelegationApplicationLike,
} from "./launchpad-rewards";

export interface LaunchpadAvailability {
  /** Units left for sale, in the unit of the current phase. */
  remaining: number;
  /** Phase-aware capacity: sGCTL = ceil(finalProtocolFee/currentStepUsd6); GLW = totalSteps. */
  total: number;
  /** Units sold so far, capped at total to avoid display overflow when splits_sold runs ahead of total. */
  sold: number;
  /** True if the marketplace itself has closed the listing (window/filled/expired). NEVER use `remaining<=0` as the trigger — splits_sold can legitimately exceed total_steps mid-sGCTL. */
  isSoldOut: boolean;
  /** Filled percent, bounded [0, 100]. */
  progressFilledPct: number;
}

const EMPTY: LaunchpadAvailability = {
  remaining: 0,
  total: 0,
  sold: 0,
  isSoldOut: true,
  progressFilledPct: 0,
};

export function getLaunchpadAvailability(
  application: DelegationApplicationLike | null | undefined
): LaunchpadAvailability {
  if (!application) return EMPTY;
  const fraction = application.activeFraction;
  if (!fraction) return EMPTY;

  const total = Math.max(
    0,
    Math.floor(resolveLaunchpadDelegationShareCount(application))
  );
  const splitsSold = Math.max(0, Math.floor(fraction.splitsSold ?? 0));
  const sold = Math.min(splitsSold, total);
  const remaining = Math.max(0, total - sold);
  const isSoldOut = !isFractionOpenForMarketplace(fraction);
  const progressFilledPct =
    total > 0 ? Math.max(0, Math.min(100, (sold / total) * 100)) : 0;

  return { remaining, total, sold, isSoldOut, progressFilledPct };
}

export type LaunchpadAvailabilityFraction = Pick<
  ActiveFraction,
  "splitsSold" | "totalSteps" | "remainingSteps" | "isFilled"
>;

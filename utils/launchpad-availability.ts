// Single source of truth for "how many units of this launchpad listing are
// still for sale, and is it sold out". Three places in the UI used to compute
// this inline with subtly different math (launchpad-view, launchpad-status-widget,
// farms-performance-dialog). The composition was the bug surface for the
// wk128 Spectrum Canopy regression: `total` from resolveLaunchpadDelegationShareCount
// returned sGCTL-share units while `remaining` was computed in GLW-step units,
// so the displayed "sold" was computed by subtracting values in different units.
// Centralizing the math here forces every caller through the same invariant.

import {
  isFractionOpenForMarketplace,
  resolveGlwRemainingSteps,
  resolveSgctlRemainingUnits,
  type ActiveFraction,
} from "@/hooks/hub-listings";
import {
  resolveDelegationCurrency,
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
  /** Whether `total` is a real unit count worth displaying as the "X / Y" denominator. Only sGCTL's total is legitimate; the GLW total_steps is over-counted post-commit (splits_sold + GLW remainder), so for GLW listings the UI must show ONLY `remaining`, never "remaining / total". */
  showTotal: boolean;
}

const EMPTY: LaunchpadAvailability = {
  remaining: 0,
  total: 0,
  sold: 0,
  isSoldOut: true,
  progressFilledPct: 0,
  showTotal: false,
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
  const showTotal = resolveDelegationCurrency(application) === "SGCTL";

  return { remaining, total, sold, isSoldOut, progressFilledPct, showTotal };
}

export type LaunchpadAvailabilityFraction = Pick<
  ActiveFraction,
  "splitsSold" | "totalSteps" | "remainingSteps" | "isFilled"
>;

/**
 * Per-leg availability for the two-distinct-tiles model (consolidated launch
 * window). Each tile shows its OWN leg's "X left" and sold-out state:
 *   - GLW tile: sold out when no GLW steps remain.
 *   - sGCTL tile: sold out when no sGCTL units remain — which ALSO covers the
 *     Foundation backstop having filled the leg (GLW full + 1h grace). Crucially
 *     we do NOT use the GLW-centric `isFractionOpenForMarketplace` here, so the
 *     sGCTL tile stays OPEN during the grace window after GLW sells out.
 * We don't receive the sGCTL leg's original total (S), so — like the GLW tile
 * already does — both tiles show only "X left" (showTotal = false), no
 * "X / Y" denominator.
 */
export function getLaunchpadLegAvailability(
  application: DelegationApplicationLike | null | undefined,
  leg: "GLW" | "SGCTL"
): LaunchpadAvailability {
  if (!application) return EMPTY;
  const fraction = application.activeFraction;
  if (!fraction) return EMPTY;

  const remaining =
    leg === "SGCTL"
      ? resolveSgctlRemainingUnits(fraction)
      : resolveGlwRemainingSteps(fraction);
  const isSoldOut = remaining <= 0 || fraction.isFilled === true;

  return {
    remaining,
    total: 0,
    sold: 0,
    isSoldOut,
    progressFilledPct: isSoldOut ? 100 : 0,
    showTotal: false,
  };
}
